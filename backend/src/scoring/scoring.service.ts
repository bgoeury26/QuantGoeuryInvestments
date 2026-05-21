import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

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
}

@Injectable()
export class ScoringService {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private http: HttpService,
  ) {}

  async computeScore(symbol: string): Promise<ScoreResult> {
    const [fund, tech, sent, inst, ana, pol, mac] = await Promise.all([
      this.getFundamental(symbol),
      this.getTechnical(symbol),
      this.getSentiment(symbol),
      this.getInstitutional(symbol),
      this.getAnalyst(symbol),
      this.getPolitical(symbol),
      this.getMacro(),
    ]);

    const weights = {
      fundamental: 2.5,
      technical: 2.0,
      sentiment: 1.5,
      institutional: 2.0,
      analyst: 1.0,
      political: 0.5,
      macro: 0.5,
    };
    const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);

    const rawScore =
      (fund * weights.fundamental +
        tech * weights.technical +
        sent * weights.sentiment +
        inst * weights.institutional +
        ana * weights.analyst +
        pol * weights.political +
        mac * weights.macro) /
      totalWeight;

    const dataSources = [fund, tech, sent, inst, ana].filter((v) => v > 0).length;
    const confidence = Math.min(0.5 + dataSources * 0.14, 1.2);

    const finalScore = Math.min(rawScore * confidence * 10, 10);

    return {
      symbol,
      finalScore: Math.round(finalScore * 100) / 100,
      confidence: Math.round(confidence * 100) / 100,
      fundamental: fund,
      technical: tech,
      sentiment: sent,
      institutional: inst,
      analyst: ana,
      political: pol,
      macro: mac,
    };
  }

  async getLatestScore(stockId: string): Promise<ScoreResult | null> {
    const stock = await this.prisma.stock.findUnique({ where: { id: stockId } });
    if (!stock) return null;
    return this.computeScore(stock.symbol);
  }

  private async getFundamental(symbol: string): Promise<number> {
    try {
      const key = this.config.get<string>('FMP_API_KEY');
      if (!key) return 0.5;
      const res = await firstValueFrom(
        this.http.get(
          `https://financialmodelingprep.com/api/v3/ratios-ttm/${symbol}?apikey=${key}`,
        ),
      );
      const d = res.data?.[0];
      if (!d) return 0.5;
      let score = 0.5;
      if (d.peRatioTTM > 0 && d.peRatioTTM < 30) score += 0.15;
      if (d.debtEquityRatioTTM < 1) score += 0.1;
      if (d.returnOnEquityTTM > 0.1) score += 0.15;
      if (d.currentRatioTTM > 1.5) score += 0.1;
      return Math.min(score, 1);
    } catch (_) {
      return 0.5;
    }
  }

  private async getTechnical(symbol: string): Promise<number> {
    try {
      const key = this.config.get<string>('FINNHUB_API_KEY');
      if (!key) return 0.5;
      const res = await firstValueFrom(
        this.http.get(
          `https://finnhub.io/api/v1/scan/technical-indicator?symbol=${symbol}&resolution=D&token=${key}`,
        ),
      );
      const d = res.data;
      let score = 0.5;
      if (d?.technicalAnalysis?.signal === 'buy') score = 0.75;
      else if (d?.technicalAnalysis?.signal === 'sell') score = 0.25;
      return score;
    } catch (_) {
      return 0.5;
    }
  }

  private async getSentiment(_symbol: string): Promise<number> {
    return 0.5;
  }

  private async getInstitutional(_symbol: string): Promise<number> {
    return 0.5;
  }

  private async getAnalyst(symbol: string): Promise<number> {
    try {
      const key = this.config.get<string>('FINNHUB_API_KEY');
      if (!key) return 0.5;
      const res = await firstValueFrom(
        this.http.get(
          `https://finnhub.io/api/v1/stock/recommendation?symbol=${symbol}&token=${key}`,
        ),
      );
      const d = res.data?.[0];
      if (!d) return 0.5;
      const total = (d.buy || 0) + (d.hold || 0) + (d.sell || 0);
      if (!total) return 0.5;
      return Math.min((d.buy || 0) / total, 1);
    } catch (_) {
      return 0.5;
    }
  }

  private async getPolitical(_symbol: string): Promise<number> {
    return 0.5;
  }

  private async getMacro(): Promise<number> {
    return 0.5;
  }
}
