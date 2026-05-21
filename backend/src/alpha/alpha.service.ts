import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { SignalType } from '@prisma/client';

interface AnomalyResult {
  symbol: string;
  anomalyScore: number;
  volumeAnomaly: number;
  sentimentVelocity: number;
  insiderActivity: number;
  institutionalShift: number;
  earlySignal: boolean;
  signalType: string;
  drivers: string[];
}

@Injectable()
export class AlphaService {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private http: HttpService,
  ) {}

  async detectAnomaly(symbol: string): Promise<AnomalyResult> {
    const drivers: string[] = [];
    let volumeAnomaly = 0;
    let sentimentVelocity = 0;
    let insiderActivity = 0;
    let institutionalShift = 0;

    try {
      const finnhubKey = this.config.get<string>('FINNHUB_API_KEY');
      if (finnhubKey) {
        const [quoteRes, candleRes] = await Promise.allSettled([
          firstValueFrom(
            this.http.get(
              `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${finnhubKey}`,
            ),
          ),
          firstValueFrom(
            this.http.get(
              `https://finnhub.io/api/v1/stock/candle?symbol=${symbol}&resolution=D&count=31&token=${finnhubKey}`,
            ),
          ),
        ]);

        if (candleRes.status === 'fulfilled' && candleRes.value?.data?.v) {
          const volumes: number[] = candleRes.value.data.v;
          const currentVol = volumes[volumes.length - 1];
          const avgVol =
            volumes.slice(0, -1).reduce((a: number, b: number) => a + b, 0) /
            (volumes.length - 1);
          const ratio = currentVol / (avgVol || 1);
          volumeAnomaly = Math.min(ratio / 3, 1);
          if (ratio > 1.5) drivers.push(`Volume ${ratio.toFixed(1)}x avg`);
        }

        if (quoteRes.status === 'fulfilled') {
          const q = quoteRes.value?.data;
          if (q?.v > 0 && Math.abs(q.dp) < 0.5 && volumeAnomaly > 0.4) {
            drivers.push('Price-volume divergence detected');
            volumeAnomaly = Math.min(volumeAnomaly * 1.2, 1);
          }
        }
      }
    } catch (_) {}

    try {
      const fmpKey = this.config.get<string>('FMP_API_KEY');
      if (fmpKey) {
        const insiderRes = await firstValueFrom(
          this.http.get(
            `https://financialmodelingprep.com/api/v4/insider-trading?symbol=${symbol}&limit=30&apikey=${fmpKey}`,
          ),
        );
        const trades = insiderRes.data || [];
        const recentBuys = trades.filter(
          (t: any) =>
            t.transactionType?.toLowerCase().includes('buy') &&
            new Date(t.transactionDate) >
              new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        );
        if (recentBuys.length >= 2) {
          insiderActivity = Math.min(recentBuys.length / 5, 1);
          drivers.push(`${recentBuys.length} insider buys in 30d`);
        }
      }
    } catch (_) {}

    const anomalyScore =
      volumeAnomaly * 0.35 +
      sentimentVelocity * 0.25 +
      insiderActivity * 0.25 +
      institutionalShift * 0.15;

    const earlySignal = anomalyScore > 0.5;

    let signalType = 'UNKNOWN';
    if (insiderActivity > 0.4 && volumeAnomaly > 0.3) signalType = 'SMART_MONEY_ENTRY';
    else if (volumeAnomaly > 0.6) signalType = 'MOMENTUM_IGNITION';
    else if (sentimentVelocity > 0.5) signalType = 'SENTIMENT_PUMP';
    else if (institutionalShift > 0.4) signalType = 'ACCUMULATION';
    else if (earlySignal) signalType = 'ACCUMULATION';

    return {
      symbol,
      anomalyScore,
      volumeAnomaly,
      sentimentVelocity,
      insiderActivity,
      institutionalShift,
      earlySignal,
      signalType,
      drivers,
    };
  }

  async getAnomalyBySymbol(symbol: string): Promise<AnomalyResult> {
    return this.detectAnomaly(symbol);
  }

  async getSignals(symbol: string) {
    return this.prisma.stockSignal.findMany({
      where: { stock: { symbol } },
      orderBy: { detectedAt: 'desc' },
      take: 10,
    });
  }

  async getRecentSignals(limit = 20) {
    return this.prisma.stockSignal.findMany({
      where: { expiresAt: { gt: new Date() } },
      include: { stock: { select: { symbol: true, name: true } } },
      orderBy: { detectedAt: 'desc' },
      take: limit,
    });
  }

  async saveSignal(
    stockId: string,
    opts: {
      signalType: string;
      strength: number;
      earlyFlag: boolean;
      drivers: string[];
      expiresAt: Date;
    },
  ) {
    return this.prisma.stockSignal.create({
      data: {
        stock: { connect: { id: stockId } },
        signalType: opts.signalType as SignalType,
        strength: opts.strength,
        earlyFlag: opts.earlyFlag,
        drivers: opts.drivers,
        expiresAt: opts.expiresAt,
      },
    });
  }
}
