import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class OpportunitiesService {
  constructor(private prisma: PrismaService) {}

  // Top 10 opportunities ranked by ranking_score
  async getTop10() {
    const scores = await this.prisma.stockScore.findMany({
      distinct: ["stockId"],
      orderBy: { computedAt: "desc" },
      include: {
        stock: {
          include: {
            signals: { where: { expiresAt: { gt: new Date() } }, orderBy: { strength: "desc" }, take: 1 },
          },
        },
      },
      take: 200,
    });

    return scores
      .sort((a, b) => b.rankingScore - a.rankingScore)
      .slice(0, 10)
      .map(s => ({
        stock: s.stock,
        finalScore: +s.finalScore.toFixed(2),
        rankingScore: +s.rankingScore.toFixed(2),
        anomalyScore: +s.anomalyScore.toFixed(2),
        confidence: +s.confidenceFactor.toFixed(2),
        signalType: s.stock.signals?.[0]?.signalType || "NEUTRAL",
        earlyFlag: s.stock.signals?.[0]?.earlyFlag || false,
        drivers: s.stock.signals?.[0]?.drivers || [],
        scores: {
          fundamental: +s.fundamentalScore.toFixed(1),
          technical: +s.technicalScore.toFixed(1),
          sentiment: +s.sentimentScore.toFixed(1),
          institutional: +s.institutionalScore.toFixed(1),
          analyst: +s.analystScore.toFixed(1),
          political: +s.politicalScore.toFixed(1),
          macro: +s.macroScore.toFixed(1),
        },
        computedAt: s.computedAt,
      }));
  }

  async getEarlySignals() {
    return this.prisma.stockSignal.findMany({
      where: { earlyFlag: true, expiresAt: { gt: new Date() } },
      include: { stock: true },
      orderBy: { strength: "desc" },
      take: 10,
    });
  }
}
