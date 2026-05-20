import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AlphaService {
  constructor(private prisma: PrismaService) {}

  // A. Volume Spike — z-score vs 30d avg
  detectVolumeAnomaly(current: number, history: number[]): number {
    if (history.length < 5) return 0;
    const mean = history.reduce((a, b) => a + b, 0) / history.length;
    const std = Math.sqrt(history.reduce((s, v) => s + (v - mean) ** 2, 0) / history.length);
    if (std === 0) return 0;
    return Math.min(1, Math.max(0, ((current - mean) / std - 1) / 3));
  }

  // B. Price-Volume Divergence — high vol + flat price = accumulation
  detectDivergence(priceChangePct: number, volumeAnomaly: number): number {
    return volumeAnomaly > 0.5 && Math.abs(priceChangePct) < 0.02 ? Math.min(1, volumeAnomaly * 1.3) : 0;
  }

  // C. Sentiment velocity
  detectSentimentVelocity(mentionsCur: number, mentionsPrev: number, articlesCur: number, articlesPrev: number): number {
    const s: number[] = [];
    if (mentionsPrev > 0) s.push(Math.min(1, Math.max(0, (mentionsCur - mentionsPrev) / mentionsPrev / 3)));
    if (articlesPrev > 0) s.push(Math.min(1, Math.max(0, (articlesCur - articlesPrev) / articlesPrev / 5)));
    return s.length ? s.reduce((a, b) => a + b, 0) / s.length : 0;
  }

  // D. Insider cluster — 2+ buys within 30d
  detectInsiderActivity(trades: { type: string; daysAgo: number; value: number }[]): number {
    const buys = trades.filter(t => t.type === 'buy' && t.daysAgo <= 30);
    const sells = trades.filter(t => t.type === 'sell' && t.daysAgo <= 30);
    if (!buys.length) return 0;
    const bv = buys.reduce((s, t) => s + t.value, 0);
    const sv = sells.reduce((s, t) => s + t.value, 0);
    const cluster = buys.length >= 3 ? 0.3 : buys.length === 2 ? 0.15 : 0;
    return Math.min(1, Math.max(0, (bv - sv * 0.5) / Math.max(bv + sv, 1) + cluster));
  }

  // E. Institutional shift
  detectInstitutionalShift(cur: number, prev: number, fundsUp: number, totalFunds: number): number {
    if (prev === 0) return 0;
    const change = (cur - prev) / prev;
    const participation = totalFunds > 0 ? fundsUp / totalFunds : 0;
    return change > 0 ? Math.min(1, change * 2 + participation * 0.3) : 0;
  }

  // Master anomaly score
  computeAnomalyScore(vol: number, sent: number, insider: number, inst: number): number {
    return Math.min(1, Math.max(0, vol * 0.30 + sent * 0.25 + insider * 0.25 + inst * 0.20));
  }

  classifySignal(vol: number, sent: number, insider: number, inst: number, pricePct: number): string {
    if (insider > 0.6 && inst > 0.4) return 'SMART_MONEY_ENTRY';
    if (vol > 0.6 && Math.abs(pricePct) < 0.02) return 'ACCUMULATION';
    if (sent > 0.7 && vol > 0.5) return 'SENTIMENT_PUMP';
    if (vol > 0.7 && pricePct > 0.02) return 'MOMENTUM_IGNITION';
    if (vol > 0.5 && insider < 0.1 && pricePct < -0.03) return 'RISK_WARNING';
    return 'NEUTRAL';
  }

  isEarlyOpportunity(anomaly: number, pricePct: number): boolean {
    return anomaly > 0.45 && Math.abs(pricePct) < 0.03;
  }

  // ranking_score = final_score + (alpha_boost * anomaly_score) + momentum_bonus
  computeRankingScore(finalScore: number, anomalyScore: number, momentumBonus = 0): number {
    return Math.min(12, Math.max(0, finalScore + 2.0 * anomalyScore + momentumBonus));
  }

  async saveSignal(stockId: string, signalType: string, strength: number, drivers: string[], earlyFlag: boolean) {
    if (strength <= 0.2) return null;
    return this.prisma.stockSignal.create({
      data: {
        stockId, signalType: signalType as any, strength,
        description: drivers.join('; '),
        drivers: drivers as any,
        earlyFlag,
        expiresAt: new Date(Date.now() + 48 * 3600 * 1000),
      },
    });
  }

  getLatestSignals(stockId: string) {
    return this.prisma.stockSignal.findMany({
      where: { stockId, expiresAt: { gt: new Date() } },
      orderBy: { detectedAt: 'desc' },
      take: 10,
    });
  }

  getEarlyOpportunities() {
    return this.prisma.stockSignal.findMany({
      where: { earlyFlag: true, expiresAt: { gt: new Date() } },
      include: { stock: true },
      orderBy: { strength: 'desc' },
      take: 20,
    });
  }
}
