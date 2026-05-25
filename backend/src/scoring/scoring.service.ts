import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../cache/cache.service';
import { StocksService } from '../stocks/stocks.service';
import { SentimentService } from '../sentiment/sentiment.service';
import { FlowsService } from '../flows/flows.service';
import { MacroService } from '../macro/macro.service';
import { clamp } from '../common/http.util';

export interface ScoreResult {
  symbol: string;
  finalScore: number;
  fundamental: number;
  technical: number;
  sentiment: number;
  institutional: number;
  analyst: number;
  political: number;
  macro: number;
  confidence: number;
  rankingScore: number;
  /** Per-dimension provenance — true = real data, false = neutral fallback. */
  coverage: Record<string, boolean>;
}

/**
 * Scoring Engine V2 — REWRITTEN.
 *
 * Previously 4 of 7 dimensions were Math.random() and the engine re-fetched
 * Finnhub directly instead of using the platform's own data services. This
 * version consumes StocksService / SentimentService / FlowsService /
 * MacroService — the real pipeline — and contains ZERO randomness.
 *
 * Missing data does not fabricate a number: the dimension defaults to a
 * neutral 5.0 and is marked uncovered, which lowers the confidence factor.
 * That is exactly what the confidence factor exists for.
 */
@Injectable()
export class ScoringService {
  private readonly logger = new Logger(ScoringService.name);

  private static readonly WEIGHTS = {
    fundamental: 2.5, technical: 2.0, sentiment: 1.5,
    institutional: 2.0, analyst: 1.0, political: 0.5, macro: 0.5,
  };

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly stocks: StocksService,
    private readonly sentiment: SentimentService,
    private readonly flows: FlowsService,
    private readonly macro: MacroService,
  ) {}

  async computeScore(symbol: string): Promise<ScoreResult> {
    const upper = symbol.toUpperCase();
    const cacheKey = `scoring:score:${upper}`;
    const cached = await this.cache.get<ScoreResult>(cacheKey);
    if (cached) return cached;

    // Sector is needed for the relative-strength layer.
    const stockRow = await this.prisma.stock.findUnique({ where: { symbol: upper } }).catch(() => null);
    const sector = stockRow?.sector ?? null;

    // Pull every dimension from the real services in parallel.
    const [fund, tech, sent, analystData, flowSummary, insiderDetail, rsData, macroData] =
      await Promise.allSettled([
        this.stocks.getFundamentals(upper),
        this.stocks.getTechnicals(upper),
        this.sentiment.getSentiment(upper),
        this.stocks.getAnalystRatings(upper),
        this.flows.getSummary(upper),
        this.flows.getInsider(upper),     // parsed Form 4 net flow
        this.stocks.getRelativeStrength(upper, sector),
        this.macro.getDashboard(),
      ]);

    const val = <T>(r: PromiseSettledResult<T>): T | null =>
      r.status === 'fulfilled' ? r.value : null;

    const fundData = val(fund) as any;
    const techData = val(tech) as any;
    const sentData = val(sent) as any;
    const ratings = val(analystData) as any;
    const flowData = val(flowSummary) as any;
    const insider = val(insiderDetail) as any;
    const rs = val(rsData) as any;
    const macroDash = val(macroData) as any;

    // ---- score each dimension; coverage flags drive confidence ----
    const coverage: Record<string, boolean> = {};

    const fundamental = this.scoreFundamental(fundData, coverage);
    const technical = this.scoreTechnical(techData, rs, coverage);
    const sentiment = this.scoreSentiment(sentData, coverage);
    const institutional = this.scoreInstitutional(flowData, insider, coverage);
    const analyst = this.scoreAnalyst(ratings, coverage);
    const political = this.scorePolitical(flowData, coverage);
    const macro = this.scoreMacro(macroDash, coverage);

    // ---- confidence: completeness + cross-source agreement + recency ----
    const covered = Object.values(coverage).filter(Boolean).length;
    const completeness = covered / 7;
    // agreement: do fundamental & technical & analyst point the same way?
    const dims = [fundamental, technical, analyst];
    const spread = Math.max(...dims) - Math.min(...dims);
    const agreement = 1 - spread / 10;
    const recency = 1.0;
    const confidence = this.computeConfidence(completeness, agreement, recency);

    // ---- weighted aggregate ----
    const W = ScoringService.WEIGHTS;
    const weightedSum =
      fundamental * W.fundamental + technical * W.technical +
      sentiment * W.sentiment + institutional * W.institutional +
      analyst * W.analyst + political * W.political + macro * W.macro;
    const maxSum = 10 * Object.values(W).reduce((a, b) => a + b, 0);
    const finalScore = clamp((weightedSum / maxSum) * 10 * confidence, 0, 10);
    const rankingScore = clamp(finalScore, 0, 10);

    const result: ScoreResult = {
      symbol: upper, finalScore: round(finalScore),
      fundamental: round(fundamental), technical: round(technical),
      sentiment: round(sentiment), institutional: round(institutional),
      analyst: round(analyst), political: round(political), macro: round(macro),
      confidence: round(confidence), rankingScore: round(rankingScore), coverage,
    };

    await this.cache.set(cacheKey, result, 600);
    await this.persist(result);
    return result;
  }

  // ------------------------------------------------------ DIMENSION SCORERS
  private scoreFundamental(d: any, cov: Record<string, boolean>): number {
    if (!d || [d.peRatio, d.roe, d.revenueGrowth, d.operatingMargin].every((x) => x == null)) {
      cov.fundamental = false;
      return 5;
    }
    cov.fundamental = true;
    let s = 5;
    if (d.peRatio != null) s += d.peRatio > 0 && d.peRatio < 15 ? 1 : d.peRatio > 40 ? -1 : 0;
    if (d.roe != null) s += d.roe > 0.2 ? 1 : d.roe < 0 ? -1 : 0;
    if (d.revenueGrowth != null) s += d.revenueGrowth > 0.15 ? 1 : d.revenueGrowth < 0 ? -1 : 0;
    if (d.operatingMargin != null) s += d.operatingMargin > 0.2 ? 1 : d.operatingMargin < 0 ? -1 : 0;
    if (d.debtEquity != null) s += d.debtEquity < 0.5 ? 0.5 : d.debtEquity > 3 ? -1 : 0;

    // Earnings momentum modulator: maps the layer's 0–10 score to a [-1, +1] nudge.
    if (d.epsScore != null) s += (d.epsScore - 5) / 5;

    return clamp(s, 0, 10);
  }

  private scoreTechnical(d: any, rs: any, cov: Record<string, boolean>): number {
    if (!d || (d.rsi14 == null && d.macd == null && d.sma50 == null)) {
      cov.technical = false;
      return 5;
    }
    cov.technical = true;
    let s = 5;
    if (d.rsi14 != null) s += d.rsi14 < 30 ? 1.5 : d.rsi14 > 70 ? -1.5 : 0;
    if (d.macdSignal === 'bullish') s += 1;
    else if (d.macdSignal === 'bearish') s -= 1;
    if (d.price != null && d.sma200 != null) {
      const vsMa = (d.price - d.sma200) / d.sma200;
      s += vsMa > 0.1 ? 0.5 : vsMa < -0.1 ? -0.5 : 0;
    }
    if (d.sma50 != null && d.sma200 != null) s += d.sma50 > d.sma200 ? 0.5 : -0.5;

    // Risk modulator: low vol + shallow drawdown nudges technical up; spikes nudge down.
    if (d.riskScore != null) s += (d.riskScore - 5) / 10;          // ±0.5 max

    // Relative strength vs sector ETF over 30d
    if (rs?.rsScore != null) s += (rs.rsScore - 5) / 5;            // ±1 max

    return clamp(s, 0, 10);
  }

  private scoreSentiment(d: any, cov: Record<string, boolean>): number {
    if (!d || !d.dataSources?.length) {
      cov.sentiment = false;
      return 5;
    }
    cov.sentiment = true;
    // d.score is [-1, 1] -> map to [0, 10]
    return clamp(5 + d.score * 5, 0, 10);
  }

  private scoreInstitutional(d: any, insider: any, cov: Record<string, boolean>): number {
    const filings = d?.institutional?.recentFilings ?? 0;
    const buys = insider?.buys ?? 0;
    const sells = insider?.sells ?? 0;
    const netValue = insider?.netValue ?? 0;
    const tradeCount = (insider?.trades ?? []).length;

    if (!d || (filings === 0 && tradeCount === 0)) {
      cov.institutional = false;
      return 5;
    }
    cov.institutional = true;

    let s = 5;
    // 13F attention — more recent institutional filings = more eyes
    s += Math.min(filings, 10) * 0.2;
    // Insider net direction: buys vs sells from parsed Form 4 codes
    if (buys + sells > 0) {
      const tilt = (buys - sells) / (buys + sells);
      s += tilt * 1.5;
    }
    // Dollar magnitude — heavy net buying is a stronger signal than count alone
    if (netValue >= 1_000_000) s += 0.5;
    else if (netValue <= -1_000_000) s -= 0.5;

    return clamp(s, 0, 10);
  }

  private scoreAnalyst(d: any, cov: Record<string, boolean>): number {
    if (!d) {
      cov.analyst = false;
      return 5;
    }
    const total = (d.strongBuy ?? 0) + (d.buy ?? 0) + (d.hold ?? 0) + (d.sell ?? 0) + (d.strongSell ?? 0);
    if (total === 0) {
      cov.analyst = false;
      return 5;
    }
    cov.analyst = true;
    const bullish = ((d.strongBuy ?? 0) * 2 + (d.buy ?? 0)) / total;
    const bearish = ((d.strongSell ?? 0) * 2 + (d.sell ?? 0)) / total;
    return clamp(5 + (bullish - bearish) * 5, 0, 10);
  }

  private scorePolitical(d: any, cov: Record<string, boolean>): number {
    const trades = d?.political?.trades ?? 0;
    if (!d || trades === 0) {
      cov.political = false;
      return 5;
    }
    cov.political = true;
    const buys = d.political.buys ?? 0;
    const sells = d.political.sells ?? 0;
    if (buys + sells === 0) return 5;
    return clamp(5 + ((buys - sells) / (buys + sells)) * 3, 0, 10);
  }

  private scoreMacro(dash: any, cov: Record<string, boolean>): number {
    const inds: any[] = dash?.indicators ?? [];
    if (!inds.length) {
      cov.macro = false;
      return 5;
    }
    cov.macro = true;
    const find = (id: string) => inds.find((i) => i.id === id);
    let s = 5;
    const yc = find('T10Y2Y')?.value;          // inverted curve = recession signal
    if (yc != null) s += yc > 0 ? 0.8 : -1.2;
    const vix = find('VIXCLS')?.value;          // high VIX = risk-off
    if (vix != null) s += vix < 18 ? 0.8 : vix > 28 ? -1.2 : 0;
    const unrate = find('UNRATE');              // rising unemployment = headwind
    if (unrate?.trend === 'up') s -= 0.6;
    else if (unrate?.trend === 'down') s += 0.6;
    return clamp(s, 0, 10);
  }

  // --------------------------------------------------------------- HELPERS
  computeConfidence(
    completeness: number, agreement: number, recency: number, _noise = 0,
  ): number {
    // Range [0.5, 1.2]. Deterministic — _noise accepted for back-compat, ignored.
    return clamp(
      0.5 + completeness * 0.4 + agreement * 0.2 + recency * 0.1,
      0.5, 1.2,
    );
  }

  computeRankingScore(finalScore: number, anomalyScore: number, momentumBonus: number): number {
    return Math.max(finalScore + anomalyScore * 2 + momentumBonus, 0);
  }

  timeDecay(ageDays: number, halfLifeDays = 7): number {
    return Math.pow(0.5, ageDays / halfLifeDays);
  }

  private async persist(r: ScoreResult): Promise<void> {
    try {
      const stock = await this.prisma.stock.upsert({
        where: { symbol: r.symbol },
        create: { symbol: r.symbol, name: r.symbol },
        update: {},
      });
      const existing = await this.prisma.stockScore.findFirst({
        where: { stockId: stock.id },
        orderBy: { computedAt: 'desc' },
      });
      const data = {
        fundamentalScore: r.fundamental, technicalScore: r.technical,
        sentimentScore: r.sentiment, institutionalScore: r.institutional,
        analystScore: r.analyst, politicalScore: r.political, macroScore: r.macro,
        finalScore: r.finalScore, confidenceFactor: r.confidence,
        rankingScore: r.rankingScore,
      };
      if (existing) {
        await this.prisma.stockScore.update({ where: { id: existing.id }, data });
      } else {
        await this.prisma.stockScore.create({ data: { stockId: stock.id, ...data } });
      }
    } catch (e) {
      this.logger.warn(`Could not persist score for ${r.symbol}: ${e}`);
    }
  }

  // ---- legacy instance delegates (kept for test + external compatibility) ----
  computeFundamentalScore(d: any): number { return ScoringMath.computeFundamentalScore(d); }
  computeTechnicalScore(d: any): number { return ScoringMath.computeTechnicalScore(d); }

  async getTopOpportunities(limit = 10): Promise<any[]> {
    return this.prisma.stockScore.findMany({
      orderBy: { rankingScore: 'desc' },
      take: limit,
      include: { stock: true },
    });
  }
}

const round = (n: number) => Math.round(n * 100) / 100;

/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * Legacy pure helpers — retained as public so existing unit tests stay valid
 * and so other code can score a single dimension in isolation. They are NOT
 * used by computeScore(), which uses the private scoreX() methods above.
 */
export class ScoringMath {
  /** Old 4-arg confidence signature; `noise` accepted but ignored (was random). */
  static computeConfidence(
    completeness: number, agreement: number, recency: number, _noise = 0,
  ): number {
    return clamp(0.5 + completeness * 0.3 + agreement * 0.2 + recency * 0.1, 0.5, 1.2);
  }
  static computeRankingScore(finalScore: number, anomalyScore: number, momentumBonus: number): number {
    return Math.max(finalScore + anomalyScore * 2 + momentumBonus, 0);
  }
  static computeFundamentalScore(d: {
    peRatio?: number; roe?: number; revenueGrowth?: number;
    operatingMargin?: number; debtToEquity?: number;
  }): number {
    if (!d || Object.keys(d).every((k) => (d as any)[k] == null)) return 5;
    let s = 5;
    if (d.peRatio != null) s += d.peRatio < 15 ? 1 : d.peRatio > 40 ? -1 : 0;
    if (d.roe != null) s += d.roe > 0.2 ? 1 : d.roe < 0 ? -1 : 0;
    if (d.revenueGrowth != null) s += d.revenueGrowth > 0.2 ? 1 : d.revenueGrowth < 0 ? -1 : 0;
    if (d.operatingMargin != null) s += d.operatingMargin > 0.2 ? 1 : d.operatingMargin < 0 ? -1 : 0;
    if (d.debtToEquity != null) s += d.debtToEquity < 0.5 ? 0.5 : d.debtToEquity > 3 ? -1 : 0;
    return clamp(s, 0, 10);
  }
  static computeTechnicalScore(d: { rsi?: number; macdSignal?: string; priceVsMA200?: number }): number {
    if (!d) return 5;
    let s = 5;
    if (d.rsi != null) s += d.rsi < 30 ? 1.5 : d.rsi > 70 ? -1.5 : 0;
    if (d.macdSignal === 'bullish') s += 1;
    else if (d.macdSignal === 'bearish') s -= 1;
    if (d.priceVsMA200 != null) s += d.priceVsMA200 > 0.1 ? 0.5 : d.priceVsMA200 < -0.1 ? -0.5 : 0;
    return clamp(s, 0, 10);
  }
}
