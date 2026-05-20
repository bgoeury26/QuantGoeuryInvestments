import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ScoringService } from '../scoring/scoring.service';
import { AlphaService } from '../alpha/alpha.service';

@Injectable()
export class OpportunitiesService {
  constructor(private prisma: PrismaService, private scoring: ScoringService, private alpha: AlphaService) {}

  async getTopOpportunities(limit = 10) {
    // Get all stocks with latest scores + signals
    const stocks = await this.prisma.stock.findMany({
      include: {
        scores: { orderBy: { computedAt: 'desc' }, take: 1 },
        signals: { where: { earlyFlag: true, expiresAt: { gt: new Date() } }, orderBy: { strength: 'desc' }, take: 1 },
      },
    });

    const ranked = stocks
      .filter(s => s.scores.length > 0)
      .map(s => {
        const score = s.scores[0];
        const signal = s.signals[0];
        return {
          stock: { id: s.id, symbol: s.symbol, name: s.name, sector: s.sector, lastPrice: s.lastPrice, priceChangePct: s.priceChangePct },
          finalScore: score.finalScore,
          rankingScore: score.rankingScore,
          anomalyScore: score.anomalyScore,
          confidenceFactor: score.confidenceFactor,
          signalType: signal?.signalType || 'NEUTRAL',
          earlyOpportunity: !!signal?.earlyFlag,
          keyDrivers: signal?.drivers || [],
          scores: {
            fundamental: score.fundamentalScore,
            technical: score.technicalScore,
            sentiment: score.sentimentScore,
            institutional: score.institutionalScore,
            analyst: score.analystScore,
            political: score.politicalScore,
            macro: score.macroScore,
          },
        };
      })
      .sort((a, b) => b.rankingScore - a.rankingScore)
      .slice(0, limit);

    return { opportunities: ranked, generatedAt: new Date().toISOString(), count: ranked.length };
  }

  async getEarlySignals() {
    return this.alpha.getEarlyOpportunities();
  }
}
