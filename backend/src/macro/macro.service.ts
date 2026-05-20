import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CacheService } from '../cache/cache.service';
import axios from 'axios';

@Injectable()
export class MacroService {
  constructor(private config: ConfigService, private cache: CacheService) {}

  private fredKey() { return this.config.get<string>('FRED_API_KEY'); }

  async getDashboard() {
    const cached = await this.cache.get('macro', { key: 'dashboard' });
    if (cached) return cached;

    const indicators = [
      { id: 'FEDFUNDS', label: 'fedRate' },
      { id: 'CPIAUCSL', label: 'inflation' },
      { id: 'A191RL1Q225SBEA', label: 'gdpGrowth' },
      { id: 'UNRATE', label: 'unemployment' },
      { id: 'T10Y2Y', label: 'yieldCurve' },
      { id: 'VIXCLS', label: 'vix' },
      { id: 'DTWEXBGS', label: 'dxy' },
    ];

    const result: Record<string, number> = {};

    await Promise.allSettled(
      indicators.map(async ({ id, label }) => {
        try {
          const key = this.fredKey();
          const url = key
            ? `https://api.stlouisfed.org/fred/series/observations?series_id=${id}&api_key=${key}&file_type=json&limit=1&sort_order=desc`
            : `https://api.stlouisfed.org/fred/series/observations?series_id=${id}&api_key=&file_type=json&limit=1&sort_order=desc`;
          const { data } = await axios.get(url, { timeout: 8000 });
          const val = parseFloat(data?.observations?.[0]?.value);
          result[label] = isNaN(val) ? 0 : val;
        } catch {
          result[label] = 0;
        }
      }),
    );

    result['updatedAt'] = Date.now();

    await this.cache.set('macro', { key: 'dashboard' }, result, 3600);
    return result;
  }

  async getIndicator(seriesId: string) {
    const cached = await this.cache.get('macro_series', { id: seriesId });
    if (cached) return cached;

    const key = this.fredKey();
    if (!key) return { id: seriesId, series: [], error: 'FRED_API_KEY not configured' };

    try {
      const { data } = await axios.get(
        `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${key}&file_type=json&limit=60&sort_order=desc`,
        { timeout: 8000 },
      );
      const series = (data?.observations ?? []).map((o: any) => ({
        date: o.date,
        value: parseFloat(o.value) || 0,
      })).reverse();
      const result = { id: seriesId, series, updatedAt: new Date().toISOString() };
      await this.cache.set('macro_series', { id: seriesId }, result, 14400);
      return result;
    } catch (e: any) {
      return { id: seriesId, series: [], error: e.message };
    }
  }

  async getCalendar() {
    // Economic calendar — FRED doesn't have a release calendar endpoint on free tier
    // Return static upcoming high-impact events as fallback
    return [
      { date: '2026-06-11', time: '14:00', event: 'FOMC Meeting', importance: 'HIGH', forecast: '4.25%', previous: '4.25%' },
      { date: '2026-06-13', time: '08:30', event: 'CPI YoY', importance: 'HIGH', forecast: '3.1%', previous: '3.4%' },
      { date: '2026-06-14', time: '08:30', event: 'PPI MoM', importance: 'MEDIUM', forecast: '0.2%', previous: '0.5%' },
      { date: '2026-06-17', time: '08:30', event: 'Retail Sales MoM', importance: 'HIGH', forecast: '0.3%', previous: '-0.2%' },
      { date: '2026-06-26', time: '08:30', event: 'GDP QoQ (Final)', importance: 'HIGH', forecast: '2.1%', previous: '2.4%' },
      { date: '2026-06-27', time: '08:30', event: 'PCE Price Index YoY', importance: 'HIGH', forecast: '2.6%', previous: '2.7%' },
    ];
  }

  async getScore(): Promise<number> {
    try {
      const dash = await this.getDashboard() as any;
      // Score macro environment 0-10
      let score = 5.0;
      if (dash.fedRate < 4.0) score += 1.0;
      else if (dash.fedRate > 5.5) score -= 1.5;
      if (dash.inflation < 2.5) score += 1.0;
      else if (dash.inflation > 4.0) score -= 1.5;
      if (dash.gdpGrowth > 2.0) score += 0.5;
      else if (dash.gdpGrowth < 0) score -= 1.0;
      if (dash.vix < 20) score += 0.5;
      else if (dash.vix > 30) score -= 1.0;
      if (dash.yieldCurve > 0) score += 0.5;
      else if (dash.yieldCurve < -0.5) score -= 0.5;
      return Math.max(0, Math.min(10, score));
    } catch { return 5.0; }
  }
}
