import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getJson } from '../common/http.util';

/**
 * Tiingo — 500 calls/hour free.
 *
 * Note: Tiingo's News API requires a paid "Power" plan; the free tier rejects
 * /tiingo/news with 403. We use Tiingo's *price* endpoints instead, which are
 * free and serve as a third opinion in the quote consensus layer:
 *   - /iex/{sym}                       intraday IEX-exchange quote
 *   - /tiingo/daily/{sym}/prices       end-of-day OHLCV
 */
@Injectable()
export class TiingoService {
  private readonly logger = new Logger(TiingoService.name);
  constructor(private readonly config: ConfigService) {}

  private get key() { return this.config.get<string>('TIINGO_API_KEY'); }
  isConfigured() { return !!this.key; }

  /** Latest trade price from the IEX exchange (intraday during market hours). */
  async getIexQuote(symbol: string): Promise<{ price: number } | null> {
    if (!this.key) return null;
    const data = await getJson<any[]>(
      `https://api.tiingo.com/iex/${symbol.toUpperCase()}`,
      { params: { token: this.key } },
      'Tiingo IEX',
    );
    const q = Array.isArray(data) ? data[0] : null;
    if (!q?.last && !q?.tngoLast) return null;
    return { price: Number(q.last ?? q.tngoLast) };
  }

  /** Most recent end-of-day close. */
  async getDailyClose(symbol: string): Promise<{ close: number; date: string } | null> {
    if (!this.key) return null;
    const data = await getJson<any[]>(
      `https://api.tiingo.com/tiingo/daily/${symbol.toUpperCase()}/prices`,
      { params: { token: this.key } },
      'Tiingo daily',
    );
    const d = Array.isArray(data) ? data[0] : null;
    if (!d?.close) return null;
    return { close: Number(d.close), date: String(d.date ?? '').slice(0, 10) };
  }
}
