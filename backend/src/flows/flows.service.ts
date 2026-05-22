import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CacheService } from '../cache/cache.service';
import { PrismaService } from '../prisma/prisma.service';
import axios from 'axios';

@Injectable()
export class FlowsService {
  private readonly logger = new Logger(FlowsService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly cache: CacheService,
    private readonly prisma: PrismaService,
  ) {}

  private get fhKey() { return this.config.get<string>('FINNHUB_API_KEY'); }

  async getInstitutional(symbol: string) {
    const upper = symbol.toUpperCase();
    const cacheKey = `flows:institutional:${upper}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;
    if (!this.fhKey) return { symbol: upper, holders: [] };

    const data = await axios.get('https://finnhub.io/api/v1/stock/institutional-ownership', {
      params: { symbol: upper, token: this.fhKey },
    }).then(r => r.data).catch(() => null);

    const result = {
      symbol: upper,
      holders: (data?.ownership ?? []).slice(0, 20).map((h: any) => ({
        name:         h.name,
        sharesHeld:   h.share,
        changeShares: h.change,
        changeType:   h.change > 0 ? 'BUY' : h.change < 0 ? 'SELL' : 'HOLD',
        percentOwned: h.sharePercent,
        reportDate:   h.reportDate,
      })),
    };

    await this.cache.set(cacheKey, result, 3600 * 6);
    return result;
  }

  async getInsider(symbol: string) {
    const upper = symbol.toUpperCase();
    const cacheKey = `flows:insider:${upper}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;
    if (!this.fhKey) return { symbol: upper, trades: [] };

    const data = await axios.get('https://finnhub.io/api/v1/stock/insider-transactions', {
      params: { symbol: upper, token: this.fhKey },
    }).then(r => r.data).catch(() => null);

    const trades = (data?.data ?? []).slice(0, 30).map((t: any) => ({
      name:            t.name,
      transactionType: t.transactionType === 'P' ? 'BUY' : t.transactionType === 'S' ? 'SELL' : t.transactionType,
      shares:          t.share,
      value:           t.value,
      transactionDate: t.transactionDate,
      filingDate:      t.filingDate,
    }));

    const result = { symbol: upper, trades };
    await this.cache.set(cacheKey, result, 3600 * 6);
    return result;
  }

  async getPolitical(symbol: string) {
    return {
      symbol: symbol.toUpperCase(),
      trades: [],
      note: 'Political trading data not available from current data providers.',
    };
  }

  async getSummary(symbol: string) {
    const upper = symbol.toUpperCase();
    const [inst, insider] = await Promise.all([
      this.getInstitutional(upper),
      this.getInsider(upper),
    ]);

    const instBuys    = inst.holders.filter((h: any) => h.changeType === 'BUY').length;
    const instSells   = inst.holders.filter((h: any) => h.changeType === 'SELL').length;
    const insiderBuys  = insider.trades.filter((t: any) => t.transactionType === 'BUY').length;
    const insiderSells = insider.trades.filter((t: any) => t.transactionType === 'SELL').length;

    return {
      symbol: upper,
      institutional: { totalHolders: inst.holders.length, buying: instBuys, selling: instSells },
      insider:        { totalTrades: insider.trades.length, buying: insiderBuys, selling: insiderSells },
      signal: instBuys > instSells && insiderBuys >= insiderSells ? 'BULLISH'
             : instSells > instBuys && insiderSells > insiderBuys ? 'BEARISH'
             : 'NEUTRAL',
    };
  }

  // Controller passes an optional string[] of symbols
  async getGlobalSummary(symbols: string[] = ['AAPL','NVDA','MSFT','TSLA','META','AMZN','GOOGL','JPM','V','SPY']) {
    const results = await Promise.allSettled(
      symbols.map(sym => this.getSummary(sym))
    );
    return {
      summaries: results
        .filter(r => r.status === 'fulfilled')
        .map(r => (r as PromiseFulfilledResult<any>).value),
    };
  }

  async getRecentInsiderTrades(limit = 50) {
    const cacheKey = `flows:insider:all:${limit}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const stocks = await this.prisma.stock.findMany({ take: 10, orderBy: { symbol: 'asc' } });
    const allTrades: any[] = [];

    for (const stock of stocks) {
      const data = await this.getInsider(stock.symbol).catch(() => null);
      if (data?.trades) allTrades.push(...data.trades.map((t: any) => ({ ...t, symbol: stock.symbol })));
    }

    const result = {
      trades: allTrades
        .sort((a, b) => new Date(b.transactionDate).getTime() - new Date(a.transactionDate).getTime())
        .slice(0, limit),
    };

    await this.cache.set(cacheKey, result, 3600);
    return result;
  }

  async getRecentPolitical() {
    return { trades: [], note: 'Political trading data not available from current data providers.' };
  }
}
