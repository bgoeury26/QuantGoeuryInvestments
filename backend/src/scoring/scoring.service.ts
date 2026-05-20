import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StocksService } from '../stocks/stocks.service';
import { FlowsService } from '../flows/flows.service';
import { SentimentService } from '../sentiment/sentiment.service';
import { MacroService } from '../macro/macro.service';

const W = { fundamental: 2.5, technical: 2.0, sentiment: 1.5, institutional: 2.0, analyst: 1.0, political: 0.5, macro: 0.5 };
const W_TOTAL = Object.values(W).reduce((a, b) => a + b, 0);

export interface ScoreComponents {
  fundamental: number;
  technical: number;
  sentiment: number;
  institutional: number;
  analyst: number;
  political: number;
  macro: number;
}

@Injectable()
export class ScoringService {
  constructor(
    private prisma: PrismaService,
    private stocks: StocksService,
    private flows: FlowsService,
    private sentiment: SentimentService,
    private macro: MacroService,
  ) {}

  // ── Pure math helpers ──────────────────────────────────────────────────────

  computeConfidence(completeness: number, agreement: number, recency: number, noise: number): number {
    return Math.max(0.5, Math.min(1.2, 0.7 + completeness * 0.2 + agreement * 0.15 + recency * 0.15 - noise * 0.2));
  }

  computeFinalScore(c: ScoreComponents, confidence: number): number {
    const ws =
      (c.fundamental * W.fundamental + c.technical * W.technical + c.sentiment * W.sentiment +
        c.institutional * W.institutional + c.analyst * W.analyst +
        c.political * W.political + c.macro * W.macro) / W_TOTAL;
    return Math.max(0, Math.min(10, ws * confidence));
  }

  computeRankingScore(finalScore: number, anomalyScore: number, momentumBonus = 0): number {
    return Math.min(12, Math.max(0, finalScore + 2.0 * anomalyScore + momentumBonus));
  }

  timeDecay(daysOld: number, halfLife = 7): number {
    return Math.exp(-0.693 * daysOld / halfLife);
  }

  computeFundamentalScore(d: { peRatio?: number; roe?: number; revenueGrowth?: number; operatingMargin?: number; debtToEquity?: number }): number {
    const s: number[] = [];
    if (d.peRatio != null)        s.push(d.peRatio <= 0 ? 2 : d.peRatio < 10 ? 9 : d.peRatio < 20 ? 8 : d.peRatio < 30 ? 6 : d.peRatio < 50 ? 4 : 2);
    if (d.roe != null)            s.push(d.roe > 0.25 ? 9 : d.roe > 0.15 ? 7 : d.roe > 0.08 ? 5 : d.roe > 0 ? 3 : 1);
    if (d.revenueGrowth != null)  s.push(d.revenueGrowth > 0.3 ? 9 : d.revenueGrowth > 0.15 ? 7 : d.revenueGrowth > 0.05 ? 5 : d.revenueGrowth > 0 ? 4 : 2);
    if (d.operatingMargin != null) s.push(d.operatingMargin > 0.25 ? 9 : d.operatingMargin > 0.15 ? 7 : d.operatingMargin > 0.08 ? 5 : d.operatingMargin > 0 ? 3 : 1);
    if (d.debtToEquity != null)   s.push(d.debtToEquity < 0.3 ? 9 : d.debtToEquity < 0.7 ? 7 : d.debtToEquity < 1.5 ? 5 : d.debtToEquity < 3 ? 3 : 1);
    return s.length ? s.reduce((a, b) => a + b, 0) / s.length : 5;
  }

  computeTechnicalScore(d: { rsi?: number; macdSignal?: string; priceVsMA200?: number }): number {
    const s: number[] = [];
    if (d.rsi != null)        s.push(d.rsi < 20 ? 9 : d.rsi < 35 ? 7 : d.rsi < 50 ? 6 : d.rsi < 65 ? 6 : d.rsi < 75 ? 4 : 2);
    if (d.macdSignal)         s.push(d.macdSignal === 'bullish' ? 8 : d.macdSignal === 'neutral' ? 5 : 2);
    if (d.priceVsMA200 != null) s.push(d.priceVsMA200 > 0.1 ? 8 : d.priceVsMA200 > 0 ? 6 : d.priceVsMA200 > -0.1 ? 4 : 2);
    return s.length ? s.reduce((a, b) => a + b, 0) / s.length : 5;
  }

  // ── Full symbol-based score computation (called by ReportsService) ─────────

  async computeScore(symbol: string): Promise<{ components: ScoreComponents; finalScore: number; confidence: number; anomalyScore: number; rankingScore: number }> {
    // Gather all available data in parallel, never throw
    const [fundamentals, technicals, sentimentData, flowsData] = await Promise.allSettled([
      this.stocks.getFundamentals(symbol).catch(() => null),
      this.stocks.getTechnicals(symbol).catch(() => null),
      this.sentiment.getSentimentScore(symbol).catch(() => null),
      this.flows.getSummary(symbol).catch(() => null),
    ]);

    const fund = fundamentals.status === 'fulfilled' ? fundamentals.value : null;
    const tech = technicals.status   === 'fulfilled' ? technicals.value  : null;
    const sent = sentimentData.status === 'fulfilled' ? sentimentData.value : null;
    const flow = flowsData.status    === 'fulfilled' ? flowsData.value   : null;

    const fundScore  = this.computeFundamentalScore({
      peRatio:        fund?.peRatio,
      roe:            fund?.roe,
      revenueGrowth:  fund?.revenueGrowth,
      operatingMargin: fund?.operatingMargin,
      debtToEquity:   fund?.debtToEquity,
    });

    const techScore  = this.computeTechnicalScore({
      rsi:          tech?.rsi,
      macdSignal:   tech?.macdSignal,
      priceVsMA200: tech?.priceVsMA200,
    });

    const sentScore  = sent?.score ?? 5;
    const instScore  = flow?.institutionalScore ?? 5;
    const analystScr = 5; // Analyst ratings fetched separately
    const polScore   = flow?.politicalScore ?? 5;
    const macroScore = (await this.macro.getMacroScore().catch(() => ({ score: 5 }))).score;

    const components: ScoreComponents = {
      fundamental:   fundScore,
      technical:     techScore,
      sentiment:     sentScore,
      institutional: instScore,
      analyst:       analystScr,
      political:     polScore,
      macro:         macroScore,
    };

    // Confidence: based on data completeness
    const completeness = [fund, tech, sent, flow].filter(Boolean).length / 4;
    const confidence   = this.computeConfidence(completeness, 0.6, 0.8, 0.2);
    const anomalyScore = flow?.anomalyScore ?? 0;
    const finalScore   = this.computeFinalScore(components, confidence);
    const rankingScore = this.computeRankingScore(finalScore, anomalyScore);

    return { components, finalScore, confidence, anomalyScore, rankingScore };
  }

  // ── DB persistence ─────────────────────────────────────────────────────────

  async saveScore(stockId: string, c: ScoreComponents, confidence: number, anomalyScore: number, rankingScore: number) {
    return this.prisma.stockScore.create({
      data: {
        stockId,
        ...c,
        finalScore:        this.computeFinalScore(c, confidence),
        confidenceFactor:  confidence,
        anomalyScore,
        rankingScore,
        fundamentalScore:  c.fundamental,
        technicalScore:    c.technical,
        sentimentScore:    c.sentiment,
        institutionalScore: c.institutional,
        analystScore:      c.analyst,
        politicalScore:    c.political,
        macroScore:        c.macro,
      },
    });
  }

  getLatestScore(stockId: string) {
    return this.prisma.stockScore.findFirst({ where: { stockId }, orderBy: { computedAt: 'desc' } });
  }

  async getTopOpportunities(limit = 10) {
    const all = await this.prisma.stockScore.findMany({
      distinct: ['stockId'],
      orderBy:  { computedAt: 'desc' },
      include:  { stock: true },
      take:     100,
    });
    return all.sort((a, b) => b.rankingScore - a.rankingScore).slice(0, limit);
  }
}
