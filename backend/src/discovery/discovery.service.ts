import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getJson } from '../common/http.util';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../cache/cache.service';

/**
 * Discovery — Form 4 cluster buys.
 *
 * Pulls FMP's pre-parsed insider-trading feed (which already has BUY/SELL
 * direction, dollar value, and the filer's name), keeps only open-market
 * purchases over a recency window, then groups by ticker. A symbol qualifies
 * as a "cluster buy" when 2+ distinct insiders bought in the window — that's
 * the signal that historically front-runs reversals best, as a single Form 4
 * is often just an exercise/RSU vest rather than real conviction.
 *
 * Output: ranked list of {symbol, buyerCount, totalValue, latestDate, reason}.
 * The orchestrator (DailyDiscoveryJob) upserts each into Stock with the reason
 * stamped, then triggers ScoringService for each.
 */

export interface DiscoveredTicker {
  symbol: string;
  companyName: string | null;
  buyerCount: number;
  totalValueUsd: number;
  totalShares: number;
  latestDate: string;
  reason: string;
}

interface FmpInsiderRow {
  symbol?: string;
  companyCik?: string;
  reportingName?: string;
  transactionType?: string;       // "P-Purchase" / "S-Sale" / etc.
  acquistionOrDisposition?: string; // "A" or "D" (note: FMP typo)
  acquisitionOrDisposition?: string;
  securitiesTransacted?: number;
  price?: number;
  transactionDate?: string;
  filingDate?: string;
  companyName?: string;
}

@Injectable()
export class DiscoveryService {
  private readonly logger = new Logger(DiscoveryService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  private get fmpKey() { return this.config.get<string>('FMP_API_KEY'); }

  /**
   * Fetch recent insider trades and return cluster-buy candidates.
   *
   * @param days       Recency window in days (default 14)
   * @param minBuyers  Minimum distinct insiders required (default 2)
   * @param pages      How many FMP RSS pages to walk (each ~100 rows)
   */
  async discoverClusterBuys(
    days = 14,
    minBuyers = 2,
    pages = 5,
  ): Promise<DiscoveredTicker[]> {
    const cacheKey = `discovery:cluster:${days}:${minBuyers}:${pages}`;
    const cached = await this.cache.get<DiscoveredTicker[]>(cacheKey);
    if (cached) return cached;

    if (!this.fmpKey) {
      this.logger.warn('FMP_API_KEY missing — discovery disabled.');
      return [];
    }

    const cutoff = Date.now() - days * 86400_000;

    // Walk the RSS pages of Form 4 filings (most recent first).
    const allRows: FmpInsiderRow[] = [];
    for (let p = 0; p < pages; p++) {
      const rows = await getJson<FmpInsiderRow[]>(
        'https://financialmodelingprep.com/api/v4/insider-trading-rss-feed',
        { params: { page: p, apikey: this.fmpKey } },
        `FMP insider RSS p${p}`,
      );
      if (!Array.isArray(rows) || rows.length === 0) break;

      // Stop early once we walk past the recency window.
      const oldest = rows[rows.length - 1]?.filingDate;
      allRows.push(...rows);
      if (oldest && new Date(oldest).getTime() < cutoff) break;
    }

    // Filter to open-market purchases within the window.
    const buys = allRows.filter((r) => {
      const isPurchase = (r.transactionType ?? '').toLowerCase().includes('purchase');
      const acq = r.acquistionOrDisposition ?? r.acquisitionOrDisposition;
      const date = r.transactionDate ?? r.filingDate;
      return isPurchase && acq === 'A' && date && new Date(date).getTime() >= cutoff;
    });

    // Group by symbol → unique insiders, total $ value, etc.
    type Bucket = {
      symbol: string;
      companyName: string | null;
      buyers: Set<string>;
      totalValueUsd: number;
      totalShares: number;
      latestDate: string;
    };
    const byTicker = new Map<string, Bucket>();
    for (const r of buys) {
      const sym = (r.symbol ?? '').toUpperCase();
      if (!sym) continue;
      const shares = Number(r.securitiesTransacted ?? 0);
      const price = Number(r.price ?? 0);
      const value = shares * price;
      const date = r.transactionDate ?? r.filingDate ?? '';
      const buyer = (r.reportingName ?? 'unknown').trim();

      const b = byTicker.get(sym) ?? {
        symbol: sym,
        companyName: r.companyName ?? null,
        buyers: new Set<string>(),
        totalValueUsd: 0,
        totalShares: 0,
        latestDate: date,
      };
      b.buyers.add(buyer);
      b.totalValueUsd += value;
      b.totalShares += shares;
      if (date > b.latestDate) b.latestDate = date;
      if (!b.companyName && r.companyName) b.companyName = r.companyName;
      byTicker.set(sym, b);
    }

    const result: DiscoveredTicker[] = [...byTicker.values()]
      .filter((b) => b.buyers.size >= minBuyers)
      .map((b) => ({
        symbol: b.symbol,
        companyName: b.companyName,
        buyerCount: b.buyers.size,
        totalValueUsd: Math.round(b.totalValueUsd),
        totalShares: b.totalShares,
        latestDate: b.latestDate,
        reason: `Insider cluster buy: ${b.buyers.size} insiders, $${formatUsd(b.totalValueUsd)} (${days}d)`,
      }))
      // Rank by buyer count, then by $ value
      .sort((a, b) => b.buyerCount - a.buyerCount || b.totalValueUsd - a.totalValueUsd);

    await this.cache.set(cacheKey, result, 3600 * 6);
    this.logger.log(
      `Discovery: scanned ${buys.length} purchase rows across ${byTicker.size} tickers — ` +
      `${result.length} cluster buys`,
    );
    return result;
  }
}

function formatUsd(v: number): string {
  if (v >= 1e9) return (v / 1e9).toFixed(1) + 'B';
  if (v >= 1e6) return (v / 1e6).toFixed(1) + 'M';
  if (v >= 1e3) return (v / 1e3).toFixed(0) + 'K';
  return String(Math.round(v));
}
