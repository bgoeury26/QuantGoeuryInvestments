import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../cache/cache.service';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class StocksService {
  constructor(private prisma: PrismaService, private cache: CacheService, private config: ConfigService) {}

  getAll() {
    return this.prisma.stock.findMany({
      include: {
        scores: { orderBy: { computedAt: 'desc' }, take: 1 },
        signals: { where: { expiresAt: { gt: new Date() } }, orderBy: { detectedAt: 'desc' }, take: 1 },
      },
      orderBy: { symbol: 'asc' },
    });
  }

  async getBySymbol(symbol: string) {
    const s = await this.prisma.stock.findUnique({
      where: { symbol: symbol.toUpperCase() },
      include: {
        scores: { orderBy: { computedAt: 'desc' }, take: 1 },
        signals: { where: { expiresAt: { gt: new Date() } }, orderBy: { strength: 'desc' }, take: 5 },
      },
    });
    if (!s) throw new NotFoundException(`Stock ${symbol} not found`);
    return s;
  }

  async getQuote(symbol: string) {
    const cached = await this.cache.get('quote', { symbol });
    if (cached) return cached;
    const key = this.config.get('FINNHUB_API_KEY');
    if (!key) return null;
    try {
      const { data } = await axios.get(`https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${key}`);
      await this.cache.set('quote', { symbol }, data, 300);
      return data;
    } catch { return null; }
  }

  async getFundamentals(symbol: string) {
    const cached = await this.cache.get('fundamentals', { symbol });
    if (cached) return cached;
    const key = this.config.get('FMP_API_KEY');
    if (!key) return null;
    try {
      const [p, r, g] = await Promise.all([
        axios.get(`https://financialmodelingprep.com/api/v3/profile/${symbol}?apikey=${key}`),
        axios.get(`https://financialmodelingprep.com/api/v3/ratios-ttm/${symbol}?apikey=${key}`),
        axios.get(`https://financialmodelingprep.com/api/v3/financial-growth/${symbol}?limit=1&apikey=${key}`),
      ]);
      const result = { profile: p.data?.[0], ratios: r.data?.[0], growth: g.data?.[0] };
      await this.cache.set('fundamentals', { symbol }, result, 86400);
      return result;
    } catch { return null; }
  }

  async getTechnicals(symbol: string) {
    const cached = await this.cache.get('technicals', { symbol });
    if (cached) return cached;
    const key = this.config.get('ALPHA_VANTAGE_API_KEY');
    if (!key) return null;
    try {
      const [rsi, macd] = await Promise.all([
        axios.get(`https://www.alphavantage.co/query?function=RSI&symbol=${symbol}&interval=daily&time_period=14&series_type=close&apikey=${key}`),
        axios.get(`https://www.alphavantage.co/query?function=MACD&symbol=${symbol}&interval=daily&series_type=close&apikey=${key}`),
      ]);
      const result = { rsi: rsi.data?.['Technical Analysis: RSI'], macd: macd.data?.['Technical Analysis: MACD'] };
      await this.cache.set('technicals', { symbol }, result, 3600);
      return result;
    } catch { return null; }
  }

  async getAnalystRatings(symbol: string) {
    const cached = await this.cache.get('analyst', { symbol });
    if (cached) return cached;
    const key = this.config.get('FINNHUB_API_KEY');
    if (!key) return null;
    try {
      const [rec, tgt] = await Promise.all([
        axios.get(`https://finnhub.io/api/v1/stock/recommendation?symbol=${symbol}&token=${key}`),
        axios.get(`https://finnhub.io/api/v1/stock/price-target?symbol=${symbol}&token=${key}`),
      ]);
      const result = { recommendations: rec.data?.slice(0, 4), priceTarget: tgt.data };
      await this.cache.set('analyst', { symbol }, result, 21600);
      return result;
    } catch { return null; }
  }

  async getHistoricalPrices(symbol: string, days = 200) {
    const cached = await this.cache.get('historical', { symbol, days });
    if (cached) return cached;
    const key = this.config.get('FMP_API_KEY');
    if (!key) return [];
    try {
      const { data } = await axios.get(`https://financialmodelingprep.com/api/v3/historical-price-full/${symbol}?timeseries=${days}&apikey=${key}`);
      const prices = data?.historical || [];
      await this.cache.set('historical', { symbol, days }, prices, 3600);
      return prices;
    } catch { return []; }
  }

  searchStocks(query: string) {
    return this.prisma.stock.findMany({
      where: { OR: [{ symbol: { contains: query.toUpperCase() } }, { name: { contains: query, mode: 'insensitive' } }] },
      take: 20,
    });
  }

  upsertStock(symbol: string, data: any) {
    return this.prisma.stock.upsert({ where: { symbol }, update: data, create: { symbol, name: data.name || symbol, ...data } });
  }
}
