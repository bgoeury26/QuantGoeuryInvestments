import { Injectable } from '@nestjs/common';
import { CacheService } from '../cache/cache.service';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

const FRED_SERIES = {
  gdp: 'GDP', inflation: 'CPIAUCSL', unemployment: 'UNRATE',
  fedFunds: 'FEDFUNDS', tenYearYield: 'DGS10', vix: 'VIXCLS',
  sp500pe: 'CAPE', creditSpread: 'BAMLH0A0HYM2',
};

@Injectable()
export class MacroService {
  constructor(private cache: CacheService, private config: ConfigService) {}

  async getSeries(seriesId: string, limit = 30) {
    const cached = await this.cache.get('fred', { seriesId, limit });
    if (cached) return cached;
    const key = this.config.get('FRED_API_KEY');
    if (!key) return { series: seriesId, data: [] };
    try {
      const { data } = await axios.get(`https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${key}&file_type=json&limit=${limit}&sort_order=desc`);
      const result = { series: seriesId, data: data.observations || [] };
      await this.cache.set('fred', { seriesId, limit }, result, 14400);
      return result;
    } catch { return { series: seriesId, data: [] }; }
  }

  async getMacroDashboard() {
    const results = await Promise.all(
      Object.entries(FRED_SERIES).map(async ([key, id]) => ({ key, ...(await this.getSeries(id, 12)) }))
    );
    return Object.fromEntries(results.map(r => [r.key, r]));
  }

  computeMacroScore(data: { fedFunds?: number; inflation?: number; vix?: number; creditSpread?: number }): number {
    const scores: number[] = [];
    if (data.fedFunds != null) scores.push(data.fedFunds < 2 ? 8 : data.fedFunds < 4 ? 6 : data.fedFunds < 6 ? 4 : 2);
    if (data.inflation != null) scores.push(data.inflation < 2 ? 8 : data.inflation < 3 ? 7 : data.inflation < 5 ? 5 : 2);
    if (data.vix != null) scores.push(data.vix < 15 ? 8 : data.vix < 20 ? 7 : data.vix < 30 ? 5 : data.vix < 40 ? 3 : 1);
    if (data.creditSpread != null) scores.push(data.creditSpread < 3 ? 8 : data.creditSpread < 5 ? 6 : data.creditSpread < 8 ? 4 : 2);
    return scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 5;
  }
}
