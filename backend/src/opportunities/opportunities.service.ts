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
