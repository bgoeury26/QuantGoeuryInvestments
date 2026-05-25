import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ScoringService } from '../scoring/scoring.service';
import { AlphaService } from '../alpha/alpha.service';

export interface RankedOpportunity {
  symbol: string;
  name: string;
  sector: string;
  finalScore: number;
  anomalyScore: number;
  confidence: number;
  signalType: string;
  rankingScore: number;
  drivers: string[];
  isEarlyOpportunity: boolean;
  earlyFlag: boolean;
  priceChangePct: number;
  /** Why this ticker is in the universe (set by DailyDiscoveryJob). */
  discoveryReason: string | null;
  discoveredAt: string | null;
  discoveryCount: number;
}

@Injectable()
export class OpportunitiesService {
  private readonly logger = new Logger(OpportunitiesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly scoringService: ScoringService,
    private readonly alphaService: AlphaService,
  ) {}

  async getTopOpportunities(limit = 10, minScore = 0): Promise<RankedOpportunity[]> {
    // Fast path: read pre-computed StockScore rows.
    // Discovered tickers (with a discoveryReason set) bubble up ahead of
    // benchmark-only rows at equal rank — that's the whole point of the
    // flow-driven universe.
    const scores = await this.prisma.stockScore.findMany({
      orderBy: { rankingScore: 'desc' },
      take: limit * 3,
      include: { stock: true },
    });

    if (scores.length > 0) {
      return scores
        .filter((s) => s.rankingScore >= minScore)
        .sort((a, b) => {
          const aDisc = a.stock.discoveryReason ? 1 : 0;
          const bDisc = b.stock.discoveryReason ? 1 : 0;
          if (aDisc !== bDisc) return bDisc - aDisc;
          return b.rankingScore - a.rankingScore;
        })
        .slice(0, limit)
        .map((s) => ({
          symbol: s.stock.symbol,
          name: s.stock.name,
          sector: s.stock.sector ?? 'Unknown',
          finalScore: s.finalScore,
          anomalyScore: s.anomalyScore,
          confidence: s.confidenceFactor,
          signalType: 'momentum',
          rankingScore: s.rankingScore,
          drivers: [],
          isEarlyOpportunity: s.anomalyScore > 0.5,
          earlyFlag: s.anomalyScore > 0.5,
          priceChangePct: 0,
          discoveryReason: s.stock.discoveryReason ?? null,
          discoveredAt: s.stock.discoveredAt?.toISOString() ?? null,
          discoveryCount: s.stock.discoveryCount ?? 0,
        }));
    }

    // Slow path: compute live if no pre-computed scores exist yet (cold start).
    const stocks = await this.prisma.stock.findMany({ take: 30 });
    const results: RankedOpportunity[] = [];

    for (const stock of stocks) {
      try {
        const [score, anomaly] = await Promise.all([
          this.scoringService.computeScore(stock.symbol),
          this.alphaService.detectAnomaly(stock.symbol),
        ]);

        const rankingScore = parseFloat(
          (score.finalScore + anomaly.anomalyScore * 2 + (anomaly.isEarlyOpportunity ? 1 : 0)).toFixed(2),
        );

        if (rankingScore >= minScore) {
          results.push({
            symbol: stock.symbol,
            name: stock.name,
            sector: stock.sector ?? 'Unknown',
            finalScore: score.finalScore,
            anomalyScore: anomaly.anomalyScore,
            confidence: anomaly.confidence,
            signalType: anomaly.signalType,
            rankingScore,
            drivers: anomaly.drivers,
            isEarlyOpportunity: anomaly.isEarlyOpportunity,
            earlyFlag: anomaly.isEarlyOpportunity,
            priceChangePct: 0,
            discoveryReason: stock.discoveryReason ?? null,
            discoveredAt: stock.discoveredAt?.toISOString() ?? null,
            discoveryCount: stock.discoveryCount ?? 0,
          });
        }
      } catch (e) {
        this.logger.warn(`Skipping ${stock.symbol}: ${e}`);
      }
    }

    return results.sort((a, b) => b.rankingScore - a.rankingScore).slice(0, limit);
  }

  async getRankedOpportunities(limit = 10): Promise<RankedOpportunity[]> {
    return this.getTopOpportunities(limit, 0);
  }
}
