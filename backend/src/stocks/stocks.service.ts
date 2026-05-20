import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../cache/cache.service';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class StocksService {
  constructor(
    private prisma: PrismaService,
    private cache: CacheService,
    private config: ConfigService,
  ) {}

  /** Return all seeded stocks with their latest score + active signals */
  getAll() {
    return this.prisma.stock.findMany({
      include: {
        scores:  { orderBy: { computedAt: 'desc' }, take: 1 },
        signals: { where: { expiresAt: { gt: new Date() } }, orderBy: { detectedAt: 'desc' }, take: 1 },
      },
      orderBy: { symbol: 'asc' },
    });
  }

  /** Full-text search across symbol + name */
  async search(q: string) {
    if (!q || q.trim().length < 1) return this.getAll();
    const term = q.trim().toUpperCase();
    // 1. Local DB search
    const local = await this.prisma.stock.findMany({
      where: {
        OR: [
          { symbol: { contains: term } },
          { name:   { contains: q.trim(), mode: 'insensitive' } },
        ],
      },
      include: {
        scores:  { orderBy: { computedAt: 'desc' }, take: 1 },
        signals: { where: { expiresAt: { gt: new Date() } }, take: 1 },
      },
      take: 20,
    });
    if (local.length) return local;

    // 2. FMP search fallback
    const k = this.config.get('FMP_API_KEY');
    if (!k) return [];
    try {
      const { data } = await axios.get(
        `https://financialmodelingprep.com/api/v3/search?query=${encodeURIComponent(q)}&limit=10&apikey=${k}`,
      );
      return (data ?? []).map((r: any) => ({
        id:       null,
        symbol:   r.symbol,
        name:     r.name,
        sector:   r.sector   ?? null,
        industry: r.industry ?? null,
        scores:   [],
        signals:  [],
      }));
    } catch { return []; }
  }

  async getBySymbol(symbol: string) {
    const s = await this.prisma.stock.findUnique({
      where:   { symbol: symbol.toUpperCase() },
      include: {
        scores:  { orderBy: { computedAt: 'desc' }, take: 1 },
        signals: { where: { expiresAt: { gt: new Date() } }, take: 5 },
      },
    });
    if (!s) throw new NotFoundException(`Stock ${symbol} not found`);
    return s;
  }

  async getQuote(symbol: string) {
    const cacheKey = { symbol: symbol.toUpperCase() };
    const c = await this.cache.get('quote', cacheKey);
    if (c) return c;
    const k = this.config.get('FINNHUB_API_KEY');
    if (!k) return this.fmpQuoteFallback(symbol);
    try {
      const { data } = await axios.get(
        `https://finnhub.io/api/v1/quote?symbol=${symbol.toUpperCase()}&token=${k}`,
      );
      if (!data || data.c === 0) return this.fmpQuoteFallback(symbol);
      const quote = {
        symbol:            symbol.toUpperCase(),
        price:             data.c,
        change:            data.d,
        changesPercentage: data.dp,
        open:              data.o,
        dayHigh:           data.h,
        dayLow:            data.l,
        previousClose:     data.pc,
        volume:            null,
        marketCap:         null,
        yearHigh:          null,
        yearLow:           null,
      };
      await this.cache.set('quote', cacheKey, quote, 300);
      return quote;
    } catch { return this.fmpQuoteFallback(symbol); }
  }

  private async fmpQuoteFallback(symbol: string) {
    const k = this.config.get('FMP_API_KEY');
    if (!k) return null;
    try {
      const { data } = await axios.get(
        `https://financialmodelingprep.com/api/v3/quote/${symbol.toUpperCase()}?apikey=${k}`,
      );
      const q = data?.[0];
      if (!q) return null;
      const result = {
        symbol:            q.symbol,
        price:             q.price,
        change:            q.change,
        changesPercentage: q.changesPercentage,
        open:              q.open,
        dayHigh:           q.dayHigh,
        dayLow:            q.dayLow,
        previousClose:     q.previousClose,
        volume:            q.volume,
        avgVolume:         q.avgVolume,
        marketCap:         q.marketCap,
        yearHigh:          q.yearHigh,
        yearLow:           q.yearLow,
      };
      await this.cache.set('quote', { symbol: symbol.toUpperCase() }, result, 300);
      return result;
    } catch { return null; }
  }

  async getFundamentals(symbol: string) {
    const cacheKey = { symbol: symbol.toUpperCase() };
    const c = await this.cache.get('fundamentals', cacheKey);
    if (c) return c;
    const k = this.config.get('FMP_API_KEY');
    if (!k) return null;
    try {
      const [p, r, g] = await Promise.all([
        axios.get(`https://financialmodelingprep.com/api/v3/profile/${symbol.toUpperCase()}?apikey=${k}`),
        axios.get(`https://financialmodelingprep.com/api/v3/ratios-ttm/${symbol.toUpperCase()}?apikey=${k}`),
        axios.get(`https://financialmodelingprep.com/api/v3/financial-growth/${symbol.toUpperCase()}?limit=1&apikey=${k}`),
      ]);
      const d = { profile: p.data?.[0], ratios: r.data?.[0], growth: g.data?.[0] };
      await this.cache.set('fundamentals', cacheKey, d, 86400);
      return d;
    } catch { return null; }
  }

  async getTechnicals(symbol: string) {
    const cacheKey = { symbol: symbol.toUpperCase() };
    const c = await this.cache.get('technicals', cacheKey);
    if (c) return c;
    const k = this.config.get('ALPHA_VANTAGE_API_KEY');
    if (!k) return null;
    try {
      const [r, m] = await Promise.all([
        axios.get(`https://www.alphavantage.co/query?function=RSI&symbol=${symbol}&interval=daily&time_period=14&series_type=close&apikey=${k}`),
        axios.get(`https://www.alphavantage.co/query?function=MACD&symbol=${symbol}&interval=daily&series_type=close&apikey=${k}`),
      ]);
      const d = { rsi: r.data?.['Technical Analysis: RSI'], macd: m.data?.['Technical Analysis: MACD'] };
      await this.cache.set('technicals', cacheKey, d, 3600);
      return d;
    } catch { return null; }
  }

  async getAnalystRatings(symbol: string) {
    const cacheKey = { symbol: symbol.toUpperCase() };
    const c = await this.cache.get('analyst', cacheKey);
    if (c) return c;
    const k = this.config.get('FINNHUB_API_KEY');
    if (!k) return null;
    try {
      const [r, t] = await Promise.all([
        axios.get(`https://finnhub.io/api/v1/stock/recommendation?symbol=${symbol}&token=${k}`),
        axios.get(`https://finnhub.io/api/v1/stock/price-target?symbol=${symbol}&token=${k}`),
      ]);
      const rec     = Array.isArray(r.data) ? r.data[0] : null;
      const target  = t.data;
      const total   = rec ? (rec.strongBuy + rec.buy + rec.hold + rec.sell + rec.strongSell) : 0;
      const bullish = rec ? rec.strongBuy + rec.buy : 0;
      const consensus = total === 0 ? 'N/A' : bullish / total > 0.6 ? 'BUY' : bullish / total < 0.3 ? 'SELL' : 'HOLD';
      const result = { consensus, targetPrice: target?.targetMean ?? null, currentPrice: target?.lastPrice ?? null, totalAnalysts: total, ...rec };
      await this.cache.set('analyst', cacheKey, result, 3600);
      return result;
    } catch { return null; }
  }

  async getHistory(symbol: string, days = 200) {
    const cacheKey = { symbol: symbol.toUpperCase(), days };
    const c = await this.cache.get('history', cacheKey);
    if (c) return c;
    const k = this.config.get('FMP_API_KEY');
    if (!k) return [];
    try {
      const { data } = await axios.get(
        `https://financialmodelingprep.com/api/v3/historical-price-full/${symbol.toUpperCase()}?timeseries=${days}&apikey=${k}`,
      );
      const result = (data?.historical ?? []).reverse();
      await this.cache.set('history', cacheKey, result, 3600);
      return result;
    } catch { return []; }
  }
}
