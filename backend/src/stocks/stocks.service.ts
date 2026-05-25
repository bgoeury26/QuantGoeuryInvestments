import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CacheService } from '../cache/cache.service';
import { PrismaService } from '../prisma/prisma.service';
import { getJson, mean } from '../common/http.util';
import { QuoteConsensusService } from '../providers/quote-consensus.service';

/**
 * StocksService — quote / fundamentals / technicals / analyst / history.
 *
 * Re-platformed so each dimension uses a provider that actually responds on
 * its free tier:
 *   - Quote          -> Finnhub /quote                (works free)
 *   - Profile        -> Finnhub /stock/profile2       (works free)
 *   - Fundamentals   -> FMP /ratios + /key-metrics    (works free, 250/day)
 *   - OHLCV history  -> Polygon /v2/aggs              (Finnhub /candle is 403 paid)
 *   - Technicals     -> computed from Polygon OHLCV   (RSI/MACD/SMA in-house)
 *   - Analyst        -> FMP /analyst-estimates + /price-target-consensus
 */
@Injectable()
export class StocksService {
  private readonly logger = new Logger(StocksService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly cache: CacheService,
    private readonly prisma: PrismaService,
    private readonly consensus: QuoteConsensusService,
  ) {}

  private get fhKey() { return this.config.get<string>('FINNHUB_API_KEY'); }
  private get fmpKey() { return this.config.get<string>('FMP_API_KEY'); }
  private get polyKey() { return this.config.get<string>('POLYGON_API_KEY'); }
  private get avKey() { return this.config.get<string>('ALPHA_VANTAGE_KEY'); }

  // Sector → SPDR sector ETF (used for relative-strength comparison)
  private static readonly SECTOR_ETF: Record<string, string> = {
    'Technology':              'XLK',
    'Financials':              'XLF',
    'Health Care':             'XLV',
    'Consumer Discretionary':  'XLY',
    'Consumer Staples':        'XLP',
    'Energy':                  'XLE',
    'Industrials':             'XLI',
    'Materials':               'XLB',
    'Utilities':               'XLU',
    'Real Estate':             'XLRE',
    'Communication Services':  'XLC',
  };

  async getAll() {
    const stocks = await this.prisma.stock.findMany({
      include: { scores: { orderBy: { computedAt: 'desc' }, take: 1 } },
      orderBy: { symbol: 'asc' },
    });
    return stocks.map((s) => ({
      symbol: s.symbol,
      name: s.name,
      finalScore: s.scores[0]?.finalScore ?? null,
      rankingScore: s.scores[0]?.rankingScore ?? null,
    }));
  }

  async search(query: string) {
    const cacheKey = `stocks:search:${query.toLowerCase()}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;
    if (!this.fhKey) return [];

    const data = await getJson<any>(
      'https://finnhub.io/api/v1/search',
      { params: { q: query, token: this.fhKey } },
      'Finnhub search',
    );
    const result = (data?.result ?? [])
      .slice(0, 15)
      .map((r: any) => ({ symbol: r.symbol, description: r.description, type: r.type }));
    await this.cache.set(cacheKey, result, 3600);
    return result;
  }

  async getBySymbol(symbol: string) {
    const upper = symbol.toUpperCase();
    const cacheKey = `stocks:profile:${upper}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;
    if (!this.fhKey) throw new NotFoundException('Finnhub key not configured');

    const [profile, quote] = await Promise.all([
      getJson<any>('https://finnhub.io/api/v1/stock/profile2', {
        params: { symbol: upper, token: this.fhKey },
      }, 'Finnhub profile'),
      getJson<any>('https://finnhub.io/api/v1/quote', {
        params: { symbol: upper, token: this.fhKey },
      }, 'Finnhub quote'),
    ]);

    const result = {
      symbol: upper,
      name: profile?.name ?? upper,
      exchange: profile?.exchange,
      industry: profile?.finnhubIndustry,
      country: profile?.country,
      currency: profile?.currency,
      logo: profile?.logo,
      weburl: profile?.weburl,
      marketCap: profile?.marketCapitalization,
      shareOutstanding: profile?.shareOutstanding,
      price: quote?.c,
      change: quote?.d,
      changePercent: quote?.dp,
      high: quote?.h,
      low: quote?.l,
      open: quote?.o,
      previousClose: quote?.pc,
    };
    await this.cache.set(cacheKey, result, 600);
    return result;
  }

  async getQuote(symbol: string) {
    const upper = symbol.toUpperCase();
    const cacheKey = `stocks:quote:${upper}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    // Finnhub remains the primary because it's the only source that returns
    // intraday change / day OHLC consistently on the free tier. The consensus
    // layer cross-checks the close against TwelveData / IEX / Marketstack.
    const [fh, cons] = await Promise.all([
      this.fhKey
        ? getJson<any>('https://finnhub.io/api/v1/quote',
            { params: { symbol: upper, token: this.fhKey } }, 'Finnhub quote')
        : Promise.resolve(null),
      this.consensus.getConsensusQuote(upper),
    ]);

    const price = cons?.price ?? fh?.c ?? null;
    const result = {
      symbol: upper,
      price,
      change: fh?.d ?? null,
      changePercent: fh?.dp ?? null,
      high: fh?.h, low: fh?.l, open: fh?.o, previousClose: fh?.pc,
      timestamp: fh?.t ? new Date(fh.t * 1000).toISOString() : null,
      // Data-quality metadata — surface in UI for transparency.
      dataQuality: cons
        ? {
            sources: cons.sources,
            dispersion: cons.dispersion,
            disagreement: cons.disagreement,
            raw: cons.raw,
          }
        : null,
    };
    await this.cache.set(cacheKey, result, 60);
    return result;
  }

  /**
   * Fundamentals from FMP (free tier serves these; Finnhub /stock/metric does
   * not on free). Falls back to Finnhub /stock/metric only if FMP is absent.
   */
  async getFundamentals(symbol: string) {
    const upper = symbol.toUpperCase();
    const cacheKey = `stocks:fundamentals:${upper}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    if (this.fmpKey) {
      const [ratios, metrics, growth, surprises, upcoming] = await Promise.all([
        getJson<any[]>(`https://financialmodelingprep.com/api/v3/ratios-ttm/${upper}`, {
          params: { apikey: this.fmpKey },
        }, 'FMP ratios'),
        getJson<any[]>(`https://financialmodelingprep.com/api/v3/key-metrics-ttm/${upper}`, {
          params: { apikey: this.fmpKey },
        }, 'FMP key-metrics'),
        getJson<any[]>(`https://financialmodelingprep.com/api/v3/financial-growth/${upper}`, {
          params: { apikey: this.fmpKey, limit: 1 },
        }, 'FMP growth'),
        getJson<any[]>(`https://financialmodelingprep.com/api/v3/earnings-surprises/${upper}`, {
          params: { apikey: this.fmpKey },
        }, 'FMP earnings-surprises'),
        this.getUpcomingEarnings(upper),
      ]);
      const r = ratios?.[0] ?? {};
      const m = metrics?.[0] ?? {};
      const g = growth?.[0] ?? {};

      // Earnings momentum from the last 4 quarters of surprises.
      const earnings = this.computeEarningsMomentum(surprises ?? []);

      const result = {
        symbol: upper,
        source: 'FMP',
        peRatio: r.peRatioTTM ?? m.peRatioTTM,
        pbRatio: r.priceToBookRatioTTM,
        psRatio: r.priceToSalesRatioTTM,
        roe: r.returnOnEquityTTM,
        roa: r.returnOnAssetsTTM,
        revenueGrowth: g.revenueGrowth,
        epsGrowth: g.epsgrowth,
        grossMargin: r.grossProfitMarginTTM,
        operatingMargin: r.operatingProfitMarginTTM,
        netMargin: r.netProfitMarginTTM,
        debtEquity: r.debtEquityRatioTTM,
        currentRatio: r.currentRatioTTM,
        dividendYield: r.dividendYieldTTM,
        // Earnings momentum
        epsBeatRate4q: earnings.beatRate,
        epsSurpriseLast: earnings.lastSurprisePct,
        epsScore: earnings.score,
        // Catalyst awareness — upcoming earnings date
        nextEarningsDate: upcoming?.nextDate ?? null,
        daysUntilEarnings: upcoming?.daysUntil ?? null,
        catalystImminent: upcoming?.daysUntil != null && upcoming.daysUntil >= 0 && upcoming.daysUntil <= 14,
      };
      await this.cache.set(cacheKey, result, 3600 * 6);
      return result;
    }

    // Fallback: Finnhub metric (often sparse on free tier)
    if (!this.fhKey) return null;
    const data = await getJson<any>('https://finnhub.io/api/v1/stock/metric', {
      params: { symbol: upper, metric: 'all', token: this.fhKey },
    }, 'Finnhub metric');
    const m = data?.metric ?? {};
    const result = {
      symbol: upper,
      source: 'Finnhub',
      peRatio: m.peNormalizedAnnual ?? m.peTTM,
      pbRatio: m.pbAnnual, psRatio: m.psTTM,
      roe: m.roeTTM != null ? m.roeTTM / 100 : null,
      revenueGrowth: m.revenueGrowthTTMYoy != null ? m.revenueGrowthTTMYoy / 100 : null,
      operatingMargin: m.operatingMarginTTM != null ? m.operatingMarginTTM / 100 : null,
      netMargin: m.netProfitMarginTTM != null ? m.netProfitMarginTTM / 100 : null,
      debtEquity: m.totalDebt_totalEquityAnnual,
      currentRatio: m.currentRatioAnnual,
      dividendYield: m.currentDividendYieldTTM,
    };
    await this.cache.set(cacheKey, result, 3600 * 6);
    return result;
  }

  /**
   * Daily OHLCV from Polygon aggregates. Finnhub /stock/candle returns 403 on
   * the free tier — this is the single biggest cause of empty charts.
   */
  async getHistory(symbol: string, days = 365) {
    const upper = symbol.toUpperCase();
    const cacheKey = `stocks:history:${upper}:${days}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;
    if (!this.polyKey) {
      return { symbol: upper, candles: [], note: 'POLYGON_API_KEY not configured' };
    }

    const to = new Date().toISOString().split('T')[0];
    const from = new Date(Date.now() - days * 86400_000).toISOString().split('T')[0];
    const data = await getJson<any>(
      `https://api.polygon.io/v2/aggs/ticker/${upper}/range/1/day/${from}/${to}`,
      { params: { adjusted: 'true', sort: 'asc', limit: 50000, apiKey: this.polyKey } },
      'Polygon aggregates',
    );

    const candles =
      (data?.results ?? []).map((c: any) => ({
        date: new Date(c.t).toISOString().split('T')[0],
        open: c.o, high: c.h, low: c.l, close: c.c, volume: c.v,
      })) ?? [];

    const result = { symbol: upper, candles };
    await this.cache.set(cacheKey, result, 3600 * 4);
    return result;
  }

  /**
   * Technicals computed in-house from Polygon OHLCV — RSI(14), MACD, SMA20/50/200.
   * No dependency on premium indicator endpoints.
   */
  async getTechnicals(symbol: string) {
    const upper = symbol.toUpperCase();
    const cacheKey = `stocks:technicals:${upper}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const history: any = await this.getHistory(upper, 400);
    const closes: number[] = (history.candles ?? []).map((c: any) => c.close);

    if (closes.length < 30) {
      const result = {
        symbol: upper, rsi14: null, macd: null, macdSignal: 'neutral',
        sma20: null, sma50: null, sma200: null,
        note: 'Insufficient price history for technicals',
      };
      await this.cache.set(cacheKey, result, 1800);
      return result;
    }

    const sma = (n: number) =>
      closes.length >= n ? mean(closes.slice(-n)) : null;
    const sma20 = sma(20);
    const sma50 = sma(50);
    const sma200 = sma(200);

    const highs: number[] = (history.candles ?? []).map((c: any) => c.high);
    const lows: number[] = (history.candles ?? []).map((c: any) => c.low);

    const risk = this.computeRisk(closes, highs, lows);
    const volumes: number[] = (history.candles ?? []).map((c: any) => c.volume);
    const volumeRatio = this.computeVolumeRatio(volumes);

    const result = {
      symbol: upper,
      rsi14: this.computeRsi(closes, 14),
      ...this.computeMacd(closes),
      sma20, sma50, sma200,
      price: closes[closes.length - 1],
      recentCloses: closes.slice(-10),
      volumeRatio,
      ...risk,
    };
    await this.cache.set(cacheKey, result, 1800);
    return result;
  }

  /**
   * Risk metrics from OHLCV history:
   *   - atr14            Average True Range over 14 days (Wilder)
   *   - volAnnualized    Annualized realized vol from daily log returns (√252)
   *   - maxDrawdown      Largest peak-to-trough decline in the window (negative)
   *   - sharpeProxy      Annualized return divided by annualized vol (no rf)
   *   - riskScore        0–10, higher = lower-risk / better risk-adjusted profile
   */
  private computeRisk(
    closes: number[], highs: number[], lows: number[],
  ): {
    atr14: number | null;
    volAnnualized: number | null;
    maxDrawdown: number | null;
    sharpeProxy: number | null;
    riskScore: number | null;
  } {
    if (closes.length < 30) {
      return { atr14: null, volAnnualized: null, maxDrawdown: null, sharpeProxy: null, riskScore: null };
    }

    // ATR(14)
    const trs: number[] = [];
    for (let i = 1; i < closes.length; i++) {
      const tr = Math.max(
        highs[i] - lows[i],
        Math.abs(highs[i] - closes[i - 1]),
        Math.abs(lows[i] - closes[i - 1]),
      );
      trs.push(tr);
    }
    const atr14 = trs.length >= 14
      ? trs.slice(-14).reduce((a, b) => a + b, 0) / 14
      : null;

    // Annualized vol from log returns
    const logReturns: number[] = [];
    for (let i = 1; i < closes.length; i++) {
      if (closes[i - 1] > 0) logReturns.push(Math.log(closes[i] / closes[i - 1]));
    }
    const meanRet = logReturns.reduce((a, b) => a + b, 0) / logReturns.length;
    const variance =
      logReturns.reduce((a, b) => a + (b - meanRet) ** 2, 0) / Math.max(logReturns.length - 1, 1);
    const dailyVol = Math.sqrt(variance);
    const volAnnualized = dailyVol * Math.sqrt(252);

    // Max drawdown
    let peak = closes[0], maxDd = 0;
    for (const c of closes) {
      if (c > peak) peak = c;
      const dd = (c - peak) / peak;
      if (dd < maxDd) maxDd = dd;
    }

    // Sharpe-style proxy (no risk-free rate, no excess)
    const annualizedReturn = meanRet * 252;
    const sharpeProxy = volAnnualized > 0 ? annualizedReturn / volAnnualized : null;

    // riskScore: higher = better (low vol, shallow drawdown, decent Sharpe)
    let s = 5;
    if (volAnnualized != null) {
      // mature mega-caps run ~20–35% annual vol; mark down spikes
      s += volAnnualized < 0.25 ? 1 : volAnnualized > 0.5 ? -1.5 : 0;
    }
    if (maxDd != null) {
      s += maxDd > -0.15 ? 1 : maxDd < -0.35 ? -1.5 : 0;
    }
    if (sharpeProxy != null) {
      s += sharpeProxy > 1 ? 1.5 : sharpeProxy < -0.5 ? -1.5 : 0;
    }
    const riskScore = Math.max(0, Math.min(10, s));

    return {
      atr14: atr14 != null ? Math.round(atr14 * 100) / 100 : null,
      volAnnualized: Math.round(volAnnualized * 1000) / 1000,
      maxDrawdown: Math.round(maxDd * 1000) / 1000,
      sharpeProxy: sharpeProxy != null ? Math.round(sharpeProxy * 100) / 100 : null,
      riskScore: Math.round(riskScore * 10) / 10,
    };
  }

  /** Most-recent volume divided by trailing 30-day average. >1 = above avg. */
  private computeVolumeRatio(volumes: number[]): number | null {
    if (volumes.length < 31) return null;
    const recent = volumes[volumes.length - 1];
    const avg30 = mean(volumes.slice(-31, -1));
    if (!avg30) return null;
    return Math.round((recent / avg30) * 100) / 100;
  }

  /**
   * Relative strength vs the SPDR ETF for the stock's sector, measured over
   * the last 30 trading sessions. Returns the stock's return minus the sector
   * return, plus a normalized score in [0, 10].
   */
  async getRelativeStrength(symbol: string, sector: string | null): Promise<{
    stockReturn30d: number | null;
    sectorReturn30d: number | null;
    relativeStrength: number | null;
    rsScore: number | null;
    sectorEtf: string | null;
  }> {
    const upper = symbol.toUpperCase();
    const etf = sector ? StocksService.SECTOR_ETF[sector] ?? null : null;
    const cacheKey = `stocks:rs:${upper}:${etf ?? 'none'}`;
    const cached = await this.cache.get<any>(cacheKey);
    if (cached) return cached;

    if (!etf || !this.polyKey) {
      const result = { stockReturn30d: null, sectorReturn30d: null, relativeStrength: null, rsScore: null, sectorEtf: etf };
      await this.cache.set(cacheKey, result, 3600);
      return result;
    }

    const ret = async (sym: string): Promise<number | null> => {
      const hist: any = await this.getHistory(sym, 45);
      const closes: number[] = (hist.candles ?? []).map((c: any) => c.close);
      if (closes.length < 21) return null;
      const last = closes[closes.length - 1];
      const start = closes[Math.max(0, closes.length - 21)];
      return start > 0 ? (last - start) / start : null;
    };

    const [stockRet, sectorRet] = await Promise.all([ret(upper), ret(etf)]);
    let rs: number | null = null, rsScore: number | null = null;
    if (stockRet != null && sectorRet != null) {
      rs = stockRet - sectorRet;
      // map a 5-pt relative outperformance to one score point
      rsScore = Math.max(0, Math.min(10, 5 + rs * 20));
    }

    const result = {
      stockReturn30d: stockRet != null ? Math.round(stockRet * 1000) / 1000 : null,
      sectorReturn30d: sectorRet != null ? Math.round(sectorRet * 1000) / 1000 : null,
      relativeStrength: rs != null ? Math.round(rs * 1000) / 1000 : null,
      rsScore: rsScore != null ? Math.round(rsScore * 10) / 10 : null,
      sectorEtf: etf,
    };
    await this.cache.set(cacheKey, result, 3600);
    return result;
  }

  /**
   * Upcoming earnings via Alpha Vantage EARNINGS_CALENDAR (free, 25/day).
   * Returns the next earnings date and days-until, or null if not available.
   *
   * Why Alpha Vantage and not FMP: FMP's /v3/earning_calendar requires a paid
   * tier for ticker filtering; AV's CSV endpoint is fully free and filterable.
   */
  async getUpcomingEarnings(symbol: string): Promise<{
    nextDate: string | null; daysUntil: number | null;
  } | null> {
    if (!this.avKey) return null;
    const upper = symbol.toUpperCase();
    const cacheKey = `stocks:earnings-cal:${upper}`;
    const cached = await this.cache.get<any>(cacheKey);
    if (cached) return cached;

    // AV returns CSV; we fetch as text and parse.
    const url = `https://www.alphavantage.co/query?function=EARNINGS_CALENDAR&symbol=${upper}&horizon=3month&apikey=${this.avKey}`;
    try {
      const res = await (await import('axios')).default.get<string>(url, { timeout: 12000 });
      const csv = String(res.data ?? '');
      const lines = csv.split(/\r?\n/).filter(Boolean);
      if (lines.length < 2) {
        const out = { nextDate: null, daysUntil: null };
        await this.cache.set(cacheKey, out, 86400);
        return out;
      }
      const header = lines[0].split(',');
      const dateIdx = header.indexOf('reportDate');
      const row = lines[1].split(',');
      const date = dateIdx >= 0 ? row[dateIdx] : null;
      if (!date) {
        const out = { nextDate: null, daysUntil: null };
        await this.cache.set(cacheKey, out, 86400);
        return out;
      }
      const daysUntil = Math.round((new Date(date).getTime() - Date.now()) / 86400_000);
      const out = { nextDate: date, daysUntil };
      await this.cache.set(cacheKey, out, 86400);
      return out;
    } catch (e) {
      this.logger.warn(`AV earnings-calendar failed for ${upper}: ${e}`);
      return null;
    }
  }

  /**
   * Earnings momentum from FMP /earnings-surprises:
   *   - beatRate: share of the last 4 quarters where actual EPS ≥ estimate
   *   - lastSurprisePct: latest quarter's (actual - estimate) / |estimate|
   *   - score: 0–10 (5 = neutral; +1 per beat, +2 if last beat > 10%)
   */
  private computeEarningsMomentum(
    surprises: { actualEarningResult?: number; estimatedEarning?: number }[],
  ): { beatRate: number | null; lastSurprisePct: number | null; score: number | null } {
    if (!Array.isArray(surprises) || surprises.length === 0) {
      return { beatRate: null, lastSurprisePct: null, score: null };
    }
    const last4 = surprises.slice(0, 4);
    let beats = 0;
    for (const q of last4) {
      const a = q.actualEarningResult, e = q.estimatedEarning;
      if (a != null && e != null && a >= e) beats++;
    }
    const beatRate = beats / last4.length;

    const latest = last4[0];
    let lastSurprisePct: number | null = null;
    if (latest?.actualEarningResult != null && latest.estimatedEarning != null && latest.estimatedEarning !== 0) {
      lastSurprisePct =
        (latest.actualEarningResult - latest.estimatedEarning) / Math.abs(latest.estimatedEarning);
    }

    let s = 5 + beats - 2; // 2 beats = neutral; each extra beat = +1
    if (lastSurprisePct != null) {
      s += lastSurprisePct > 0.1 ? 1.5 : lastSurprisePct < -0.1 ? -1.5 : 0;
    }
    const score = Math.max(0, Math.min(10, s));

    return {
      beatRate: Math.round(beatRate * 100) / 100,
      lastSurprisePct: lastSurprisePct != null ? Math.round(lastSurprisePct * 1000) / 1000 : null,
      score: Math.round(score * 10) / 10,
    };
  }

  /** Wilder's RSI. */
  private computeRsi(closes: number[], period = 14): number | null {
    if (closes.length < period + 1) return null;
    let gains = 0, losses = 0;
    for (let i = closes.length - period; i < closes.length; i++) {
      const diff = closes[i] - closes[i - 1];
      if (diff >= 0) gains += diff;
      else losses -= diff;
    }
    const avgGain = gains / period;
    const avgLoss = losses / period;
    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return Math.round((100 - 100 / (1 + rs)) * 100) / 100;
  }

  /** MACD(12,26,9) — returns line, signal, histogram, and a direction string. */
  private computeMacd(closes: number[]): {
    macd: number | null; macdHistogram: number | null; macdSignal: string;
  } {
    if (closes.length < 35) return { macd: null, macdHistogram: null, macdSignal: 'neutral' };
    const ema = (data: number[], n: number): number[] => {
      const k = 2 / (n + 1);
      const out = [data[0]];
      for (let i = 1; i < data.length; i++) out.push(data[i] * k + out[i - 1] * (1 - k));
      return out;
    };
    const ema12 = ema(closes, 12);
    const ema26 = ema(closes, 26);
    const macdLine = closes.map((_, i) => ema12[i] - ema26[i]);
    const signalLine = ema(macdLine.slice(25), 9);
    const macd = macdLine[macdLine.length - 1];
    const signal = signalLine[signalLine.length - 1];
    const hist = macd - signal;
    return {
      macd: Math.round(macd * 1000) / 1000,
      macdHistogram: Math.round(hist * 1000) / 1000,
      macdSignal: hist > 0 ? 'bullish' : hist < 0 ? 'bearish' : 'neutral',
    };
  }

  /** Analyst consensus from FMP (free tier serves estimates + price targets). */
  async getAnalystRatings(symbol: string) {
    const upper = symbol.toUpperCase();
    const cacheKey = `stocks:analyst:${upper}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    if (this.fmpKey) {
      const [target, grades] = await Promise.all([
        getJson<any>(`https://financialmodelingprep.com/api/v4/price-target-consensus`, {
          params: { symbol: upper, apikey: this.fmpKey },
        }, 'FMP price-target'),
        getJson<any[]>(`https://financialmodelingprep.com/api/v3/grade/${upper}`, {
          params: { apikey: this.fmpKey, limit: 20 },
        }, 'FMP grades'),
      ]);

      const list = Array.isArray(grades) ? grades : [];
      const count = (re: RegExp) =>
        list.filter((g) => re.test(g.newGrade ?? '')).length;
      const result = {
        symbol: upper,
        source: 'FMP',
        strongBuy: count(/strong buy/i),
        buy: count(/^buy$|outperform|overweight/i),
        hold: count(/hold|neutral|equal/i),
        sell: count(/^sell$|underperform|underweight/i),
        strongSell: count(/strong sell/i),
        priceTarget: target?.targetConsensus ?? target?.targetMedian,
        targetHigh: target?.targetHigh,
        targetLow: target?.targetLow,
        recentGrades: list.slice(0, 5).map((g) => ({
          firm: g.gradingCompany, grade: g.newGrade, date: g.date,
        })),
      };
      await this.cache.set(cacheKey, result, 3600 * 6);
      return result;
    }

    // Fallback: Finnhub recommendation (works free, limited)
    if (!this.fhKey) return null;
    const rec = await getJson<any[]>('https://finnhub.io/api/v1/stock/recommendation', {
      params: { symbol: upper, token: this.fhKey },
    }, 'Finnhub recommendation');
    const r = Array.isArray(rec) ? rec[0] : null;
    const result = {
      symbol: upper,
      source: 'Finnhub',
      strongBuy: r?.strongBuy ?? 0, buy: r?.buy ?? 0, hold: r?.hold ?? 0,
      sell: r?.sell ?? 0, strongSell: r?.strongSell ?? 0,
      period: r?.period, priceTarget: null,
    };
    await this.cache.set(cacheKey, result, 3600 * 6);
    return result;
  }
}
