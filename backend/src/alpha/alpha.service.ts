import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AlphaService {
  constructor(private prisma: PrismaService) {}

  detectVolumeAnomaly(currentVolume: number, volumes30d: number[]): number {
    if (volumes30d.length < 5) return 0;
    const mean = volumes30d.reduce((a, b) => a + b, 0) / volumes30d.length;
    const std = Math.sqrt(volumes30d.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / volumes30d.length);
    if (std === 0) return 0;
    const z = (currentVolume - mean) / std;
    return Math.min(1, Math.max(0, (z - 1) / 3));
  }

  detectPriceVolumeDivergence(priceChangePct: number, volumeAnomaly: number): number {
    if (volumeAnomaly > 0.5 && Math.abs(priceChangePct) < 0.02) return Math.min(1, volumeAnomaly * 1.3);
    return 0;
  }

  detectSentimentVelocity(mentionsCurrent: number, mentionsPrev: number, articlesCurrent: number, articlesPrev: number): number {
    const scores: number[] = [];
    if (mentionsPrev > 0) scores.push(Math.min(1, Math.max(0, (mentionsCurrent - mentionsPrev) / mentionsPrev / 3)));
    if (articlesPrev > 0) scores.push(Math.min(1, Math.max(0, (articlesCurrent - articlesPrev) / articlesPrev / 5)));
    return scores.length === 0 ? 0 : scores.reduce((a, b) => a + b, 0) / scores.length;
  }

  detectInsiderActivity(trades: Array<{ type: string; daysAgo: number; value: number }>): number {
    const recentBuys = trades.filter(t => t.type === 'buy' && t.daysAgo <= 30);
    const recentSells = trades.filter(t => t.type === 'sell' && t.daysAgo <= 30);
    if (recentBuys.length === 0) return 0;
    const clusterBonus = recentBuys.length >= 3 ? 0.3 : recentBuys.length === 2 ? 0.15 : 0;
    const buyValue = recentBuys.reduce((s, t) => s + t.value, 0);
    const sellValue = recentSells.reduce((s, t) => s + t.value, 0);
    return Math.min(1, Math.max(0, (buyValue - sellValue * 0.5) / Math.max(buyValue + sellValue, 1) + clusterBonus));
  }

  detectInstitutionalShift(currentHoldings: number, prevHoldings: number, numFundsIncreasing: number, totalFunds: number): number {
    if (prevHoldings === 0) return 0;
    const change = (currentHoldings - prevHoldings) / prevHoldings;
    if (change <= 0) return 0;
    const participation = totalFunds > 0 ? numFundsIncreasing / totalFunds : 0;
    return Math.min(1, change * 2 + participation * 0.3);
  }

  computeAnomalyScore(volumeAnomaly: number, sentimentVelocity: number, insiderActivity: number, institutionalShift: number): number {
    return Math.min(1, Math.max(0,
      volumeAnomaly * 0.30 +
      sentimentVelocity * 0.25 +
      insiderActivity * 0.25 +
      institutionalShift * 0.20
    ));
  }

  classifySignal(vA: number, sV: number, iA: number, iS: number, pricePct: number): string {
    if (iA > 0.6 && iS > 0.4) return 'SMART_MONEY_ENTRY';
    if (vA > 0.6 && Math.abs(pricePct) < 0.02) return 'ACCUMULATION';
    if (sV > 0.7 && vA > 0.5) return 'SENTIMENT_PUMP';
    if (vA > 0.7 && pricePct > 0.02) return 'MOMENTUM_IGNITION';
    if (vA > 0.5 && iA < 0.1 && pricePct < -0.03) return 'RISK_WARNING';
    return 'NEUTRAL';
  }

  isEarlyOpportunity(anomalyScore: number, priceChangePct: number): boolean {
    return anomalyScore > 0.45 && Math.abs(priceChangePct) < 0.03;
  }

  async getLatestSignals(stockId: string) {
    return this.prisma.stockSignal.findMany({
      where: { stockId, expiresAt: { gt: new Date() } },
      orderBy: { detectedAt: 'desc' },
      take: 10,
    });
  }

  async getEarlyOpportunities() {
    return this.prisma.stockSignal.findMany({
      where: { earlyFlag: true, expiresAt: { gt: new Date() } },
      include: { stock: true },
      orderBy: { strength: 'desc' },
      take: 20,
    });
  }

  async saveSignal(stockId: string, signalType: string, strength: number, drivers: string[], earlyFlag: boolean) {
    return this.prisma.stockSignal.create({
      data: {
        stockId,
        signalType: signalType as any,
        strength,
        description: drivers.join('; '),
        drivers: drivers as any,
        earlyFlag,
        expiresAt: new Date(Date.now() + 48 * 3600 * 1000),
      },
    });
  }
}
