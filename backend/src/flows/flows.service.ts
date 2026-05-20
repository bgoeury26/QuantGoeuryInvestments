import { Injectable } from '@nestjs/common';
import { CacheService } from '../cache/cache.service';
import { PrismaService } from '../prisma/prisma.service';
import axios from 'axios';

@Injectable()
export class FlowsService {
  constructor(private cache: CacheService, private prisma: PrismaService) {}

  private ago(days: number): string {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d.toISOString().slice(0, 10);
  }

  async getInstitutional(symbol: string) {
    const c = await this.cache.get('institutional', { symbol });
    if (c) return c;
    try {
      const { data } = await axios.get(
        `https://efts.sec.gov/LATEST/search-index?q=%22${symbol}%22&dateRange=custom&startdt=${this.ago(90)}&enddt=${this.ago(0)}&forms=13F-HR`,
        { headers: { 'User-Agent': 'QuantGoeuryInvestments research@quant.com' }, timeout: 10000 },
      );
      const r = { filings: data?.hits?.hits?.slice(0, 20) ?? [], total: data?.hits?.total?.value ?? 0 };
      await this.cache.set('institutional', { symbol }, r, 86400);
      return r;
    } catch { return { filings: [], total: 0 }; }
  }

  async getInsider(symbol: string) {
    const c = await this.cache.get('insider', { symbol });
    if (c) return c;
    try {
      const { data } = await axios.get(
        `https://efts.sec.gov/LATEST/search-index?q=%22${symbol}%22&forms=4&dateRange=custom&startdt=${this.ago(90)}&enddt=${this.ago(0)}`,
        { headers: { 'User-Agent': 'QuantGoeuryInvestments research@quant.com' }, timeout: 10000 },
      );
      const trades = (data?.hits?.hits ?? []).slice(0, 30).map((h: any) => ({
        filingId:   h._id,
        company:    h._source?.display_names?.[0] ?? symbol,
        filer:      h._source?.period_of_report ?? '',
        filedAt:    h._source?.file_date ?? '',
        formType:   '4',
        url:        `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${h._source?.entity_id ?? ''}&type=4&dateb=&owner=include&count=10`,
      }));
      const r = { trades };
      await this.cache.set('insider', { symbol }, r, 14400);
      return r;
    } catch { return { trades: [] }; }
  }

  async getPolitical(symbol: string) {
    const c = await this.cache.get('political', { symbol });
    if (c) return c;
    try {
      // House Stock Watcher & Senate Stock Watcher — free CSV endpoints
      const [house, senate] = await Promise.allSettled([
        axios.get('https://house-stock-watcher-data.s3-us-west-2.amazonaws.com/data/all_transactions.json', { timeout: 12000 }),
        axios.get('https://senate-stock-watcher-data.s3-us-west-2.amazonaws.com/aggregate/all_transactions.json', { timeout: 12000 }),
      ]);
      const sym = symbol.toUpperCase();
      const parse = (r: any) =>
        r.status === 'fulfilled'
          ? (r.value.data as any[]).filter(t => (t.ticker ?? '').toUpperCase() === sym).slice(0, 15)
          : [];
      const r = { house: parse(house), senate: parse(senate), symbol };
      await this.cache.set('political', { symbol }, r, 86400);
      return r;
    } catch { return { house: [], senate: [], symbol }; }
  }

  async getSummary(symbol: string) {
    const [inst, insider, political] = await Promise.allSettled([
      this.getInstitutional(symbol),
      this.getInsider(symbol),
      this.getPolitical(symbol),
    ]);
    return {
      symbol,
      institutional: inst.status      === 'fulfilled' ? inst.value      : { filings: [], total: 0 },
      insider:       insider.status   === 'fulfilled' ? insider.value   : { trades: [] },
      political:     political.status === 'fulfilled' ? political.value : { house: [], senate: [] },
    };
  }

  async getGlobalSummary(symbols: string[]) {
    const c = await this.cache.get('global_flows', { symbols: symbols.join(',') });
    if (c) return c;
    // Build net flow data from DB signals for dashboard chart
    const data = await this.prisma.stockSignal.groupBy({
      by: ['stockId'],
      where: { signalType: { in: ['SMART_MONEY_ENTRY', 'ACCUMULATION'] }, detectedAt: { gte: new Date(Date.now() - 30 * 86400000) } },
      _count: { _all: true },
      _avg:   { strength: true },
    });
    const stocks = await this.prisma.stock.findMany({ where: { symbol: { in: symbols } }, select: { id: true, symbol: true } });
    const symbolMap = Object.fromEntries(stocks.map(s => [s.id, s.symbol]));
    const institutional = data.map(d => ({
      symbol:  symbolMap[d.stockId] ?? d.stockId,
      netFlow: d._count._all * (d._avg.strength ?? 0) * 1e6,
    })).filter(d => d.symbol).slice(0, 10);
    const r = { institutional, generatedAt: new Date().toISOString() };
    await this.cache.set('global_flows', { symbols: symbols.join(',') }, r, 3600);
    return r;
  }

  async getRecentInsiderTrades(limit = 20) {
    const c = await this.cache.get('recent_insider', { limit });
    if (c) return c;
    try {
      const { data } = await axios.get(
        `https://efts.sec.gov/LATEST/search-index?forms=4&dateRange=custom&startdt=${this.ago(14)}&enddt=${this.ago(0)}`,
        { headers: { 'User-Agent': 'QuantGoeuryInvestments research@quant.com' }, timeout: 10000 },
      );
      const trades = (data?.hits?.hits ?? []).slice(0, limit).map((h: any) => ({
        symbol:  h._source?.display_names?.[0] ?? 'N/A',
        filer:   h._source?.entity_name ?? 'Unknown',
        filedAt: h._source?.file_date ?? '',
        type:    'Form 4',
        url:     `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${h._source?.entity_id ?? ''}&type=4`,
      }));
      await this.cache.set('recent_insider', { limit }, trades, 3600);
      return trades;
    } catch { return []; }
  }

  async getRecentPolitical() {
    const c = await this.cache.get('recent_political', {});
    if (c) return c;
    try {
      const { data } = await axios.get(
        'https://house-stock-watcher-data.s3-us-west-2.amazonaws.com/data/all_transactions.json',
        { timeout: 12000 },
      );
      const trades = (data as any[]).slice(0, 30).map((t: any) => ({
        politician: t.representative ?? 'Unknown',
        ticker:     t.ticker ?? 'N/A',
        type:       t.type ?? 'purchase',
        amount:     t.amount ?? 'N/A',
        date:       t.transaction_date ?? '',
        party:      t.party ?? '',
      }));
      await this.cache.set('recent_political', {}, trades, 86400);
      return trades;
    } catch { return []; }
  }
}
