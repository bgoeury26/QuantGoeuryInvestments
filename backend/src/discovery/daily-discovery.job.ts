import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { DiscoveryService } from './discovery.service';
import { ScoringService } from '../scoring/scoring.service';
import { AlphaService } from '../alpha/alpha.service';

/**
 * DailyDiscoveryJob
 *
 * 8:00 AM America/New_York every weekday: pull the freshest Form 4 cluster
 * buys, upsert each as a Stock row (stamped with the discovery reason), then
 * score + run anomaly detection on each one.
 *
 * No background ticker churn — the only stocks the platform actively maintains
 * are (a) benchmarks (SPY/QQQ), (b) yesterday's discoveries that still appear
 * in the rolling window, and (c) anything the user explicitly searches.
 */
@Injectable()
export class DailyDiscoveryJob implements OnModuleInit {
  private readonly logger = new Logger(DailyDiscoveryJob.name);

  private inFlight = false;
  private lastRunStartedAt: Date | null = null;
  private lastRunFinishedAt: Date | null = null;
  private lastDiscovered = 0;
  private lastScored = 0;
  private lastFailed = 0;

  constructor(
    private readonly prisma: PrismaService,
    private readonly discovery: DiscoveryService,
    private readonly scoring: ScoringService,
    private readonly alpha: AlphaService,
  ) {}

  async onModuleInit() {
    // First-boot kick: if no recent discoveries, run one in the background
    // so the dashboard isn't empty until tomorrow morning.
    const recent = await this.prisma.stock
      .count({ where: { discoveredAt: { gte: new Date(Date.now() - 7 * 86400_000) } } })
      .catch(() => 0);
    if (recent === 0) {
      this.logger.log('No recent discoveries — running initial pass in background.');
      this.runDiscovery().catch((e) => this.logger.error(`Initial discovery failed: ${e}`));
    }
  }

  @Cron('0 8 * * 1-5', { timeZone: 'America/New_York' })
  async dailyAt8amET() {
    await this.runDiscovery();
  }

  status() {
    return {
      inFlight: this.inFlight,
      lastRunStartedAt: this.lastRunStartedAt,
      lastRunFinishedAt: this.lastRunFinishedAt,
      lastDiscovered: this.lastDiscovered,
      lastScored: this.lastScored,
      lastFailed: this.lastFailed,
    };
  }

  /**
   * Discover cluster-buy tickers → upsert as Stock with reason → compute score
   * + anomaly for each. Safe to call manually via /admin/discover-now.
   */
  async runDiscovery(): Promise<{
    discovered: number; scored: number; failed: number; tickers: string[];
  }> {
    if (this.inFlight) {
      this.logger.warn('Discovery already in flight — skipping.');
      return { discovered: 0, scored: 0, failed: 0, tickers: [] };
    }
    this.inFlight = true;
    this.lastRunStartedAt = new Date();
    let scored = 0, failed = 0;
    const tickers: string[] = [];

    try {
      const found = await this.discovery.discoverClusterBuys();
      this.lastDiscovered = found.length;
      this.logger.log(`Discovered ${found.length} cluster-buy tickers.`);

      if (found.length === 0) {
        return { discovered: 0, scored: 0, failed: 0, tickers: [] };
      }

      // Upsert each Stock with the discovery reason / timestamp.
      for (const t of found) {
        await this.prisma.stock.upsert({
          where: { symbol: t.symbol },
          create: {
            symbol: t.symbol,
            name: t.companyName ?? t.symbol,
            discoveryReason: t.reason,
            discoveredAt: new Date(),
            discoveryCount: 1,
          },
          update: {
            name: t.companyName ?? undefined,
            discoveryReason: t.reason,
            discoveredAt: new Date(),
            discoveryCount: { increment: 1 },
          },
        });
        tickers.push(t.symbol);
      }

      // Score them in small batches — gentle on FMP free tier.
      const CONCURRENCY = 3;
      for (let i = 0; i < found.length; i += CONCURRENCY) {
        const batch = found.slice(i, i + CONCURRENCY);
        const results = await Promise.allSettled(
          batch.map((t) =>
            Promise.all([
              this.scoring.computeScore(t.symbol),
              this.alpha.detectAnomaly(t.symbol),
            ]),
          ),
        );
        for (const r of results) r.status === 'fulfilled' ? scored++ : failed++;
        if (i + CONCURRENCY < found.length) {
          await new Promise((res) => setTimeout(res, 500));
        }
      }

      this.lastScored = scored;
      this.lastFailed = failed;
      this.logger.log(`Discovery complete: ${scored} scored, ${failed} failed.`);
      return { discovered: found.length, scored, failed, tickers };
    } finally {
      this.lastRunFinishedAt = new Date();
      this.inFlight = false;
    }
  }
}
