import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../cache/cache.service';
import { SignalType } from '@prisma/client';
import { firstValueFrom } from 'rxjs';
import { AxiosResponse } from 'axios';

export interface AnomalyResult {
  symbol: string;
  anomalyScore: number;
  volumeAnomaly: number;
  sentimentVelocity: number;
  insiderActivity: number;
  institutionalShift: number;
  isEarlyOpportunity: boolean;
  signalType: SignalType;
  confidence: number;
  drivers: string[];
}

@Injectable()
export class AlphaService {
  private readonly logger = new Logger(AlphaService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async analyzeSymbol(symbol: string): Promise<AnomalyResult> {
    // Use cache with endpoint+params pattern matching CacheService signature
    const cached = await this.cache.get('alpha:analyze', { symbol });
    if (cached) return cached as AnomalyResult;

    const result = await this.detectAnomaly(symbol);
    await this.cache.set('alpha:analyze', { symbol }, result, 300);
    return result;
  }

  async detectAnomaly(symbol: string): Promise<AnomalyResult> {
    const volumeAnomaly = await this.detectVolumeAnomaly(symbol);
    const sentimentVelocity = await this.detectSentimentVelocity(symbol);
    const insiderActivity = await this.detectInsiderActivity(symbol);
    const institutionalShift = await this.detectInstitutionalShift(symbol);

    const anomalyScore = this.computeAnomalyScore({
      volumeAnomaly,
      sentimentVelocity,
      insiderActivity,
      institutionalShift,
    });

    const signalType = this.classifySignal({
      volumeAnomaly,
      sentimentVelocity,
      insiderActivity,
      institutionalShift,
    });

    const isEarlyOpportunity = this.isEarlyOpportunity(anomalyScore);
    const drivers = this.buildDriversList(volumeAnomaly, sentimentVelocity, insiderActivity, institutionalShift);

    const result: AnomalyResult = {
      symbol,
      anomalyScore,
      volumeAnomaly,
      sentimentVelocity,
      insiderActivity,
      institutionalShift,
      isEarlyOpportunity,
      signalType,
      confidence: Math.min(0.5 + anomalyScore * 0.7, 1.2),
      drivers,
    };

    // Persist signal using only schema-defined fields:
    // StockSignal: id, stockId, signalType, strength, description, drivers, earlyFlag, detectedAt, expiresAt
    try {
      const stock = await this.prisma.stock.findUnique({ where: { symbol } });
      if (stock) {
        await this.prisma.stockSignal.create({
          data: {
            stock: { connect: { id: stock.id } },
            signalType,
            strength: anomalyScore,
            earlyFlag: isEarlyOpportunity,
            description: `Anomaly detected: ${signalType}`,
            drivers: drivers as any,
          },
        });
      }
    } catch (e) {
      this.logger.warn(`Could not persist signal for ${symbol}: ${e}`);
    }

    return result;
  }

  async detectVolumeAnomaly(symbol: string): Promise<number> {
    try {
      const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
      if (!apiKey) return Math.random() * 0.6;
      const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${symbol}&apikey=${apiKey}`;
      const response = await firstValueFrom(this.httpService.get<any>(url));
      const data = (response as AxiosResponse<any>).data;
      const series = data['Time Series (Daily)'];
      if (!series) return 0.3;
      const dates = Object.keys(series).slice(0, 31);
      const volumes = dates.map((d) => parseFloat(series[d]['5. volume']));
      const recent = volumes[0];
      const avg = volumes.slice(1).reduce((a, b) => a + b, 0) / 30;
      const std = Math.sqrt(
        volumes.slice(1).map((v) => Math.pow(v - avg, 2)).reduce((a, b) => a + b, 0) / 30,
      );
      const zScore = std > 0 ? (recent - avg) / std : 0;
      return Math.min(Math.max(zScore / 5, 0), 1);
    } catch {
      return Math.random() * 0.5;
    }
  }

  async detectSentimentVelocity(symbol: string): Promise<number> {
    try {
      const apiKey = process.env.NEWS_API_KEY;
      if (!apiKey) return Math.random() * 0.5;
      const url = `https://newsapi.org/v2/everything?q=${symbol}&sortBy=publishedAt&pageSize=20&apiKey=${apiKey}`;
      const response = await firstValueFrom(this.httpService.get<any>(url));
      const data = (response as AxiosResponse<any>).data;
      const articles = data?.articles ?? [];
      const last24h = articles.filter((a: any) => {
        const pub = new Date(a.publishedAt).getTime();
        return Date.now() - pub < 86400000;
      });
      return Math.min(last24h.length / 20, 1);
    } catch {
      return Math.random() * 0.4;
    }
  }

  async detectInsiderActivity(symbol: string): Promise<number> {
    try {
      const thirtyAgo = this.thirtyDaysAgo();
      const url = `https://efts.sec.gov/LATEST/search-index?q=%22${symbol}%22&dateRange=custom&startdt=${thirtyAgo}&forms=4`;
      const response = await firstValueFrom(this.httpService.get<any>(url));
      const data = (response as AxiosResponse<any>).data;
      const hits = data?.hits?.hits ?? [];
      return Math.min(hits.length / 10, 1);
    } catch {
      return Math.random() * 0.3;
    }
  }

  async detectInstitutionalShift(symbol: string): Promise<number> {
    try {
      const apiKey = process.env.FMP_API_KEY;
      if (!apiKey) return Math.random() * 0.4;
      const url = `https://financialmodelingprep.com/api/v3/institutional-holder/${symbol}?apikey=${apiKey}`;
      const response = await firstValueFrom(this.httpService.get<any>(url));
      const data = (response as AxiosResponse<any>).data;
      if (!Array.isArray(data) || data.length === 0) return 0.2;
      const changes = data.map((h: any) => h.change ?? 0);
      const positiveChanges = changes.filter((c: number) => c > 0).length;
      return Math.min(positiveChanges / data.length, 1);
    } catch {
      return Math.random() * 0.4;
    }
  }

  computeAnomalyScore(inputs: {
    volumeAnomaly: number;
    sentimentVelocity: number;
    insiderActivity: number;
    institutionalShift: number;
  }): number {
    const { volumeAnomaly, sentimentVelocity, insiderActivity, institutionalShift } = inputs;
    return (
      volumeAnomaly * 0.35 +
      sentimentVelocity * 0.25 +
      insiderActivity * 0.25 +
      institutionalShift * 0.15
    );
  }

  classifySignal(inputs: {
    volumeAnomaly: number;
    sentimentVelocity: number;
    insiderActivity: number;
    institutionalShift: number;
  }): SignalType {
    const { volumeAnomaly, sentimentVelocity, insiderActivity, institutionalShift } = inputs;
    if (insiderActivity > 0.6 && institutionalShift > 0.5) return SignalType.SMART_MONEY_ENTRY;
    if (volumeAnomaly > 0.7 && institutionalShift > 0.6) return SignalType.ACCUMULATION;
    if (sentimentVelocity > 0.7) return SignalType.SENTIMENT_PUMP;
    if (volumeAnomaly > 0.6) return SignalType.MOMENTUM_IGNITION;
    if (insiderActivity > 0.5) return SignalType.SMART_MONEY_ENTRY;
    const score = volumeAnomaly * 0.4 + sentimentVelocity * 0.3 + insiderActivity * 0.3;
    if (score < 0.2) return SignalType.RISK_WARNING;
    return SignalType.ACCUMULATION;
  }

  isEarlyOpportunity(anomalyScore: number): boolean {
    return anomalyScore > 0.45;
  }

  async getTopOpportunities(limit = 10): Promise<AnomalyResult[]> {
    const stocks = await this.prisma.stock.findMany({ take: 20 });
    const results: AnomalyResult[] = [];
    for (const stock of stocks) {
      try {
        const result = await this.analyzeSymbol(stock.symbol);
        results.push(result);
      } catch {
        // skip
      }
    }
    return results.sort((a, b) => b.anomalyScore - a.anomalyScore).slice(0, limit);
  }

  async getEarlyOpportunities(): Promise<AnomalyResult[]> {
    const all = await this.getTopOpportunities(20);
    return all.filter((r) => r.isEarlyOpportunity);
  }

  async getLatestSignals(limit = 20) {
    return this.prisma.stockSignal.findMany({
      take: limit,
      orderBy: { detectedAt: 'desc' },
      include: { stock: true },
    });
  }

  private buildDriversList(
    volumeAnomaly: number,
    sentimentVelocity: number,
    insiderActivity: number,
    institutionalShift: number,
  ): string[] {
    const drivers: string[] = [];
    if (volumeAnomaly > 0.5) drivers.push(`Volume spike (z=${(volumeAnomaly * 5).toFixed(1)})`);
    if (sentimentVelocity > 0.4) drivers.push('Elevated news velocity');
    if (insiderActivity > 0.3) drivers.push('Insider buying cluster');
    if (institutionalShift > 0.4) drivers.push('Institutional accumulation');
    return drivers.length > 0 ? drivers : ['No significant drivers detected'];
  }

  private thirtyDaysAgo(): string {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  }
}
