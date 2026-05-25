import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ScoringService } from './scoring.service';
import { AlphaService } from '../alpha/alpha.service';

/**
 * ScoringRefreshService — manual re-scoring across every Stock currently in
 * the DB. No cron of its own anymore; the daily flow-driven path
 * (DailyDiscoveryJob) is the primary refresh, and this service is here for
 * one-off admin refreshes (POST /admin/refresh-scores) when you want to
 * re-score the existing universe without waiting for new discoveries.
 */
@Injectable()
export class ScoringRefreshService {
  private readonly logger = new Logger(ScoringRefreshService.name);
  private inFlight = false;
  private lastRunStartedAt: Date | null = null;
  private lastRunFinishedAt: Date | null = null;
  private lastSuccess = 0;
  private lastFailure = 0;

  constructor(
    private readonly prisma: PrismaService,
    private readonly scoring: ScoringService,
    private readonly alpha: AlphaService,
  ) {}

  /** Returns a status snapshot for the admin UI. */
  status() {
    return {
      inFlight: this.inFlight,
      lastRunStartedAt: this.lastRunStartedAt,
      lastRunFinishedAt: this.lastRunFinishedAt,
      lastSuccess: this.lastSuccess,
      lastFailure: this.lastFailure,
    };
  }

  /**
   * Iterate every stock and compute its score + anomaly. Returns counts.
   * Safe to call concurrently — the in-flight flag skips overlapping runs.
   */
  async refreshAll(): Promise<{ scanned: number; ok: number; failed: number }> {
    if (this.inFlight) {
      this.logger.warn('Refresh already in flight — skipping.');
      return { scanned: 0, ok: 0, failed: 0 };
    }
    this.inFlight = true;
    this.lastRunStartedAt = new Date();
    let ok = 0, failed = 0;

    try {
      const stocks = await this.prisma.stock.findMany({ orderBy: { symbol: 'asc' } });
      this.logger.log(`Refreshing scores for ${stocks.length} stocks...`);

      const CONCURRENCY = 3;
      for (let i = 0; i < stocks.length; i += CONCURRENCY) {
        const batch = stocks.slice(i, i + CONCURRENCY);
        const results = await Promise.allSettled(
          batch.map((s) =>
            Promise.all([
              this.scoring.computeScore(s.symbol),
              this.alpha.detectAnomaly(s.symbol),
            ]),
          ),
        );
        for (const r of results) r.status === 'fulfilled' ? ok++ : failed++;

        // light throttle between batches — FMP free tier is 250/day
        if (i + CONCURRENCY < stocks.length) {
          await new Promise((res) => setTimeout(res, 500));
        }
      }

      this.lastSuccess = ok;
      this.lastFailure = failed;
      this.logger.log(`Refresh complete: ${ok} ok, ${failed} failed.`);
      return { scanned: stocks.length, ok, failed };
    } finally {
      this.lastRunFinishedAt = new Date();
      this.inFlight = false;
    }
  }
}
