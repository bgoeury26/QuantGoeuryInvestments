import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getJson } from '../common/http.util';

/**
 * Marketstack — 100 calls/month on free tier. Free tier is HTTP only and
 * end-of-day data only. Use as a third opinion for EOD price only.
 */
@Injectable()
export class MarketstackService {
  private readonly logger = new Logger(MarketstackService.name);
  constructor(private readonly config: ConfigService) {}

  private get key() { return this.config.get<string>('MARKETSTACK_API_KEY'); }
  isConfigured() { return !!this.key; }

  async getLatestEod(symbol: string): Promise<{ close: number; date: string } | null> {
    if (!this.key) return null;
    const data = await getJson<any>(
      'http://api.marketstack.com/v1/eod/latest',
      { params: { access_key: this.key, symbols: symbol.toUpperCase() } },
      'Marketstack EOD',
    );
    const d = Array.isArray(data?.data) ? data.data[0] : null;
    if (!d?.close) return null;
    return { close: Number(d.close), date: d.date?.slice(0, 10) ?? '' };
  }
}
