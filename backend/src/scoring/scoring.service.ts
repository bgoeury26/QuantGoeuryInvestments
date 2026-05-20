import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface ScoreComponents {
  fundamental: number;
  technical: number;
  sentiment: number;
  institutional: number;
  analyst: number;
  political: number;
  macro: number;
}

export interface ConfidenceInputs {
  dataCompleteness: number;
  signalAgreement: number;
  recency: number;
  noiseLevel: number;
}

const WEIGHTS = {
  fundamental: 2.5,
  technical: 2.0,
  sentiment: 1.5,
  institutional: 2.0,
  analyst: 1.0,
  political: 0.5,
  macro: 0.5,
};

const TOTAL_WEIGHT = Object.values(WEIGHTS).reduce((a, b) => a + b, 0);

@Injectable()
export class ScoringService {
  constructor(private prisma: PrismaService) {}

  timeDecay(daysOld: number, halfLife = 7): number {
    return Math.exp(-0.693 * daysOld / halfLife);
  }

  computeConfidence(inputs: ConfidenceInputs): number {
    const confidence = 0.7
      + inputs.dataCompleteness * 0.2
      + inputs.signalAgreement * 0.15
      + inputs.recency * 0.15
      - inputs.noiseLevel * 0.2;
    return Math.max(0.5, Math.min(1.2, confidence));
  }

  computeFinalScore(components: ScoreComponents, confidence: number): number {
    const weightedSum =
      (components.fundamental * WEIGHTS.fundamental +
      components.technical * WEIGHTS.technical +
      components.sentiment * WEIGHTS.sentiment +
      components.institutional * WEIGHTS.institutional +
      components.analyst * WEIGHTS.analyst +
      components.political * WEIGHTS.political +
      components.macro * WEIGHTS.macro) / TOTAL_WEIGHT;
    return Math.max(0, Math.min(10, weightedSum * confidence));
  }

  computeFundamentalScore(data: {
    peRatio?: number; pbRatio?: number; roe?: number;
    revenueGrowth?: number; earningsGrowth?: number;
    debtToEquity?: number; operatingMargin?: number;
  }): number {
    const scores: number[] = [];
    if (data.peRatio != null) {
      scores.push(data.peRatio <= 0 ? 2 : data.peRatio < 10 ? 9 : data.peRatio < 20 ? 8 : data.peRatio < 30 ? 6 : data.peRatio < 50 ? 4 : 2);
    }
    if (data.revenueGrowth != null) {
      scores.push(data.revenueGrowth > 0.3 ? 9 : data.revenueGrowth > 0.15 ? 7 : data.revenueGrowth > 0.05 ? 5 : data.revenueGrowth > 0 ? 4 : 2);
    }
    if (data.roe != null) {
      scores.push(data.roe > 0.25 ? 9 : data.roe > 0.15 ? 7 : data.roe > 0.08 ? 5 : data.roe > 0 ? 3 : 1);
    }
    if (data.operatingMargin != null) {
      scores.push(data.operatingMargin > 0.25 ? 9 : data.operatingMargin > 0.15 ? 7 : data.operatingMargin > 0.08 ? 5 : data.operatingMargin > 0 ? 3 : 1);
    }
    if (data.debtToEquity != null) {
      scores.push(data.debtToEquity < 0.3 ? 9 : data.debtToEquity < 0.7 ? 7 : data.debtToEquity < 1.5 ? 5 : data.debtToEquity < 3 ? 3 : 1);
    }
    return scores.length === 0 ? 5 : scores.reduce((a, b) => a + b, 0) / scores.length;
  }

  computeTechnicalScore(data: {
    rsi?: number; macdSignal?: 'bullish' | 'bearish' | 'neutral';
    priceVsMA200?: number; volumeRatio?: number;
  }): number {
    const scores: number[] = [];
    if (data.rsi != null) {
      scores.push(data.rsi < 20 ? 9 : data.rsi < 35 ? 7 : data.rsi < 50 ? 6 : data.rsi < 65 ? 6 : data.rsi < 75 ? 4 : 2);
    }
    if (data.macdSignal) {
      scores.push(data.macdSignal === 'bullish' ? 8 : data.macdSignal === 'neutral' ? 5 : 2);
    }
    if (data.priceVsMA200 != null) {
      scores.push(data.priceVsMA200 > 0.1 ? 8 : data.priceVsMA200 > 0 ? 6 : data.priceVsMA200 > -0.1 ? 4 : 2);
    }
    return scores.length === 0 ? 5 : scores.reduce((a, b) => a + b, 0) / scores.length;
  }

  computeRankingScore(finalScore: number, anomalyScore: number, momentumBonus = 0): number {
    return Math.min(12, Math.max(0, finalScore + 2.0 * anomalyScore + momentumBonus));
  }

  async saveScore(stockId: string, components: ScoreComponents, confidence: number, anomalyScore: number, rankingScore: number) {
    const finalScore = this.computeFinalScore(components, confidence);
    return this.prisma.stockScore.create({
      data: {
        stockId,
        fundamentalScore: components.fundamental,
        technicalScore: components.technical,
        sentimentScore: components.sentiment,
        institutionalScore: components.institutional,
        analystScore: components.analyst,
        politicalScore: components.political,
        macroScore: components.macro,
        finalScore,
        confidenceFactor: confidence,
        anomalyScore,
        rankingScore,
      },
    });
  }

  getLatestScore(stockId: string) {
    return this.prisma.stockScore.findFirst({
      where: { stockId },
      orderBy: { computedAt: 'desc' },
    });
  }

  async getTopOpportunities(limit = 10) {
    const scores = await this.prisma.stockScore.findMany({
      distinct: ['stockId'],
      orderBy: { computedAt: 'desc' },
      include: { stock: true },
      take: 100,
    });
    return scores.sort((a, b) => b.rankingScore - a.rankingScore).slice(0, limit);
  }
}
