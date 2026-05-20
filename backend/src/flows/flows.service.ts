import { Injectable } from "@nestjs/common";
import { CacheService } from "../cache/cache.service";
import axios from "axios";

@Injectable()
export class FlowsService {
  constructor(private cache: CacheService) {}

  private dayAgo(n: number) { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); }

  // SEC EDGAR 13F — FREE, no key needed. Cached 24h
  async getInstitutionalHoldings(symbol: string) {
    const cached = await this.cache.get("institutional", { symbol });
    if (cached) return cached;
    try {
      const { data } = await axios.get(
        `https://efts.sec.gov/LATEST/search-index?q=%22${symbol}%22&dateRange=custom&startdt=${this.dayAgo(90)}&enddt=${this.dayAgo(0)}&forms=13F-HR`,
        { headers: { "User-Agent": "QuantGoeuryInvestments contact@quant.com" } }
      );
      const result = { filings: data?.hits?.hits?.slice(0, 20) || [], total: data?.hits?.total?.value || 0, symbol };
      await this.cache.set("institutional", { symbol }, result, 86400);
      return result;
    } catch { return { filings: [], total: 0, symbol }; }
  }

  // SEC EDGAR Form 4 insider trades — FREE. Cached 4h
  async getInsiderTrades(symbol: string) {
    const cached = await this.cache.get("insider", { symbol });
    if (cached) return cached;
    try {
      const { data } = await axios.get(
        `https://efts.sec.gov/LATEST/search-index?q=%22${symbol}%22&forms=4&dateRange=custom&startdt=${this.dayAgo(90)}&enddt=${this.dayAgo(0)}`,
        { headers: { "User-Agent": "QuantGoeuryInvestments contact@quant.com" } }
      );
      const result = { trades: data?.hits?.hits?.slice(0, 30) || [], symbol };
      await this.cache.set("insider", { symbol }, result, 14400);
      return result;
    } catch { return { trades: [], symbol }; }
  }

  // Congress stock trades — public S3 dataset. Cached 12h
  async getPoliticalTrades(symbol: string) {
    const cached = await this.cache.get("political", { symbol });
    if (cached) return cached;
    try {
      const { data } = await axios.get(
        `https://house-stock-watcher-data.s3-us-east-2.amazonaws.com/data/all_transactions.json`,
        { timeout: 10000 }
      );
      const trades = (Array.isArray(data) ? data : []).filter((t: any) => t.ticker === symbol).slice(0, 20);
      const result = { trades, symbol };
      await this.cache.set("political", { symbol }, result, 43200);
      return result;
    } catch { return { trades: [], symbol }; }
  }

  async getFlowSummary(symbol: string) {
    const [institutional, insider, political] = await Promise.all([
      this.getInstitutionalHoldings(symbol),
      this.getInsiderTrades(symbol),
      this.getPoliticalTrades(symbol),
    ]);
    return { institutional, insider, political };
  }
}
