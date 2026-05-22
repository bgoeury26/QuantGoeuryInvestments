import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CacheService } from '../cache/cache.service';
import { PrismaService } from '../prisma/prisma.service';
import axios from 'axios';

@Injectable()
export class StocksService {
  private readonly logger = new Logger(StocksService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly cache: CacheService,
    private readonly prisma: PrismaService,
  ) {}

  private get fhKey() { return this.config.get<string>('FINNHUB_API_KEY'); }

  async getAll() {
    const stocks = await this.prisma.stock.findMany({
      include: { scores: { orderBy: { rankingScore: 'desc' }, take: 1 } },
      orderBy: { symbol: 'asc' },
    });
    return stocks.map(s => ({
      symbol:       s.symbol,
      name:         s.name,
      finalScore:   s.scores[0]?.finalScore   ?? null,
      rankingScore: s.scores[0]?.rankingScore ?? null,
    }));
  }

  async search(query: string) {
    const cacheKey = `stocks:search:${query.toLowerCase()}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;
    if (!this.fhKey) return [];

    const data = await axios.get('https://finnhub.io/api/v1/search', {
      params: { q: query, token: this.fhKey },
    }).then(r => r.data).catch(() => null);

    const result = (data?.result ?? []).slice(0, 15).map((r: any) => ({
      symbol: r.symbol, description: r.description, type: r.type,
    }));
    await this.cache.set(cacheKey, result, 3600);
    return result;
  }

  // controller calls getBySymbol(sym)
  async getBySymbol(symbol: string) {
    const upper = symbol.toUpperCase();
    const cacheKey = `stocks:profile:${upper}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;
    if (!this.fhKey) throw new NotFoundException('Finnhub key not configured');

    const [profileRes, quoteRes] = await Promise.allSettled([
      axios.get('https://finnhub.io/api/v1/stock/profile2', {
        params: { symbol: upper, token: this.fhKey },
      }).then(r => r.data),
      axios.get('https://finnhub.io/api/v1/quote', {
        params: { symbol: upper, token: this.fhKey },
      }).then(r => r.data),
    ]);

    const profile = profileRes.status === 'fulfilled' ? profileRes.value : {};
    const quote   = quoteRes.status   === 'fulfilled' ? quoteRes.value   : {};

    const result = {
      symbol, name: profile.name, exchange: profile.exchange,
      industry: profile.finnhubIndustry, country: profile.country,
      currency: profile.currency, logo: profile.logo, weburl: profile.weburl,
      marketCap: profile.marketCapitalization, shareOutstanding: profile.shareOutstanding,
      price: quote.c, change: quote.d, changePercent: quote.dp,
      high: quote.h, low: quote.l, open: quote.o, previousClose: quote.pc,
    };

    await this.cache.set(cacheKey, result, 600);
    return result;
  }

  async getQuote(symbol: string) {
    const upper = symbol.toUpperCase();
    const cacheKey = `stocks:quote:${upper}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;
    if (!this.fhKey) return null;

    const data = await axios.get('https://finnhub.io/api/v1/quote', {
      params: { symbol: upper, token: this.fhKey },
    }).then(r => r.data).catch(() => null);

    const result = {
      symbol: upper, price: data?.c, change: data?.d, changePercent: data?.dp,
      high: data?.h, low: data?.l, open: data?.o, previousClose: data?.pc,
      timestamp: data?.t ? new Date(data.t * 1000).toISOString() : null,
    };
    await this.cache.set(cacheKey, result, 60);
    return result;
  }

  async getFundamentals(symbol: string) {
    const upper = symbol.toUpperCase();
    const cacheKey = `stocks:fundamentals:${upper}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;
    if (!this.fhKey) return null;

    const data = await axios.get('https://finnhub.io/api/v1/stock/metric', {
      params: { symbol: upper, metric: 'all', token: this.fhKey },
    }).then(r => r.data?.metric).catch(() => null);

    const result = {
      symbol: upper,
      peRatio: data?.peNormalizedAnnual, peTTM: data?.peTTM,
      pbRatio: data?.pbAnnual, psRatio: data?.psTTM,
      roe: data?.roeTTM, roa: data?.roaTTM,
      revenueGrowth: data?.revenueGrowthTTMYoy, epsGrowth: data?.epsGrowthTTMYoy,
      grossMargin: data?.grossMarginTTM, operatingMargin: data?.operatingMarginTTM,
      netMargin: data?.netProfitMarginTTM, debtEquity: data?.totalDebt_totalEquityAnnual,
      currentRatio: data?.currentRatioAnnual, beta: data?.beta,
      week52High: data?.['52WeekHigh'], week52Low: data?.['52WeekLow'],
      dividendYield: data?.currentDividendYieldTTM,
    };
    await this.cache.set(cacheKey, result, 3600);
    return result;
  }

  async getTechnicals(symbol: string) {
    const upper = symbol.toUpperCase();
    const cacheKey = `stocks:technicals:${upper}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;
    if (!this.fhKey) return null;

    const [metricRes, candleRes] = await Promise.allSettled([
      axios.get('https://finnhub.io/api/v1/stock/metric', {
        params: { symbol: upper, metric: 'all', token: this.fhKey },
      }).then(r => r.data?.metric),
      axios.get('https://finnhub.io/api/v1/stock/candle', {
        params: {
          symbol: upper, resolution: 'D',
          from: Math.floor(Date.now() / 1000) - 86400 * 90,
          to:   Math.floor(Date.now() / 1000),
          token: this.fhKey,
        },
      }).then(r => r.data),
    ]);

    const m = metricRes.status === 'fulfilled' ? metricRes.value : null;
    const c = candleRes.status === 'fulfilled' ? candleRes.value : null;
    const closes: number[] = c?.c ?? [];
    const sma20  = closes.length >= 20  ? closes.slice(-20).reduce((a: number, b: number)  => a + b, 0) / 20  : null;
    const sma50  = closes.length >= 50  ? closes.slice(-50).reduce((a: number, b: number)  => a + b, 0) / 50  : null;
    const sma200 = closes.length >= 200 ? closes.slice(-200).reduce((a: number, b: number) => a + b, 0) / 200 : null;

    const result = {
      symbol: upper, sma20, sma50, sma200,
      ma200: m?.['200DayMA'], ma50: m?.['50DayMA'],
      week52High: m?.['52WeekHigh'], week52Low: m?.['52WeekLow'],
      beta: m?.beta, rsi14: m?.rsi14, atr: m?.atr,
      recentCloses: closes.slice(-10),
    };
    await this.cache.set(cacheKey, result, 600);
    return result;
  }

  // controller calls getAnalystRatings(sym)
  async getAnalystRatings(symbol: string) {
    const upper = symbol.toUpperCase();
    const cacheKey = `stocks:analyst:${upper}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;
    if (!this.fhKey) return null;

    const [recRes, targetRes, upgradeRes] = await Promise.allSettled([
      axios.get('https://finnhub.io/api/v1/stock/recommendation', {
        params: { symbol: upper, token: this.fhKey },
      }).then(r => r.data),
      axios.get('https://finnhub.io/api/v1/stock/price-target', {
        params: { symbol: upper, token: this.fhKey },
      }).then(r => r.data),
      axios.get('https://finnhub.io/api/v1/stock/upgrade-downgrade', {
        params: { symbol: upper, token: this.fhKey },
      }).then(r => r.data),
    ]);

    const rec      = recRes.status     === 'fulfilled' ? recRes.value?.[0]          : null;
    const target   = targetRes.status  === 'fulfilled' ? targetRes.value             : null;
    const upgrades = upgradeRes.status === 'fulfilled' ? upgradeRes.value?.slice(0, 5) : [];

    const result = {
      symbol: upper,
      strongBuy: rec?.strongBuy, buy: rec?.buy, hold: rec?.hold,
      sell: rec?.sell, strongSell: rec?.strongSell, period: rec?.period,
      priceTarget: target?.targetMean, targetHigh: target?.targetHigh,
      targetLow: target?.targetLow, targetMedian: target?.targetMedian,
      recentUpgrades: upgrades,
    };
    await this.cache.set(cacheKey, result, 3600);
    return result;
  }

  async getHistory(symbol: string) {
    const upper = symbol.toUpperCase();
    const cacheKey = `stocks:history:${upper}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;
    if (!this.fhKey) return null;

    const data = await axios.get('https://finnhub.io/api/v1/stock/candle', {
      params: {
        symbol: upper, resolution: 'D',
        from: Math.floor(Date.now() / 1000) - 86400 * 365,
        to:   Math.floor(Date.now() / 1000),
        token: this.fhKey,
      },
    }).then(r => r.data).catch(() => null);

    if (!data || data.s === 'no_data') return { symbol: upper, candles: [] };

    const candles = (data.t ?? []).map((t: number, i: number) => ({
      date:   new Date(t * 1000).toISOString().split('T')[0],
      open:   data.o[i], high: data.h[i],
      low:    data.l[i], close: data.c[i], volume: data.v[i],
    }));

    const result = { symbol: upper, candles };
    await this.cache.set(cacheKey, result, 3600);
    return result;
  }
}
