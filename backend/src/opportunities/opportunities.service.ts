import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class OpportunitiesService {
  constructor(private prisma: PrismaService) {}

  async getTopOpportunities(limit = 10) {
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
      .slice(0, limit)
      .map(s => ({
        stock: s.stock,
        rankingScore: s.rankingScore,
        finalScore: s.finalScore,
        anomalyScore: s.anomalyScore,
        confidence: s.confidenceFactor,
        signalType: s.stock.signals?.[0]?.signalType || "NEUTRAL",
        earlyFlag: s.stock.signals?.[0]?.earlyFlag || false,
        drivers: s.stock.signals?.[0]?.drivers || [],
        breakdown: {
          fundamental: s.fundamentalScore,
          technical: s.technicalScore,
          sentiment: s.sentimentScore,
          institutional: s.institutionalScore,
          analyst: s.analystScore,
          political: s.politicalScore,
          macro: s.macroScore,
        },
        computedAt: s.computedAt,
      }));
  }

  async getEarlyOpportunities() {
    return this.prisma.stockSignal.findMany({
      where: { earlyFlag: true, expiresAt: { gt: new Date() } },
      include: { stock: { include: { scores: { orderBy: { computedAt: "desc" }, take: 1 } } } },
      orderBy: { strength: "desc" },
      take: 20,
    });
  }
}
