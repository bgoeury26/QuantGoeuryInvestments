import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CacheService } from '../cache/cache.service';
import axios from 'axios';

const FRED_SERIES: { id: string; label: string; description: string }[] = [
  { id: 'FEDFUNDS',   label: 'Fed Funds Rate',         description: 'Effective federal funds rate (%)' },
  { id: 'CPIAUCSL',   label: 'CPI Inflation',           description: 'Consumer Price Index, all items' },
  { id: 'UNRATE',     label: 'Unemployment Rate',       description: 'US civilian unemployment rate (%)' },
  { id: 'GDP',        label: 'GDP Growth',              description: 'Real Gross Domestic Product' },
  { id: 'T10Y2Y',     label: 'Yield Curve (10Y-2Y)',    description: '10-Year minus 2-Year Treasury spread' },
  { id: 'VIXCLS',     label: 'VIX Volatility',          description: 'CBOE Volatility Index close' },
  { id: 'DGS10',      label: '10Y Treasury Yield',      description: '10-Year Treasury Constant Maturity Rate' },
  { id: 'DEXUSEU',    label: 'USD/EUR Exchange Rate',   description: 'US Dollar to Euro exchange rate' },
];

@Injectable()
export class MacroService {
  private readonly logger = new Logger(MacroService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly cache: CacheService,
  ) {}

  async getDashboard() {
    const cacheKey = 'macro:dashboard';
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const fredKey = this.config.get<string>('FRED_API_KEY');
    if (!fredKey) return { error: 'FRED_API_KEY not configured', indicators: [] };

    const results = await Promise.allSettled(
      FRED_SERIES.map(s =>
        axios.get('https://api.stlouisfed.org/fred/series/observations', {
          params: {
            series_id:      s.id,
            api_key:        fredKey,
            file_type:      'json',
            sort_order:     'desc',
            limit:          2,
            observation_start: '2020-01-01',
          },
        }).then(r => ({ ...s, observations: r.data.observations })),
      )
    );

    const indicators = results.map((res, i) => {
      if (res.status === 'rejected') return { ...FRED_SERIES[i], value: null, previousValue: null, change: null, error: true };
      const obs   = res.value.observations?.filter((o: any) => o.value !== '.')  ?? [];
      const value = obs[0]  ? parseFloat(obs[0].value)  : null;
      const prev  = obs[1]  ? parseFloat(obs[1].value)  : null;
      const change = (value != null && prev != null) ? Math.round((value - prev) * 10000) / 10000 : null;
      return {
        id:          res.value.id,
        label:       res.value.label,
        description: res.value.description,
        value,
        previousValue: prev,
        change,
        date:        obs[0]?.date ?? null,
        trend:       change == null ? 'flat' : change > 0 ? 'up' : change < 0 ? 'down' : 'flat',
      };
    });

    const result = { updatedAt: new Date().toISOString(), indicators };
    await this.cache.set(cacheKey, result, 3600); // 1 hour
    return result;
  }

  async getIndicator(seriesId: string) {
    const cacheKey = `macro:indicator:${seriesId}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const fredKey = this.config.get<string>('FRED_API_KEY');
    if (!fredKey) return { error: 'FRED_API_KEY not configured' };

    const data = await axios.get('https://api.stlouisfed.org/fred/series/observations', {
      params: {
        series_id:  seriesId,
        api_key:    fredKey,
        file_type:  'json',
        sort_order: 'desc',
        limit:      24,
        observation_start: '2020-01-01',
      },
    }).then(r => r.data).catch(() => null);

    const meta = FRED_SERIES.find(s => s.id === seriesId);
    const observations = (data?.observations ?? []).filter((o: any) => o.value !== '.').map((o: any) => ({
      date:  o.date,
      value: parseFloat(o.value),
    }));

    const result = { seriesId, label: meta?.label ?? seriesId, description: meta?.description, observations };
    await this.cache.set(cacheKey, result, 3600);
    return result;
  }

  async getCalendar() {
    const cacheKey = 'macro:calendar';
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const finnhubKey = this.config.get<string>('FINNHUB_API_KEY');
    if (!finnhubKey) return { events: [] };

    const from = new Date().toISOString().split('T')[0];
    const to   = new Date(Date.now() + 14 * 86400 * 1000).toISOString().split('T')[0];

    const [earningsRes, ipoRes] = await Promise.allSettled([
      axios.get('https://finnhub.io/api/v1/calendar/earnings', {
        params: { from, to, token: finnhubKey },
      }).then(r => r.data?.earningsCalendar ?? []),
      axios.get('https://finnhub.io/api/v1/calendar/ipo', {
        params: { from, to, token: finnhubKey },
      }).then(r => r.data?.ipoCalendar ?? []),
    ]);

    const earnings = earningsRes.status === 'fulfilled'
      ? earningsRes.value.slice(0, 20).map((e: any) => ({
          type: 'EARNINGS', symbol: e.symbol, date: e.date,
          epsEstimate: e.epsEstimate, revenueEstimate: e.revenueEstimate,
        }))
      : [];

    const ipos = ipoRes.status === 'fulfilled'
      ? ipoRes.value.slice(0, 10).map((e: any) => ({
          type: 'IPO', symbol: e.symbol, name: e.name,
          date: e.date, price: e.price, shares: e.shares,
        }))
      : [];

    const result = { events: [...earnings, ...ipos].sort((a, b) => a.date.localeCompare(b.date)) };
    await this.cache.set(cacheKey, result, 3600);
    return result;
  }
}
