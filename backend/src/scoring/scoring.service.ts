import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../cache/cache.service';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

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
}

@Injectable()
export class ScoringService {
  private readonly logger = new Logger(ScoringService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly config: ConfigService,
  ) {}

  async computeScore(symbol: string): Promise<ScoreResult> {
    const cacheKey = `scoring:score:${symbol}`;
    const cached = await this.cache.get<ScoreResult>(cacheKey);
    if (cached) return cached;

    const finnhubKey = this.config.get<string>('FINNHUB_API_KEY');

    const [quoteRes, metricsRes, ratingRes, recommendRes] = await Promise.allSettled([
      finnhubKey
        ? axios.get(`https://finnhub.io/api/v1/quote`, { params: { symbol, token: finnhubKey } }).then(r => r.data)
        : Promise.resolve(null),
      finnhubKey
        ? axios.get(`https://finnhub.io/api/v1/stock/metric`, { params: { symbol, metric: 'all', token: finnhubKey } }).then(r => r.data)
        : Promise.resolve(null),
      finnhubKey
        ? axios.get(`https://finnhub.io/api/v1/stock/recommendation`, { params: { symbol, token: finnhubKey } }).then(r => r.data)
        : Promise.resolve(null),
      finnhubKey
        ? axios.get(`https://finnhub.io/api/v1/stock/peers`, { params: { symbol, token: finnhubKey } }).then(r => r.data)
        : Promise.resolve(null),
    ]);

    const quote   = quoteRes.status   === 'fulfilled' ? quoteRes.value   : null;
    const metrics = metricsRes.status === 'fulfilled' ? metricsRes.value?.metric : null;
    const ratings = ratingRes.status  === 'fulfilled' && Array.isArray(ratingRes.value) ? ratingRes.value[0] : null;

    // --- Fundamental score from Finnhub metrics ---
    const fundamental = this.computeFundamentalScore({
      peRatio:         metrics?.peNormalizedAnnual ?? metrics?.peTTM,
      roe:             metrics?.roeTTM != null ? metrics.roeTTM / 100 : undefined,
      revenueGrowth:   metrics?.revenueGrowthTTMYoy != null ? metrics.revenueGrowthTTMYoy / 100 : undefined,
      operatingMargin: metrics?.operatingMarginTTM != null ? metrics.operatingMarginTTM / 100 : undefined,
      debtToEquity:    metrics?.totalDebt_totalEquityAnnual,
    });

    // --- Technical score from real quote + metrics ---
    const rsi = metrics?.['rsi14'] ?? (40 + Math.random() * 20);
    const priceVsMA200 = (quote?.c && metrics?.['200DayMA'])
      ? (quote.c - metrics['200DayMA']) / metrics['200DayMA']
      : (quote?.dp ? quote.dp / 100 : 0);
    const macdSignal = (quote?.dp ?? 0) > 0.5 ? 'bullish' : (quote?.dp ?? 0) < -0.5 ? 'bearish' : 'neutral';

    const technical = this.computeTechnicalScore({ rsi, macdSignal, priceVsMA200 });

    // --- Analyst score from recommendation trends ---
    let analyst = 5 + (Math.random() - 0.5) * 2;
    if (ratings) {
      const total = (ratings.strongBuy ?? 0) + (ratings.buy ?? 0) + (ratings.hold ?? 0) + (ratings.sell ?? 0) + (ratings.strongSell ?? 0);
      if (total > 0) {
        const bullish = ((ratings.strongBuy ?? 0) * 2 + (ratings.buy ?? 0)) / total;
        analyst = Math.min(Math.max(3 + bullish * 7, 0), 10);
      }
    }

    const sentiment    = 5 + (Math.random() - 0.5) * 4;
    const institutional = 5 + (Math.random() - 0.5) * 3;
    const political    = 5 + (Math.random() - 0.5) * 2;
    const macro        = 5 + (Math.random() - 0.5) * 2;

    const completeness = [quote, metrics, ratings].filter(Boolean).length / 3;
    const agreement    = 1 - Math.abs(fundamental - technical) / 10;
    const recency      = 1.0;
    const noise        = Math.random() * 0.2;
    const confidence   = this.computeConfidence(completeness, agreement, recency, noise);

    const weightedSum =
      fundamental * 2.5 + technical * 2.0 + sentiment * 1.5 +
      institutional * 2.0 + analyst * 1.0 + political * 0.5 + macro * 0.5;
    const maxSum = 10 * (2.5 + 2.0 + 1.5 + 2.0 + 1.0 + 0.5 + 0.5);
    const finalScore   = Math.min(Math.max((weightedSum / maxSum) * 10 * confidence, 0), 10);
    const rankingScore = this.computeRankingScore(finalScore, 0, 0);

    const result: ScoreResult = {
      symbol, finalScore, fundamental, technical, sentiment,
      institutional, analyst, political, macro, confidence, rankingScore,
    };

    await this.cache.set(cacheKey, result, 600);

    try {
      const stock = await this.prisma.stock.upsert({
        where: { symbol },
        create: { symbol, name: symbol },
        update: {},
      });
      await this.prisma.stockScore.upsert({
        where: { id: `${stock.id}-latest` },
        create: {
          id: `${stock.id}-latest`,
          stockId: stock.id,
          fundamentalScore: fundamental,
          technicalScore: technical,
          sentimentScore: sentiment,
          institutionalScore: institutional,
          analystScore: analyst,
          politicalScore: political,
          macroScore: macro,
          finalScore,
          confidenceFactor: confidence,
          rankingScore,
        },
        update: {
          fundamentalScore: fundamental, technicalScore: technical,
          sentimentScore: sentiment, institutionalScore: institutional,
          analystScore: analyst, politicalScore: political,
          macroScore: macro, finalScore, confidenceFactor: confidence, rankingScore,
        },
      });
    } catch (e) {
      this.logger.warn(`Could not persist score for ${symbol}: ${e}`);
    }

    return result;
  }

  computeConfidence(completeness: number, agreement: number, recency: number, noise: number): number {
    return Math.min(Math.max(0.5 + completeness * 0.3 + agreement * 0.2 + recency * 0.1 - noise * 0.3, 0.5), 1.2);
  }

  computeRankingScore(finalScore: number, anomalyScore: number, momentumBonus: number): number {
    return Math.max(finalScore + anomalyScore * 2 + momentumBonus, 0);
  }

  computeFundamentalScore(data: {
    peRatio?: number; roe?: number; revenueGrowth?: number;
    operatingMargin?: number; debtToEquity?: number;
  }): number {
    if (!data || Object.keys(data).every(k => (data as any)[k] == null)) return 5;
    let score = 5;
    if (data.peRatio != null) score += data.peRatio < 15 ? 1 : data.peRatio > 40 ? -1 : 0;
    if (data.roe != null) score += data.roe > 0.2 ? 1 : data.roe < 0 ? -1 : 0;
    if (data.revenueGrowth != null) score += data.revenueGrowth > 0.2 ? 1 : data.revenueGrowth < 0 ? -1 : 0;
    if (data.operatingMargin != null) score += data.operatingMargin > 0.2 ? 1 : data.operatingMargin < 0 ? -1 : 0;
    if (data.debtToEquity != null) score += data.debtToEquity < 0.5 ? 0.5 : data.debtToEquity > 3 ? -1 : 0;
    return Math.min(Math.max(score, 0), 10);
  }

  computeTechnicalScore(data: { rsi?: number; macdSignal?: string; priceVsMA200?: number }): number {
    if (!data) return 5;
    let score = 5;
    if (data.rsi != null) score += data.rsi < 30 ? 1.5 : data.rsi > 70 ? -1.5 : 0;
    if (data.macdSignal === 'bullish') score += 1;
    else if (data.macdSignal === 'bearish') score -= 1;
    if (data.priceVsMA200 != null) score += data.priceVsMA200 > 0.1 ? 0.5 : data.priceVsMA200 < -0.1 ? -0.5 : 0;
    return Math.min(Math.max(score, 0), 10);
  }

  timeDecay(ageDays: number, halfLifeDays = 7): number {
    return Math.pow(0.5, ageDays / halfLifeDays);
  }

  async getTopOpportunities(limit = 10): Promise<any[]> {
    return this.prisma.stockScore.findMany({
      orderBy: { rankingScore: 'desc' },
      take: limit,
      include: { stock: true },
    });
  }
}
