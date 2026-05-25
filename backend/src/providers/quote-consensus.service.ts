import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getJson } from '../common/http.util';
import { TwelveDataService } from './twelvedata.service';
import { MarketstackService } from './marketstack.service';
import { TiingoService } from './tiingo.service';

export interface ConsensusQuote {
  symbol: string;
  /** Median price across configured providers. */
  price: number;
  /** Cross-source dispersion = (max - min) / median. */
  dispersion: number;
  /** Names of providers that returned a usable price. */
  sources: string[];
  /** True when dispersion > 2% — surface in UI as a data-quality flag. */
  disagreement: boolean;
  /** Per-provider raw prices for transparency. */
  raw: Record<string, number>;
}

/**
 * QuoteConsensusService — cross-checks the latest quote across multiple
 * providers (Finnhub + TwelveData + Marketstack + Tiingo as available) and
 * returns the median plus a disagreement flag.
 *
 * The goal isn't to fight tiny tick-level differences (the SIP feed costs
 * money; free quotes lag); it's to catch the case where one provider has
 * stale/wrong data and skews the score.
 */
@Injectable()
export class QuoteConsensusService {
  private readonly logger = new Logger(QuoteConsensusService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly td: TwelveDataService,
    private readonly ms: MarketstackService,
    private readonly tiingo: TiingoService,
  ) {}

  private get fhKey() { return this.config.get<string>('FINNHUB_API_KEY'); }

  async getConsensusQuote(symbol: string): Promise<ConsensusQuote | null> {
    const upper = symbol.toUpperCase();
    const fhPromise = this.fhKey
      ? getJson<any>('https://finnhub.io/api/v1/quote',
          { params: { symbol: upper, token: this.fhKey } }, 'Finnhub quote (consensus)')
          .then((r) => (r?.c ? { price: Number(r.c) } : null))
      : Promise.resolve(null);

    const [fh, td, ms, tn] = await Promise.all([
      fhPromise,
      this.td.getQuote(upper),
      this.ms.getLatestEod(upper),
      this.tiingo.getDailyClose(upper),
    ]);

    const raw: Record<string, number> = {};
    if (fh?.price) raw.finnhub = fh.price;
    if (td?.price) raw.twelvedata = td.price;
    if (ms?.close) raw.marketstack = ms.close;
    if (tn?.close) raw.tiingo = tn.close;

    const prices = Object.values(raw).filter((p) => p > 0);
    if (prices.length === 0) return null;

    prices.sort((a, b) => a - b);
    const median = prices.length % 2
      ? prices[Math.floor(prices.length / 2)]
      : (prices[prices.length / 2 - 1] + prices[prices.length / 2]) / 2;
    const dispersion = prices.length >= 2
      ? (prices[prices.length - 1] - prices[0]) / median
      : 0;

    const result: ConsensusQuote = {
      symbol: upper,
      price: Math.round(median * 100) / 100,
      dispersion: Math.round(dispersion * 10000) / 10000,
      sources: Object.keys(raw),
      disagreement: dispersion > 0.02, // 2% threshold
      raw,
    };

    if (result.disagreement) {
      this.logger.warn(
        `Quote dispersion for ${upper}: ${(dispersion * 100).toFixed(2)}% ` +
        `across ${result.sources.join(',')} — using median $${result.price}.`,
      );
    }
    return result;
  }
}
