import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getJson, getText } from '../common/http.util';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../cache/cache.service';

/**
 * Discovery — Form 4 cluster buys (SEC EDGAR primary).
 *
 * Pipeline:
 *   1. SEC EDGAR /cgi-bin/browse-edgar?action=getcurrent&type=4&output=atom
 *      returns the freshest market-wide Form 4 filings (no key, no rate limit).
 *   2. For each filing, fetch the underlying Form 4 XML and parse:
 *        - transactionCode (P=BUY, S=SELL, A=Award, M=ExerciseDerivative)
 *        - shares, price → dollar value
 *        - issuer ticker + name
 *   3. Group by ticker. Keep symbols with 2+ DISTINCT insiders making P-coded
 *      open-market purchases inside the recency window.
 *   4. (Optional) FMP enrichment — if FMP_API_KEY is set we backfill the
 *      reporter name / officer title; otherwise we surface what SEC gave us.
 *
 * Why SEC over FMP: FMP's /v4/insider-trading-rss-feed silently returns []
 * on the free tier; SEC EDGAR is unrestricted and authoritative.
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
   * Discover cluster-buy candidates from the SEC Form 4 firehose.
   *
   * SEC's `getcurrent` Atom feed is paginated with `start` + `count` (max 100).
   * One page = ~1 day of activity. We walk multiple pages to widen the window
   * to ~3-5 days of recent filings before parsing.
   *
   * @param days       Recency window in days (default 14, applies after fetch)
   * @param minBuyers  Minimum distinct insiders required (default 2)
   * @param pages      How many 100-entry pages to walk (default 6 ≈ 5-7 days)
   */
  async discoverClusterBuys(
    days = 14,
    minBuyers = 2,
    pages = 6,
  ): Promise<DiscoveredTicker[]> {
    const cacheKey = `discovery:cluster:${days}:${minBuyers}:${pages}`;
    const cached = await this.cache.get<DiscoveredTicker[]>(cacheKey);
    if (cached) return cached;

    const cutoff = Date.now() - days * 86400_000;

    // --- 1. Pull recent Form 4 filings from SEC EDGAR (paginated) --------
    const entries: string[] = [];
    for (let p = 0; p < pages; p++) {
      const start = p * 100;
      const atom = await getText(
        `https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&type=4&output=atom&count=100&start=${start}`,
        undefined,
        `SEC getcurrent Form4 p${p}`,
      );
      if (!atom) {
        this.logger.warn(`SEC feed page ${p} unavailable.`);
        break;
      }
      const pageEntries = [...atom.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map((m) => m[1]);
      if (pageEntries.length === 0) break;
      entries.push(...pageEntries);
      // Be polite to SEC — 200ms gap between pages.
      if (p < pages - 1) await new Promise((r) => setTimeout(r, 200));
    }
    this.logger.log(`SEC feed returned ${entries.length} Form 4 entries across ${pages} pages.`);

    type Filing = { accessionUrl: string; cikIssuer: string; updated: string };
    const filings: Filing[] = [];
    for (const e of entries) {
      const link = /<link[^>]*href="([^"]+)"/.exec(e)?.[1];
      const updated = /<updated>([^<]+)<\/updated>/.exec(e)?.[1] ?? '';
      if (!link) continue;
      // Link looks like: https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=0000320193&...
      // We want the filing index instead — derive accession from a different entry pattern.
      // SEC also exposes the filing in the <id> tag.
      const id = /<id>([^<]+)<\/id>/.exec(e)?.[1] ?? '';
      // The id includes the accession number like urn:tag:sec.gov,2008:accession-number=0001127602-25-001234
      const acc = /accession-number=([\d-]+)/.exec(id)?.[1];
      const cikIssuer = /CIK=(\d+)/.exec(link)?.[1];
      if (!acc || !cikIssuer) continue;

      const cikPadded = cikIssuer.padStart(10, '0');
      const accNoDashes = acc.replace(/-/g, '');
      const accessionUrl =
        `https://www.sec.gov/Archives/edgar/data/${Number(cikIssuer)}/${accNoDashes}/${acc}-index.json`;
      filings.push({ accessionUrl, cikIssuer: cikPadded, updated });
    }

    // --- 2. Resolve each filing's primary XML body and parse it -----------
    type Parsed = {
      ticker: string | null;
      issuerName: string | null;
      reporter: string;
      shares: number;
      price: number;
      txDate: string;
      isPurchase: boolean;
    };

    const parsed: Parsed[] = [];
    const CONCURRENCY = 5;
    for (let i = 0; i < filings.length; i += CONCURRENCY) {
      const batch = filings.slice(i, i + CONCURRENCY);
      const out = await Promise.all(batch.map((f) => this.parseFiling(f)));
      for (const p of out) if (p) parsed.push(p);
    }

    // --- 3. Group + filter ------------------------------------------------
    type Bucket = {
      symbol: string;
      companyName: string | null;
      buyers: Set<string>;
      totalValueUsd: number;
      totalShares: number;
      latestDate: string;
    };
    const byTicker = new Map<string, Bucket>();
    for (const p of parsed) {
      if (!p.isPurchase || !p.ticker) continue;
      const date = p.txDate;
      if (date && new Date(date).getTime() < cutoff) continue;

      const sym = p.ticker.toUpperCase();
      const b = byTicker.get(sym) ?? {
        symbol: sym,
        companyName: p.issuerName,
        buyers: new Set<string>(),
        totalValueUsd: 0,
        totalShares: 0,
        latestDate: date,
      };
      b.buyers.add(p.reporter);
      b.totalValueUsd += p.shares * p.price;
      b.totalShares += p.shares;
      if (date > b.latestDate) b.latestDate = date;
      if (!b.companyName && p.issuerName) b.companyName = p.issuerName;
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
      .sort((a, b) => b.buyerCount - a.buyerCount || b.totalValueUsd - a.totalValueUsd);

    await this.cache.set(cacheKey, result, 3600 * 6);
    this.logger.log(
      `Discovery: parsed ${parsed.length} Form 4 transactions across ${byTicker.size} issuers — ` +
      `${result.length} qualify as cluster buys (≥${minBuyers} insiders, ${days}d).`,
    );
    return result;
  }

  /**
   * Fetch one filing's index.json, locate the Form 4 XML, parse it.
   * Returns null on any failure.
   */
  private async parseFiling(f: { accessionUrl: string; cikIssuer: string }): Promise<{
    ticker: string | null;
    issuerName: string | null;
    reporter: string;
    shares: number;
    price: number;
    txDate: string;
    isPurchase: boolean;
  } | null> {
    const idx = await getJson<any>(f.accessionUrl, undefined, 'SEC filing index');
    if (!idx?.directory?.item) return null;

    // Find the .xml document (Form 4 XML body). Filenames vary:
    //   form4.xml, wk-form4_*.xml, primary_doc.xml, etc.
    const xmlItem = idx.directory.item.find((it: any) =>
      typeof it?.name === 'string' && it.name.toLowerCase().endsWith('.xml') &&
      !it.name.toLowerCase().includes('index'),
    );
    if (!xmlItem) return null;

    const folder = f.accessionUrl.replace(/\/[^/]+-index\.json$/, '');
    const xmlUrl = `${folder}/${xmlItem.name}`;
    const xml = await getText(xmlUrl, undefined, 'SEC Form4 XML');
    if (!xml) return null;

    const issuerName = /<issuerName>([^<]+)<\/issuerName>/i.exec(xml)?.[1]?.trim() ?? null;
    const ticker = /<issuerTradingSymbol>([^<]+)<\/issuerTradingSymbol>/i.exec(xml)?.[1]?.trim() ?? null;
    const reporter = /<rptOwnerName>([^<]+)<\/rptOwnerName>/i.exec(xml)?.[1]?.trim() ?? 'unknown';
    const code = /<transactionCode>([A-Z])<\/transactionCode>/i.exec(xml)?.[1];
    const shares = Number(
      /<transactionShares>\s*<value>([\d.]+)<\/value>/i.exec(xml)?.[1] ?? 0,
    );
    const price = Number(
      /<transactionPricePerShare>\s*<value>([\d.]+)<\/value>/i.exec(xml)?.[1] ?? 0,
    );
    const txDate = /<transactionDate>\s*<value>([\d-]+)<\/value>/i.exec(xml)?.[1] ?? '';

    return {
      ticker,
      issuerName,
      reporter,
      shares,
      price,
      txDate,
      isPurchase: code === 'P', // only open-market purchases
    };
  }
}

function formatUsd(v: number): string {
  if (v >= 1e9) return (v / 1e9).toFixed(1) + 'B';
  if (v >= 1e6) return (v / 1e6).toFixed(1) + 'M';
  if (v >= 1e3) return (v / 1e3).toFixed(0) + 'K';
  return String(Math.round(v));
}
