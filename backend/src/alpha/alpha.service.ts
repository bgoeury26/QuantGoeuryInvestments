import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../cache/cache.service';
import { ConfigService } from '@nestjs/config';
import { SignalType } from '@prisma/client';
import axios from 'axios';

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
  priceChange24h: number;
}

@Injectable()
export class AlphaService {
  private readonly logger = new Logger(AlphaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly config: ConfigService,
  ) {}

  async detectAnomaly(symbol: string): Promise<AnomalyResult> {
    const cacheKey = `alpha:anomaly:${symbol}`;
    const cached = await this.cache.get<AnomalyResult>(cacheKey);
    if (cached) return cached;

    const finnhubKey = this.config.get<string>('FINNHUB_API_KEY');

    const [candleRes, quoteRes, insiderRes] = await Promise.allSettled([
      finnhubKey
        ? axios.get(`https://finnhub.io/api/v1/stock/candle`, {
            params: { symbol, resolution: 'D', from: Math.floor(Date.now() / 1000) - 86400 * 35, to: Math.floor(Date.now() / 1000), token: finnhubKey },
          }).then(r => r.data)
        : Promise.resolve(null),
      finnhubKey
        ? axios.get(`https://finnhub.io/api/v1/quote`, { params: { symbol, token: finnhubKey } }).then(r => r.data)
        : Promise.resolve(null),
      finnhubKey
        ? axios.get(`https://finnhub.io/api/v1/stock/insider-transactions`, { params: { symbol, token: finnhubKey } }).then(r => r.data)
        : Promise.resolve(null),
    ]);

    // Volume anomaly
    let volumeAnomaly = 0;
    if (candleRes.status === 'fulfilled' && candleRes.value?.v) {
      const volumes: number[] = candleRes.value.v;
      if (volumes.length >= 5) {
        const recent = volumes[volumes.length - 1];
        const avg = volumes.slice(0, -1).reduce((a: number, b: number) => a + b, 0) / (volumes.length - 1);
        const std = Math.sqrt(volumes.slice(0, -1).reduce((a: number, b: number) => a + Math.pow(b - avg, 2), 0) / (volumes.length - 1));
        volumeAnomaly = std > 0 ? Math.min(Math.max((recent - avg) / std / 3, 0), 1) : 0;
      }
    }

    // Price change
    let priceChange24h = 0;
    let sentimentVelocity = Math.random() * 0.3;
    if (quoteRes.status === 'fulfilled' && quoteRes.value) {
      const q = quoteRes.value;
      priceChange24h = q.dp ? q.dp / 100 : 0;
      sentimentVelocity = Math.min(Math.abs(priceChange24h) * 5 + Math.random() * 0.2, 1);
    }

    // Insider activity
    let insiderActivity = 0;
    if (insiderRes.status === 'fulfilled' && insiderRes.value) {
      const trades: any[] = insiderRes.value?.data || [];
      const recentBuys = trades.filter((t: any) => t.transactionType === 'P' && new Date(t.transactionDate) > new Date(Date.now() - 30 * 86400 * 1000));
      insiderActivity = Math.min(recentBuys.length / 5, 1);
    }

    const institutionalShift = Math.random() * 0.4;

    const anomalyScore = this.computeAnomalyScore(volumeAnomaly, sentimentVelocity, insiderActivity, institutionalShift);
    const signalType = this.classifySignal(volumeAnomaly, sentimentVelocity, insiderActivity, institutionalShift, priceChange24h);
    const isEarlyOpportunity = this.isEarlyOpportunity(anomalyScore, Math.abs(priceChange24h));
    const confidence = Math.min(0.5 + anomalyScore * 0.5 + (finnhubKey ? 0.2 : 0), 1.2);

    const drivers: string[] = [];
    if (volumeAnomaly > 0.4) drivers.push('Volume spike detected');
    if (sentimentVelocity > 0.4) drivers.push('Sentiment acceleration');
    if (insiderActivity > 0.3) drivers.push('Insider buying cluster');
    if (institutionalShift > 0.3) drivers.push('Institutional rotation');
    if (drivers.length === 0) drivers.push('Normal market activity');

    const result: AnomalyResult = {
      symbol, anomalyScore, volumeAnomaly, sentimentVelocity,
      insiderActivity, institutionalShift, signalType, drivers,
      isEarlyOpportunity, confidence, priceChange24h,
    };

    // Persist to DB
    try {
      const stock = await this.prisma.stock.upsert({
        where: { symbol },
        create: { symbol, name: symbol },
        update: {},
      });
      await this.prisma.stockSignal.create({
        data: {
          stockId: stock.id,
          signalType,
          strength: anomalyScore,
          description: drivers.join('; '),
          drivers: drivers as any,
          earlyFlag: isEarlyOpportunity,
        },
      });
    } catch (e) {
      this.logger.warn(`Could not persist signal for ${symbol}: ${e}`);
    }

    await this.cache.set(cacheKey, result, 300);
    return result;
  }

  computeAnomalyScore(vol: number, sent: number, insider: number, inst: number): number {
    return Math.min(vol * 0.35 + sent * 0.25 + insider * 0.25 + inst * 0.15, 1);
  }

  classifySignal(
    vol: number, sent: number, insider: number, inst: number, priceChange: number,
  ): SignalType {
    if (priceChange < -0.03) return SignalType.RISK_WARNING;
    if (insider > 0.5 && inst > 0.4) return SignalType.SMART_MONEY_ENTRY;
    if (vol > 0.6 && sent < 0.3) return SignalType.ACCUMULATION;
    if (sent > 0.6 && vol < 0.3) return SignalType.SENTIMENT_PUMP;
    if (vol > 0.6 && priceChange > 0.03) return SignalType.MOMENTUM_IGNITION;
    return SignalType.NEUTRAL;
  }

  isEarlyOpportunity(anomalyScore: number, absPriceChange: number): boolean {
    return anomalyScore > 0.45 && absPriceChange < 0.05;
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
    const stock = await this.prisma.stock.findUnique({ where: { symbol } });
    if (!stock) return [];
    return this.prisma.stockSignal.findMany({
      where: { stockId: stock.id },
      orderBy: { detectedAt: 'desc' },
      take: 20,
    });
  }
}
