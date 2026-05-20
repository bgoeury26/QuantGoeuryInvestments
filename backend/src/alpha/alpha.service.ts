import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { $Enums } from '@prisma/client';

@Injectable()
export class AlphaService {
  constructor(private prisma: PrismaService) {}

  // ── Anomaly detectors ────────────────────────────────────────────────────

  detectVolumeAnomaly(current: number, hist: number[]): number {
    if (hist.length < 5) return 0;
    const mean = hist.reduce((a, b) => a + b, 0) / hist.length;
    const std  = Math.sqrt(hist.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / hist.length);
    if (std === 0) return 0;
    const z = (current - mean) / std;
    return Math.min(1, Math.max(0, (z - 1) / 3));
  }

  detectSentimentVelocity(
    curMentions:  number, prevMentions: number,
    curNews:      number, prevNews:     number,
  ): number {
    const s: number[] = [];
    if (prevMentions > 0) s.push(Math.min(1, Math.max(0, (curMentions - prevMentions) / prevMentions / 3)));
    if (prevNews     > 0) s.push(Math.min(1, Math.max(0, (curNews     - prevNews)     / prevNews     / 5)));
    return s.length ? s.reduce((a, b) => a + b, 0) / s.length : 0;
  }

  detectInsiderActivity(trades: { type: string; daysAgo: number; value: number }[]): number {
    const buys  = trades.filter(t => t.type === 'buy'  && t.daysAgo <= 30);
    const sells = trades.filter(t => t.type === 'sell' && t.daysAgo <= 30);
    if (!buys.length) return 0;
    const bv      = buys.reduce((s, t)  => s + t.value, 0);
    const sv      = sells.reduce((s, t) => s + t.value, 0);
    const cluster = buys.length >= 3 ? 0.3 : buys.length === 2 ? 0.15 : 0;
    return Math.min(1, Math.max(0, (bv - sv * 0.5) / Math.max(bv + sv, 1) + cluster));
  }

  detectInstitutionalShift(
    cur: number, prev: number, fundsUp: number, total: number,
  ): number {
    if (prev === 0) return 0;
    const change        = (cur - prev) / prev;
    const participation = total > 0 ? fundsUp / total : 0;
    return change > 0 ? Math.min(1, change * 2 + participation * 0.3) : 0;
  }

  computeAnomalyScore(vol: number, sent: number, insider: number, inst: number): number {
    return Math.min(1, Math.max(0,
      vol * 0.30 + sent * 0.25 + insider * 0.25 + inst * 0.20,
    ));
  }

  classifySignal(
    vol: number, sent: number, insider: number, inst: number, pricePct: number,
  ): $Enums.SignalType {
    if (insider > 0.6 && inst > 0.4)                    return $Enums.SignalType.SMART_MONEY_ENTRY;
    if (vol > 0.6 && Math.abs(pricePct) < 0.02)         return $Enums.SignalType.ACCUMULATION;
    if (sent > 0.7 && vol > 0.5)                        return $Enums.SignalType.SENTIMENT_PUMP;
    if (vol > 0.7 && pricePct > 0.02)                   return $Enums.SignalType.MOMENTUM_IGNITION;
    if (vol > 0.5 && insider < 0.1 && pricePct < -0.03) return $Enums.SignalType.RISK_WARNING;
    return $Enums.SignalType.NEUTRAL;
  }

  isEarlyOpportunity(anomaly: number, pricePct: number): boolean {
    return anomaly > 0.45 && Math.abs(pricePct) < 0.03;
  }

  // ── DB queries ───────────────────────────────────────────────────────────

  async getLatestSignals(stockId: string) {
    return this.prisma.stockSignal.findMany({
      where:   { stockId, expiresAt: { gt: new Date() } },
      orderBy: { detectedAt: 'desc' },
      take:    10,
    });
  }

  async getRecentSignals(limit = 20) {
    return this.prisma.stockSignal.findMany({
      where:   { expiresAt: { gt: new Date() } },
      include: { stock: { select: { symbol: true, name: true } } },
      orderBy: { detectedAt: 'desc' },
      take:    limit,
    });
  }

  async getEarlyOpportunities() {
    return this.prisma.stockSignal.findMany({
      where:   { earlyFlag: true, expiresAt: { gt: new Date() } },
      include: { stock: true },
      orderBy: { strength: 'desc' },
      take:    20,
    });
  }

  async getAnomalyBySymbol(symbol: string) {
    const stock = await this.prisma.stock.findUnique({
      where: { symbol: symbol.toUpperCase() },
    });
    if (!stock) return { symbol, anomalyScore: 0, signalType: $Enums.SignalType.NEUTRAL, earlyFlag: false };

    const signals = await this.getLatestSignals(stock.id);
    if (!signals.length) return { symbol, anomalyScore: 0, signalType: $Enums.SignalType.NEUTRAL, earlyFlag: false, signals: [] };

    const top = signals[0];
    return {
      symbol,
      anomalyScore: top.strength,
      signalType:   top.signalType,
      earlyFlag:    top.earlyFlag,
      drivers:      top.drivers,
      detectedAt:   top.detectedAt,
      signals,
    };
  }

  /**
   * getSignals(symbol) — returns recent valid signals for a symbol.
   * Called by ReportsService.generateReport().
   */
  async getSignals(symbol: string) {
    const stock = await this.prisma.stock.findUnique({
      where: { symbol: symbol.toUpperCase() },
    });
    if (!stock) return [];
    return this.getLatestSignals(stock.id);
  }

  /** Persist a new signal */
  async saveSignal(stockId: string, opts: {
    signalType: $Enums.SignalType;
    strength:   number;
    earlyFlag:  boolean;
    drivers:    string[];
    expiresAt:  Date;
  }) {
    return this.prisma.stockSignal.create({
      data: {
        stockId,
        signalType: opts.signalType,
        strength:   opts.strength,
        earlyFlag:  opts.earlyFlag,
        drivers:    opts.drivers,
        expiresAt:  opts.expiresAt,
      },
    });
  }
}
