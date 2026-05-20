import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

// ============================================================
// ALPHA ENGINE — HIDDEN SIGNAL DETECTION SYSTEM
// Detects unusual activity BEFORE major price moves
// ============================================================

@Injectable()
export class AlphaService {
  constructor(private prisma: PrismaService) {}

  // A. Volume Spike Detection — Z-score vs 30-day average
  detectVolumeAnomaly(currentVolume: number, volumes30d: number[]): number {
    if (volumes30d.length < 5) return 0;
    const mean = volumes30d.reduce((a, b) => a + b, 0) / volumes30d.length;
    const std = Math.sqrt(volumes30d.reduce((s, v) => s + (v - mean) ** 2, 0) / volumes30d.length);
    if (std === 0) return 0;
    const z = (currentVolume - mean) / std;
    return Math.min(1, Math.max(0, (z - 1) / 3));
  }

  // B. Price-Volume Divergence: flat price + high volume = accumulation
  detectPriceVolumeDivergence(priceChangePct: number, volumeAnomaly: number): number {
    if (volumeAnomaly > 0.5 && Math.abs(priceChangePct) < 0.02)
      return Math.min(1, volumeAnomaly * 1.3);
    return 0;
  }

  // C. Social Attention Spike
  detectSentimentVelocity(mentionsCurrent: number, mentionsPrev: number, articlesCurrent: number, articlesPrev: number, wikiRatio = 1): number {
    const scores: number[] = [];
    if (mentionsPrev > 0) scores.push(Math.min(1, Math.max(0, (mentionsCurrent - mentionsPrev) / mentionsPrev / 3)));
    if (articlesPrev > 0) scores.push(Math.min(1, Math.max(0, (articlesCurrent - articlesPrev) / articlesPrev / 5)));
    if (wikiRatio > 1) scores.push(Math.min(1, (wikiRatio - 1) / 4));
    return scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
  }

  // D. Insider Cluster Activity
  detectInsiderActivity(trades: Array<{ type: string; daysAgo: number; value: number }>): number {
    const recentBuys = trades.filter(t => t.type === "buy" && t.daysAgo <= 30);
    const recentSells = trades.filter(t => t.type === "sell" && t.daysAgo <= 30);
    if (!recentBuys.length) return 0;
    const buyVal = recentBuys.reduce((s, t) => s + t.value, 0);
    const sellVal = recentSells.reduce((s, t) => s + t.value, 0);
    const cluster = recentBuys.length >= 3 ? 0.3 : recentBuys.length === 2 ? 0.15 : 0;
    const net = (buyVal - sellVal * 0.5) / Math.max(buyVal + sellVal, 1);
    return Math.min(1, Math.max(0, net + cluster));
  }

  // E. Institutional Rotation
  detectInstitutionalShift(currentHoldings: number, prevHoldings: number, numFundsIncreasing: number, totalFunds: number): number {
    if (prevHoldings === 0) return 0;
    const change = (currentHoldings - prevHoldings) / prevHoldings;
    const participation = totalFunds > 0 ? numFundsIncreasing / totalFunds : 0;
    return change > 0 ? Math.min(1, change * 2 + participation * 0.3) : 0;
  }

  // Master Anomaly Score
  computeAnomalyScore(vol: number, sent: number, insider: number, inst: number): number {
    return Math.min(1, vol * 0.30 + sent * 0.25 + insider * 0.25 + inst * 0.20);
  }

  // Signal Classification
  classifySignal(vol: number, sent: number, insider: number, inst: number, pricePct: number): string {
    if (insider > 0.6 && inst > 0.4) return "SMART_MONEY_ENTRY";
    if (vol > 0.6 && Math.abs(pricePct) < 0.02) return "ACCUMULATION";
    if (sent > 0.7 && vol > 0.5) return "SENTIMENT_PUMP";
    if (vol > 0.7 && pricePct > 0.02) return "MOMENTUM_IGNITION";
    if (vol > 0.5 && pricePct < -0.03) return "RISK_WARNING";
    return "NEUTRAL";
  }

  // Early Opportunity: high anomaly + price hasn't moved yet
  isEarlyOpportunity(anomalyScore: number, priceChangePct: number): boolean {
    return anomalyScore > 0.45 && Math.abs(priceChangePct) < 0.03;
  }

  // Ranking Score = final_score + (alpha_boost × anomaly_score) + momentum_bonus
  computeRankingScore(finalScore: number, anomalyScore: number, momentumBonus = 0): number {
    return Math.min(12, Math.max(0, finalScore + 2.0 * anomalyScore + momentumBonus));
  }

  async persistSignal(stockId: string, signalType: string, strength: number, drivers: string[], earlyFlag: boolean) {
    if (strength > 0.3) {
      await this.prisma.stockSignal.create({
        data: {
          stockId, signalType: signalType as any, strength,
          description: drivers.join("; "), drivers: drivers as any,
          earlyFlag, expiresAt: new Date(Date.now() + 48 * 3600 * 1000),
        },
      });
    }
  }

  getLatestSignals(stockId: string) {
    return this.prisma.stockSignal.findMany({
      where: { stockId, expiresAt: { gt: new Date() } },
      orderBy: { detectedAt: "desc" },
      take: 10,
    });
  }

  getEarlyOpportunities() {
    return this.prisma.stockSignal.findMany({
      where: { earlyFlag: true, expiresAt: { gt: new Date() } },
      include: { stock: true },
      orderBy: { strength: "desc" },
      take: 20,
    });
  }
}
