import { Injectable, Logger } from '@nestjs/common';
import { getJson } from '../common/http.util';

/**
 * Stocktwits — unmetered free API, no key.
 * /streams/symbol/{SYM}.json returns recent messages tagged with the symbol,
 * each potentially tagged with sentiment (bullish/bearish) by the user.
 */
@Injectable()
export class StocktwitsService {
  private readonly logger = new Logger(StocktwitsService.name);

  async getStream(symbol: string): Promise<{
    mentionCount: number;
    bullishCount: number;
    bearishCount: number;
    score: number;
    messages: { body: string; sentiment: string | null; createdAt: string }[];
  } | null> {
    const data = await getJson<any>(
      `https://api.stocktwits.com/api/2/streams/symbol/${symbol.toUpperCase()}.json`,
      { params: { limit: 30 } },
      'Stocktwits',
    );
    if (!data || !Array.isArray(data.messages)) return null;

    const msgs = data.messages;
    let bull = 0, bear = 0;
    for (const m of msgs) {
      const s = m.entities?.sentiment?.basic;
      if (s === 'Bullish') bull++;
      else if (s === 'Bearish') bear++;
    }
    // [-1, 1]: net bullish ratio over the sample
    const tagged = bull + bear;
    const score = tagged === 0 ? 0 : (bull - bear) / tagged;

    return {
      mentionCount: msgs.length,
      bullishCount: bull,
      bearishCount: bear,
      score: Math.round(score * 100) / 100,
      messages: msgs.slice(0, 10).map((m: any) => ({
        body: m.body,
        sentiment: m.entities?.sentiment?.basic ?? null,
        createdAt: m.created_at,
      })),
    };
  }
}
