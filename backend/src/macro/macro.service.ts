import { Injectable } from '@nestjs/common';
import { CacheService } from '../cache/cache.service';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

const FRED_SERIES = {
  gdp: 'GDP',
  inflation: 'CPIAUCSL',
  unemployment: 'UNRATE',
  fedFundsRate: 'FEDFUNDS',
  treasuryYield10y: 'GS10',
  vix: 'VIXCLS',
  sp500: 'SP500',
  consumerSentiment: 'UMCSENT',
};

@Injectable()
export class MacroService {
  constructor(private cache: CacheService, private config: ConfigService) {}

  async getMacroIndicator(seriesId: string) {
    const cached = await this.cache.get('fred', { seriesId });
    if (cached) return cached;
    const apiKey = this.config.get('FRED_API_KEY');
    if (!apiKey) return null;
    try {
      const { data } = await axios.get(`https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${apiKey}&file_type=json&limit=12&sort_order=desc`);
      const result = { seriesId, observations: data?.observations || [] };
      await this.cache.set('fred', { seriesId }, result, 86400);
      return result;
    } catch { return null; }
  }

  async getMacroDashboard() {
    const results = await Promise.all(
      Object.entries(FRED_SERIES).map(async ([key, id]) => [key, await this.getMacroIndicator(id)])
    );
    return Object.fromEntries(results);
  }

  computeMacroScore(indicators: Record<string, any>): number {
    const scores: number[] = [];
    const vix = parseFloat(indicators.vix?.observations?.[0]?.value);
    if (!isNaN(vix)) scores.push(vix < 15 ? 8 : vix < 20 ? 7 : vix < 25 ? 5 : vix < 30 ? 3 : 1);
    const unemp = parseFloat(indicators.unemployment?.observations?.[0]?.value);
    if (!isNaN(unemp)) scores.push(unemp < 4 ? 8 : unemp < 5 ? 7 : unemp < 6 ? 5 : unemp < 8 ? 3 : 1);
    const rate = parseFloat(indicators.fedFundsRate?.observations?.[0]?.value);
    if (!isNaN(rate)) scores.push(rate < 2 ? 9 : rate < 4 ? 7 : rate < 5 ? 5 : rate < 6 ? 3 : 2);
    return scores.length === 0 ? 5 : scores.reduce((a, b) => a + b, 0) / scores.length;
  }
}
