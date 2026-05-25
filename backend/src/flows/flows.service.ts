import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CacheService } from '../cache/cache.service';
import { PrismaService } from '../prisma/prisma.service';
import { getJson, getText } from '../common/http.util';

/**
 * FlowsService — smart-money tracking.
 *
 * Re-platformed off Finnhub premium endpoints (which return 403/empty on the
 * free tier) onto genuinely-free sources:
 *   - Insider trades       -> SEC EDGAR Form 4 full-text search  (no key)
 *   - Institutional 13F    -> SEC EDGAR full-text search          (no key)
 *   - Political trades     -> Congress API STOCK Act disclosures  (CONGRESS_API_KEY)
 *
 * SEC requires a descriptive User-Agent (set globally in http.util).
 */
@Injectable()
export class FlowsService {
  private readonly logger = new Logger(FlowsService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly cache: CacheService,
    private readonly prisma: PrismaService,
  ) {}

  /** Resolve a ticker -> zero-padded 10-digit CIK via SEC's ticker map. */
  private async resolveCik(symbol: string): Promise<string | null> {
    const upper = symbol.toUpperCase();
    const cacheKey = `flows:cik:${upper}`;
    const cached = await this.cache.get<string>(cacheKey);
    if (cached) return cached;

    const map = await getJson<Record<string, { ticker: string; cik_str: number }>>(
      'https://www.sec.gov/files/company_tickers.json',
      undefined,
      'SEC ticker map',
    );
    if (!map) return null;

    const entry = Object.values(map).find((e) => e.ticker?.toUpperCase() === upper);
    if (!entry) return null;

    const cik = String(entry.cik_str).padStart(10, '0');
    await this.cache.set(cacheKey, cik, 86400 * 7); // tickers->CIK rarely change
    return cik;
  }

  // ---------------------------------------------------------------- INSIDER
  async getInsider(symbol: string) {
    const upper = symbol.toUpperCase();
    const cacheKey = `flows:insider:${upper}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const cik = await this.resolveCik(upper);
    if (!cik) {
      return { symbol: upper, trades: [], source: 'SEC EDGAR', note: 'CIK not found' };
    }

    const subs = await getJson<any>(
      `https://data.sec.gov/submissions/CIK${cik}.json`,
      undefined,
      'SEC submissions',
    );
    const recent = subs?.filings?.recent;
    const trades: any[] = [];

    // Collect up to 30 Form 4 entries (with their accession + primary doc).
    const candidates: { acc: string; primaryDoc: string; filingDate: string | null }[] = [];
    if (recent?.form) {
      for (let i = 0; i < recent.form.length && candidates.length < 10; i++) {
        if (recent.form[i] !== '4') continue;
        candidates.push({
          acc: recent.accessionNumber?.[i] ?? '',
          primaryDoc: recent.primaryDocument?.[i] ?? '',
          filingDate: recent.filingDate?.[i] ?? null,
        });
      }
    }

    // Parse each Form 4 XML body in parallel (capped concurrency via Promise.all
    // on a small N). SEC requires the descriptive UA we set globally.
    const parsed = await Promise.all(
      candidates.map(async (c) => {
        if (!c.acc) return null;
        const accNoDashes = c.acc.replace(/-/g, '');
        const baseFolder = `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${accNoDashes}`;
        const docUrl = c.primaryDoc
          ? `${baseFolder}/${c.primaryDoc}`
          : `${baseFolder}/${c.acc}-index.html`;

        const xml = await getText(docUrl, undefined, 'SEC Form4');
        if (typeof xml !== 'string') {
          return {
            name: subs.name ?? upper,
            transactionType: 'FILING',
            filingDate: c.filingDate,
            transactionDate: c.filingDate,
            shares: 0,
            value: 0,
            url: docUrl,
          };
        }

        // Lightweight regex extraction — Form 4 is small, well-defined XML.
        // <rptOwnerName>, <transactionCode>, <transactionShares><value>, <transactionPricePerShare><value>
        const ownerName = /<rptOwnerName>([^<]+)<\/rptOwnerName>/i.exec(xml)?.[1]?.trim() ?? subs.name ?? upper;
        const codes = [...xml.matchAll(/<transactionCode>([A-Z])<\/transactionCode>/gi)].map((m) => m[1]);
        const sharesArr = [...xml.matchAll(/<transactionShares>\s*<value>([\d.]+)<\/value>/gi)].map((m) => Number(m[1]));
        const pricesArr = [...xml.matchAll(/<transactionPricePerShare>\s*<value>([\d.]+)<\/value>/gi)].map((m) => Number(m[1]));
        const txDate = /<transactionDate>\s*<value>([\d-]+)<\/value>/i.exec(xml)?.[1] ?? c.filingDate;

        // Form 4 transaction codes:
        //   P = open-market purchase  (BUY)
        //   S = open-market sale       (SELL)
        //   A = grant/award            (other)
        //   M = exercise of derivative (other)
        // Use the first transaction line as representative.
        const code = codes[0];
        const shares = sharesArr[0] ?? 0;
        const price = pricesArr[0] ?? 0;
        const value = shares * price;
        const txType = code === 'P' ? 'BUY' : code === 'S' ? 'SELL' : 'OTHER';

        return {
          name: ownerName,
          transactionType: txType,
          transactionCode: code ?? null,
          filingDate: c.filingDate,
          transactionDate: txDate,
          shares,
          price,
          value: Math.round(value),
          url: docUrl,
        };
      }),
    );

    const valid = parsed.filter(Boolean) as any[];
    const buys = valid.filter((t) => t.transactionType === 'BUY');
    const sells = valid.filter((t) => t.transactionType === 'SELL');
    const netValue = buys.reduce((a, b) => a + (b.value ?? 0), 0) - sells.reduce((a, b) => a + (b.value ?? 0), 0);
    const netShares = buys.reduce((a, b) => a + (b.shares ?? 0), 0) - sells.reduce((a, b) => a + (b.shares ?? 0), 0);

    const result = {
      symbol: upper,
      trades: valid,
      buys: buys.length,
      sells: sells.length,
      netValue,
      netShares,
      source: 'SEC EDGAR Form 4 (parsed)',
      note: valid.length === 0 ? 'No recent Form 4 filings' : undefined,
    };
    await this.cache.set(cacheKey, result, 3600 * 6);
    return result;
  }

  // -------------------------------------------------------- INSTITUTIONAL
  async getInstitutional(symbol: string) {
    const upper = symbol.toUpperCase();
    const cacheKey = `flows:institutional:${upper}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    // SEC full-text search for 13F-HR filings mentioning the ticker.
    const data = await getJson<any>(
      'https://efts.sec.gov/LATEST/search-index',
      { params: { q: `"${upper}"`, forms: '13F-HR' } },
      'SEC 13F search',
    ).catch(() => null);

    const hits =
      (data?.hits?.hits ?? []).slice(0, 20).map((h: any) => ({
        name: h?._source?.display_names?.[0] ?? 'Unknown filer',
        filingDate: h?._source?.file_date ?? null,
        accessionNumber: h?._id ?? null,
      })) ?? [];

    const result = {
      symbol: upper,
      holders: hits,
      source: 'SEC EDGAR 13F-HR',
      note:
        hits.length === 0
          ? '13F data is filed quarterly and lags ~45 days.'
          : 'Position sizes require parsing the 13F information table.',
    };
    await this.cache.set(cacheKey, result, 3600 * 12);
    return result;
  }

  // ------------------------------------------------------------ POLITICAL
  async getPolitical(symbol: string) {
    const upper = symbol.toUpperCase();
    const cacheKey = `flows:political:${upper}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const all = await this.fetchCongressTrades();
    const trades = all.filter((t) => t.ticker === upper);

    const result = {
      symbol: upper,
      trades,
      source: 'Congress STOCK Act disclosures',
      note: 'Congressional trades are disclosed with a 30-45 day legal lag.',
    };
    await this.cache.set(cacheKey, result, 3600 * 12);
    return result;
  }

  /**
   * Congress trade data. The official Congress API does not expose STOCK Act
   * transactions directly; the community-maintained dataset at
   * github.com/timothycarambat / senatestockwatcher mirrors the House &
   * Senate disclosure PDFs as JSON. We use the House feed as the primary
   * free source and cache aggressively.
   */
  private async fetchCongressTrades(): Promise<
    { ticker: string; representative: string; type: string; amount: string; date: string }[]
  > {
    const cacheKey = 'flows:congress:all';
    const cached = await this.cache.get<any[]>(cacheKey);
    if (cached) return cached;

    const data = await getJson<any[]>(
      'https://house-stock-watcher-data.s3-us-west-2.amazonaws.com/data/all_transactions.json',
      undefined,
      'House stock watcher',
    );

    const trades = Array.isArray(data)
      ? data
          .slice(-2000) // most recent chunk only
          .map((t) => ({
            ticker: (t.ticker ?? '').toUpperCase(),
            representative: t.representative ?? 'Unknown',
            type: t.type ?? 'unknown',
            amount: t.amount ?? 'unknown',
            date: t.transaction_date ?? t.disclosure_date ?? '',
          }))
          .filter((t) => t.ticker && t.ticker !== '--')
      : [];

    await this.cache.set(cacheKey, trades, 3600 * 24);
    return trades;
  }

  // -------------------------------------------------------------- SUMMARY
  async getSummary(symbol: string) {
    const upper = symbol.toUpperCase();
    const [inst, insider, political] = await Promise.all([
      this.getInstitutional(upper),
      this.getInsider(upper),
      this.getPolitical(upper),
    ]);

    const polBuys = (political.trades as any[]).filter((t) =>
      /buy|purchase/i.test(t.type),
    ).length;
    const polSells = (political.trades as any[]).filter((t) =>
      /sale|sell/i.test(t.type),
    ).length;

    return {
      symbol: upper,
      institutional: { recentFilings: (inst.holders as any[]).length },
      insider: { recentForm4: (insider.trades as any[]).length },
      political: { trades: (political.trades as any[]).length, buys: polBuys, sells: polSells },
      signal:
        polBuys > polSells ? 'BULLISH' : polSells > polBuys ? 'BEARISH' : 'NEUTRAL',
    };
  }

  async getGlobalSummary(
    symbols: string[] = ['AAPL', 'NVDA', 'MSFT', 'TSLA', 'META', 'AMZN', 'GOOGL', 'JPM', 'V', 'SPY'],
  ) {
    const results = await Promise.allSettled(symbols.map((s) => this.getSummary(s)));
    return {
      summaries: results
        .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled')
        .map((r) => r.value),
    };
  }

  async getRecentInsiderTrades(limit = 50) {
    const cacheKey = `flows:insider:all:${limit}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const stocks = await this.prisma.stock.findMany({ take: 10, orderBy: { symbol: 'asc' } });
    const allTrades: any[] = [];
    for (const stock of stocks) {
      const data: any = await this.getInsider(stock.symbol).catch(() => null);
      if (data?.trades?.length) {
        allTrades.push(...data.trades.map((t: any) => ({ ...t, symbol: stock.symbol })));
      }
    }

    const result = {
      trades: allTrades
        .sort(
          (a, b) =>
            new Date(b.filingDate ?? 0).getTime() - new Date(a.filingDate ?? 0).getTime(),
        )
        .slice(0, limit),
    };
    await this.cache.set(cacheKey, result, 3600);
    return result;
  }

  async getRecentPolitical(limit = 50) {
    const cacheKey = `flows:political:all:${limit}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const all = await this.fetchCongressTrades();
    const result = {
      trades: all
        .sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime())
        .slice(0, limit),
      source: 'Congress STOCK Act disclosures',
    };
    await this.cache.set(cacheKey, result, 3600 * 12);
    return result;
  }
}
