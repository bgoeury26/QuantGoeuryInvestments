import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

export interface ScoreComponents {
  fundamental: number;   // 0-10
  technical: number;     // 0-10
  sentiment: number;     // 0-10
  institutional: number; // 0-10
  analyst: number;       // 0-10
  political: number;     // 0-10
  macro: number;         // 0-10
}

export interface ConfidenceInputs {
  dataCompleteness: number; // 0-1
  signalAgreement: number;  // 0-1
  recency: number;          // 0-1
  noiseLevel: number;       // 0-1
}

// Scoring Engine V2 — weights sum to 10
const WEIGHTS = {
  fundamental: 2.5, technical: 2.0, sentiment: 1.5,
  institutional: 2.0, analyst: 1.0, political: 0.5, macro: 0.5,
};
const TOTAL_WEIGHT = Object.values(WEIGHTS).reduce((a, b) => a + b, 0);

@Injectable()
export class ScoringService {
  constructor(private prisma: PrismaService) {}

  // Z-score normalization → maps value to 0-10
  normalize(value: number, mean: number, std: number): number {
    if (std === 0) return 5;
    const z = (value - mean) / std;
    return Math.max(0, Math.min(10, 10 / (1 + Math.exp(-z))));
  }

  // Time decay: recent data weighted more (half-life in days)
  timeDecay(daysOld: number, halfLife = 7): number {
    return Math.exp(-0.693 * daysOld / halfLife);
  }

  // Confidence factor: 0.5 → 1.2
  computeConfidence(inputs: ConfidenceInputs): number {
    const cf = 0.7
      + inputs.dataCompleteness * 0.2
      + inputs.signalAgreement * 0.15
      + inputs.recency * 0.15
      - inputs.noiseLevel * 0.2;
    return Math.max(0.5, Math.min(1.2, cf));
  }

  // Final score = weighted_sum × confidence_factor
  computeFinalScore(c: ScoreComponents, confidence: number): number {
    const ws = (
      c.fundamental   * WEIGHTS.fundamental +
      c.technical     * WEIGHTS.technical +
      c.sentiment     * WEIGHTS.sentiment +
      c.institutional * WEIGHTS.institutional +
      c.analyst       * WEIGHTS.analyst +
      c.political     * WEIGHTS.political +
      c.macro         * WEIGHTS.macro
    ) / TOTAL_WEIGHT;
    return Math.max(0, Math.min(10, ws * confidence));
  }

  computeFundamentalScore(d: {
    peRatio?: number; roe?: number; revenueGrowth?: number;
    operatingMargin?: number; debtToEquity?: number;
  }): number {
    const scores: number[] = [];
    if (d.peRatio != null) scores.push(d.peRatio <= 0 ? 2 : d.peRatio < 15 ? 9 : d.peRatio < 25 ? 7 : d.peRatio < 40 ? 5 : 2);
    if (d.roe != null) scores.push(d.roe > 0.25 ? 9 : d.roe > 0.15 ? 7 : d.roe > 0.08 ? 5 : d.roe > 0 ? 3 : 1);
    if (d.revenueGrowth != null) scores.push(d.revenueGrowth > 0.3 ? 9 : d.revenueGrowth > 0.15 ? 7 : d.revenueGrowth > 0.05 ? 5 : 2);
    if (d.operatingMargin != null) scores.push(d.operatingMargin > 0.25 ? 9 : d.operatingMargin > 0.15 ? 7 : d.operatingMargin > 0.05 ? 4 : 1);
    if (d.debtToEquity != null) scores.push(d.debtToEquity < 0.3 ? 9 : d.debtToEquity < 1 ? 7 : d.debtToEquity < 2 ? 4 : 1);
    return scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 5;
  }

  computeTechnicalScore(d: {
    rsi?: number; macdSignal?: string;
    priceVsMA200?: number; volumeRatio?: number;
  }): number {
    const scores: number[] = [];
    if (d.rsi != null) scores.push(d.rsi < 25 ? 9 : d.rsi < 40 ? 7 : d.rsi < 60 ? 5 : d.rsi < 75 ? 3 : 1);
    if (d.macdSignal) scores.push(d.macdSignal === "bullish" ? 8 : d.macdSignal === "neutral" ? 5 : 2);
    if (d.priceVsMA200 != null) scores.push(d.priceVsMA200 > 0.1 ? 8 : d.priceVsMA200 > 0 ? 6 : d.priceVsMA200 > -0.1 ? 4 : 2);
    return scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 5;
  }

  async saveScore(stockId: string, components: ScoreComponents, confidence: number, anomalyScore: number, rankingScore: number) {
    const finalScore = this.computeFinalScore(components, confidence);
    return this.prisma.stockScore.create({
      data: {
        stockId, ...components,
        fundamentalScore: components.fundamental, technicalScore: components.technical,
        sentimentScore: components.sentiment, institutionalScore: components.institutional,
        analystScore: components.analyst, politicalScore: components.political, macroScore: components.macro,
        finalScore, confidenceFactor: confidence, anomalyScore, rankingScore,
      },
    });
  }

  getLatestScore(stockId: string) {
    return this.prisma.stockScore.findFirst({ where: { stockId }, orderBy: { computedAt: "desc" } });
  }

  async getTopOpportunities(limit = 10) {
    const scores = await this.prisma.stockScore.findMany({
      distinct: ["stockId"],
      orderBy: { computedAt: "desc" },
      include: { stock: true },
      take: 100,
    });
    return scores.sort((a, b) => b.rankingScore - a.rankingScore).slice(0, limit);
  }
}
