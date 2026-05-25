import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getJson } from '../common/http.util';

/**
 * TwelveData — 800 calls/day free.
 * Endpoints used: /price, /quote, /time_series.
 * Returns null on missing key or API failure (degrades silently).
 */
@Injectable()
export class TwelveDataService {
  private readonly logger = new Logger(TwelveDataService.name);
  constructor(private readonly config: ConfigService) {}

  private get key() { return this.config.get<string>('TWELVEDATA_API_KEY'); }
  isConfigured() { return !!this.key; }

  async getQuote(symbol: string): Promise<{ price: number; change: number; changePct: number } | null> {
    if (!this.key) return null;
    const data = await getJson<any>(
      'https://api.twelvedata.com/quote',
      { params: { symbol, apikey: this.key } },
      'TwelveData quote',
    );
    if (!data || data.status === 'error' || data.code) return null;
    return {
      price: Number(data.close ?? data.price),
      change: Number(data.change ?? 0),
      changePct: Number(data.percent_change ?? 0),
    };
  }

  async getDailyCloses(symbol: string, days = 45): Promise<{ date: string; close: number }[] | null> {
    if (!this.key) return null;
    const data = await getJson<any>(
      'https://api.twelvedata.com/time_series',
      { params: { symbol, interval: '1day', outputsize: days, apikey: this.key } },
      'TwelveData time_series',
    );
    if (!data || data.status === 'error' || !Array.isArray(data.values)) return null;
    return data.values
      .map((v: any) => ({ date: v.datetime, close: Number(v.close) }))
      .reverse(); // oldest -> newest
  }
}
