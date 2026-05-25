import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../cache/cache.service';
import { StocksService } from '../stocks/stocks.service';
import { SentimentService } from '../sentiment/sentiment.service';
import { FlowsService } from '../flows/flows.service';
import { SignalType } from '@prisma/client';
import { mean, stdev } from '../common/http.util';

export interface AnomalyResult {
  symbol: string;
  anomalyScore: number;
  volumeAnomaly: number;
  sentimentVelocity: number;
  insiderActivity: number;
  institutionalShift: number;
  signalType: SignalType;
  drivers: string[];
  isEarlyOpportunity: boolean;
  confidence: number;
  priceChange5d: number;
}

/**
 * Alpha Engine — REWRITTEN.
 *
 * Removed Math.random() from sentimentVelocity and institutionalShift, and
 * dropped Finnhub /stock/candle (403 on free tier). Volume anomaly now uses
 * Polygon OHLCV via StocksService; sentiment velocity uses the real news
 * velocity ratio; insider/institutional activity uses SEC EDGAR via FlowsService.
 */
@Injectable()
export class AlphaService {
  private readonly logger = new Logger(AlphaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly stocks: StocksService,
    private readonly sentiment: SentimentService,
    private readonly flows: FlowsService,
  ) {}

  async detectAnomaly(symbol: string): Promise<AnomalyResult> {
    const upper = symbol.toUpperCase();
    const cacheKey = `alpha:anomaly:${upper}`;
    const cached = await this.cache.get<AnomalyResult>(cacheKey);
    if (cached) return cached;

    const [histR, velR, flowR] = await Promise.allSettled([
      this.stocks.getHistory(upper, 35),
      this.sentiment.getVelocity(upper),
      this.flows.getSummary(upper),
    ]);
    const history: any = histR.status === 'fulfilled' ? histR.value : null;
    const velocity: any = velR.status === 'fulfilled' ? velR.value : null;
    const flow: any = flowR.status === 'fulfilled' ? flowR.value : null;

    const candles: any[] = history?.candles ?? [];

    // --- Volume anomaly: z-score of latest volume vs 30-day window ---
    let volumeAnomaly = 0;
    let priceChange5d = 0;
    if (candles.length >= 6) {
      const volumes = candles.map((c) => c.volume).filter((v) => v != null);
      if (volumes.length >= 6) {
        const recent = volumes[volumes.length - 1];
        const hist = volumes.slice(0, -1);
        const sd = stdev(hist);
        const z = sd > 0 ? (recent - mean(hist)) / sd : 0;
        volumeAnomaly = Math.min(Math.max(z / 3, 0), 1); // z=3 -> 1.0
      }
      const closes = candles.map((c) => c.close);
      const last = closes[closes.length - 1];
      const fiveBack = closes[Math.max(0, closes.length - 6)];
      if (fiveBack) priceChange5d = (last - fiveBack) / fiveBack;
    }

    // --- Sentiment velocity: real news velocity ratio (>1 accelerating) ---
    const sentimentVelocity = velocity
      ? Math.min(Math.max((velocity.velocityRatio - 1) / 3, 0), 1)
      : 0;

    // --- Insider activity: recent Form 4 count, normalized ---
    const insiderActivity = flow
      ? Math.min((flow.insider?.recentForm4 ?? 0) / 8, 1)
      : 0;

    // --- Institutional shift: recent 13F filing count, normalized ---
    const institutionalShift = flow
      ? Math.min((flow.institutional?.recentFilings ?? 0) / 15, 1)
      : 0;

    const anomalyScore = this.computeAnomalyScore(
      volumeAnomaly, sentimentVelocity, insiderActivity, institutionalShift,
    );
    const signalType = this.classifySignal(
      volumeAnomaly, sentimentVelocity, insiderActivity, institutionalShift, priceChange5d,
    );
    const isEarlyOpportunity = this.isEarlyOpportunity(anomalyScore, Math.abs(priceChange5d));

    // Confidence from data availability — deterministic.
    const sources = [candles.length >= 6, !!velocity, !!flow].filter(Boolean).length;
    const confidence = Math.min(0.5 + sources * 0.2 + anomalyScore * 0.1, 1.2);

    const drivers: string[] = [];
    if (volumeAnomaly > 0.4) drivers.push('Unusual volume spike vs 30-day average');
    if (sentimentVelocity > 0.4) drivers.push('News velocity accelerating');
    if (insiderActivity > 0.3) drivers.push('Recent insider (Form 4) filing cluster');
    if (institutionalShift > 0.3) drivers.push('Elevated 13F institutional filings');
    if (drivers.length === 0) drivers.push('Normal market activity');

    const result: AnomalyResult = {
      symbol: upper, anomalyScore: r2(anomalyScore), volumeAnomaly: r2(volumeAnomaly),
      sentimentVelocity: r2(sentimentVelocity), insiderActivity: r2(insiderActivity),
      institutionalShift: r2(institutionalShift), signalType, drivers,
      isEarlyOpportunity, confidence: r2(confidence), priceChange5d: r2(priceChange5d),
    };

    try {
      const stock = await this.prisma.stock.upsert({
        where: { symbol: upper },
        create: { symbol: upper, name: upper },
        update: {},
      });
      await this.prisma.stockSignal.create({
        data: {
          stock: { connect: { id: stock.id } },
          signalType,
          strength: anomalyScore,
          description: drivers.join('; '),
          drivers: drivers as any,
          earlyFlag: isEarlyOpportunity,
        },
      });
    } catch (e) {
      this.logger.warn(`Could not persist signal for ${upper}: ${e}`);
    }

    await this.cache.set(cacheKey, result, 300);
    return result;
  }

  computeAnomalyScore(vol: number, sent: number, insider: number, inst: number): number {
    return Math.min(vol * 0.35 + sent * 0.25 + insider * 0.25 + inst * 0.15, 1);
  }

  classifySignal(
    vol: number, sent: number, insider: number, inst: number, priceChange5d: number,
  ): SignalType {
    if (priceChange5d < -0.05) return SignalType.RISK_WARNING;
    if (insider > 0.5 && inst > 0.4) return SignalType.SMART_MONEY_ENTRY;
    if (vol > 0.6 && sent < 0.3) return SignalType.ACCUMULATION;
    if (sent > 0.6 && vol < 0.3) return SignalType.SENTIMENT_PUMP;
    if (vol > 0.6 && priceChange5d > 0.03) return SignalType.MOMENTUM_IGNITION;
    return SignalType.NEUTRAL;
  }

  /** README spec: anomaly > 0.65 AND |5d move| < 3%. */
  isEarlyOpportunity(anomalyScore: number, abs5dChange: number): boolean {
    return anomalyScore > 0.65 && abs5dChange < 0.03;
  }

  async getEarlyOpportunities(): Promise<any[]> {
    return this.prisma.stockSignal.findMany({
      where: { earlyFlag: true },
      include: { stock: true },
      orderBy: { detectedAt: 'desc' },
      take: 10,
    });
  }

  async getLatestSignals(symbol: string): Promise<any[]> {
    const stock = await this.prisma.stock.findUnique({ where: { symbol: symbol.toUpperCase() } });
    if (!stock) return [];
    return this.prisma.stockSignal.findMany({
      where: { stockId: stock.id },
      orderBy: { detectedAt: 'desc' },
      take: 20,
    });
  }

  /**
   * Latest signals across every stock in the DB, flattened with symbol
   * pulled up to the top level for direct rendering in the Dashboard.
   */
  async getRecentSignals(limit = 8): Promise<any[]> {
    const rows = await this.prisma.stockSignal.findMany({
      orderBy: { detectedAt: 'desc' },
      take: limit,
      include: { stock: { select: { symbol: true, name: true } } },
    });
    return rows.map((s) => ({
      id: s.id,
      symbol: s.stock.symbol,
      name: s.stock.name,
      signalType: s.signalType,
      strength: s.strength,
      earlyFlag: s.earlyFlag,
      description: s.description,
      detectedAt: s.detectedAt,
    }));
  }
}

const r2 = (n: number) => Math.round(n * 1000) / 1000;
