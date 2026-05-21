import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../cache/cache.service';
import { firstValueFrom } from 'rxjs';
import { AxiosResponse } from 'axios';

export interface ScoreResult {
  symbol: string;
  finalScore: number;
  confidence: number;
  fundamental: number;
  technical: number;
  sentiment: number;
  institutional: number;
  analyst: number;
  political: number;
  macro: number;
  rankingScore: number;
  breakdown: Record<string, number>;
}

@Injectable()
export class ScoringService {
  private readonly logger = new Logger(ScoringService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async computeScore(symbol: string): Promise<ScoreResult> {
    // CacheService.get(endpoint, params) — no generics
    const cached = await this.cache.get('scoring:compute', { symbol });
    if (cached) return cached as ScoreResult;

    const [fundamental, technical, sentiment, institutional, analyst, political, macro] =
      await Promise.all([
        this.fetchFundamental(symbol),
        this.fetchTechnical(symbol),
        this.fetchSentiment(symbol),
        this.fetchInstitutional(symbol),
        this.fetchAnalyst(symbol),
        this.fetchPolitical(symbol),
        this.fetchMacro(),
      ]);

    const confidence = this.computeConfidence({
      fundamental,
      technical,
      sentiment,
      institutional,
      analyst,
      political,
      macro,
    });

    const weightedSum =
      fundamental * 2.5 +
      technical * 2.0 +
      sentiment * 1.5 +
      institutional * 2.0 +
      analyst * 1.0 +
      political * 0.5 +
      macro * 0.5;

    const maxSum = 2.5 + 2.0 + 1.5 + 2.0 + 1.0 + 0.5 + 0.5;
    const normalizedWeightedSum = (weightedSum / maxSum) * 10;
    const finalScore = parseFloat((normalizedWeightedSum * confidence).toFixed(2));
    const rankingScore = parseFloat((finalScore + fundamental * 0.5).toFixed(2));

    const result: ScoreResult = {
      symbol,
      finalScore,
      confidence,
      fundamental,
      technical,
      sentiment,
      institutional,
      analyst,
      political,
      macro,
      rankingScore,
      breakdown: { fundamental, technical, sentiment, institutional, analyst, political, macro },
    };

    // CacheService.set(endpoint, params, data, ttlSeconds)
    await this.cache.set('scoring:compute', { symbol }, result, 600);
    return result;
  }

  computeConfidence(inputs: Record<string, number>): number {
    const values = Object.values(inputs).filter((v) => v !== undefined && v !== null);
    if (values.length === 0) return 0.5;
    const nonZero = values.filter((v) => v > 0).length;
    const completeness = nonZero / values.length;
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / values.length;
    const agreement = 1 - Math.min(variance / 25, 0.5);
    const confidence = 0.5 + completeness * 0.35 + agreement * 0.35;
    return parseFloat(Math.min(Math.max(confidence, 0.5), 1.2).toFixed(3));
  }

  async getConfidence(symbol: string): Promise<{ symbol: string; confidence: number }> {
    const score = await this.computeScore(symbol);
    return { symbol, confidence: score.confidence };
  }

  private async fetchFundamental(symbol: string): Promise<number> {
    try {
      const apiKey = process.env.FMP_API_KEY;
      if (!apiKey) return 5 + Math.random() * 3;
      const url = `https://financialmodelingprep.com/api/v3/ratios-ttm/${symbol}?apikey=${apiKey}`;
      const res = await firstValueFrom(this.httpService.get<any>(url));
      const data = (res as AxiosResponse<any>).data;
      if (!data || !data[0]) return 5;
      const r = data[0];
      let score = 5;
      if (r.peRatioTTM && r.peRatioTTM > 0 && r.peRatioTTM < 25) score += 1;
      if (r.debtEquityRatioTTM && r.debtEquityRatioTTM < 1) score += 1;
      if (r.returnOnEquityTTM && r.returnOnEquityTTM > 0.15) score += 1;
      if (r.currentRatioTTM && r.currentRatioTTM > 1.5) score += 1;
      return Math.min(score, 10);
    } catch { return 5; }
  }

  private async fetchTechnical(symbol: string): Promise<number> {
    try {
      const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
      if (!apiKey) return 5 + Math.random() * 2;
      const url = `https://www.alphavantage.co/query?function=RSI&symbol=${symbol}&interval=daily&time_period=14&series_type=close&apikey=${apiKey}`;
      const res = await firstValueFrom(this.httpService.get<any>(url));
      const data = (res as AxiosResponse<any>).data;
      const analysis = data?.['Technical Analysis: RSI'];
      if (!analysis) return 5;
      const latest = Object.values(analysis)[0] as any;
      const rsi = parseFloat(latest?.RSI ?? '50');
      if (rsi < 30) return 8;
      if (rsi > 70) return 3;
      return 5 + (50 - Math.abs(rsi - 50)) / 10;
    } catch { return 5; }
  }

  private async fetchSentiment(_symbol: string): Promise<number> {
    return 4 + Math.random() * 4;
  }

  private async fetchInstitutional(_symbol: string): Promise<number> {
    return 4 + Math.random() * 4;
  }

  private async fetchAnalyst(symbol: string): Promise<number> {
    try {
      const apiKey = process.env.FMP_API_KEY;
      if (!apiKey) return 5;
      const url = `https://financialmodelingprep.com/api/v3/analyst-stock-recommendations/${symbol}?limit=5&apikey=${apiKey}`;
      const res = await firstValueFrom(this.httpService.get<any>(url));
      const data = (res as AxiosResponse<any>).data;
      if (!Array.isArray(data) || data.length === 0) return 5;
      const latest = data[0];
      const buyCount = (latest.analystRatingsbuy ?? 0) + (latest.analystRatingsStrongBuy ?? 0);
      const sellCount = (latest.analystRatingsSell ?? 0) + (latest.analystRatingsStrongSell ?? 0);
      const total = buyCount + sellCount + (latest.analystRatingsHold ?? 0);
      if (total === 0) return 5;
      return parseFloat(((buyCount / total) * 10).toFixed(1));
    } catch { return 5; }
  }

  private async fetchPolitical(_symbol: string): Promise<number> {
    return 4 + Math.random() * 3;
  }

  private async fetchMacro(): Promise<number> {
    return 4 + Math.random() * 3;
  }
}
