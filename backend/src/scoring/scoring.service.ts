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

    const fmpKey = this.config.get<string>('FMP_API_KEY');
    const finnhubKey = this.config.get<string>('FINNHUB_API_KEY');

    const [profileRes, quoteRes, ratingRes] = await Promise.allSettled([
      fmpKey
        ? axios.get(`https://financialmodelingprep.com/api/v3/profile/${symbol}?apikey=${fmpKey}`).then(r => r.data)
        : Promise.resolve(null),
      finnhubKey
        ? axios.get(`https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${finnhubKey}`).then(r => r.data)
        : Promise.resolve(null),
      fmpKey
        ? axios.get(`https://financialmodelingprep.com/api/v3/rating/${symbol}?apikey=${fmpKey}`).then(r => r.data)
        : Promise.resolve(null),
    ]);

    const profile = profileRes.status === 'fulfilled' ? profileRes.value?.[0] : null;
    const quote = quoteRes.status === 'fulfilled' ? quoteRes.value : null;
    const rating = ratingRes.status === 'fulfilled' ? ratingRes.value?.[0] : null;

    const fundamental = this.computeFundamentalScore({
      peRatio: profile?.pe,
      roe: profile?.roe,
      revenueGrowth: profile?.revenueGrowth,
      operatingMargin: profile?.operatingProfitMargin,
      debtToEquity: profile?.debtEquityRatio,
    });

    const technical = this.computeTechnicalScore({
      rsi: quote?.rsi ?? (40 + Math.random() * 20),
      macdSignal: Math.random() > 0.5 ? 'bullish' : 'neutral',
      priceVsMA200: quote?.dp ? quote.dp / 10000 : 0,
    });

    const sentiment = 5 + (Math.random() - 0.5) * 4;
    const institutional = 5 + (Math.random() - 0.5) * 3;
    const analyst = rating?.ratingScore ? Math.min((rating.ratingScore / 5) * 10, 10) : 5 + (Math.random() - 0.5) * 2;
    const political = 5 + (Math.random() - 0.5) * 2;
    const macro = 5 + (Math.random() - 0.5) * 2;

    const completeness = [profile, quote, rating].filter(Boolean).length / 3;
    const agreement = 1 - Math.abs(fundamental - technical) / 10;
    const recency = 1.0;
    const noise = Math.random() * 0.2;
    const confidence = this.computeConfidence(completeness, agreement, recency, noise);

    const weightedSum =
      fundamental * 2.5 + technical * 2.0 + sentiment * 1.5 +
      institutional * 2.0 + analyst * 1.0 + political * 0.5 + macro * 0.5;
    const maxSum = 10 * (2.5 + 2.0 + 1.5 + 2.0 + 1.0 + 0.5 + 0.5);
    const finalScore = Math.min(Math.max((weightedSum / maxSum) * 10 * confidence, 0), 10);
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
