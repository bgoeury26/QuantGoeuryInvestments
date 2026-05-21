import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class OpportunitiesService {
  constructor(private prisma: PrismaService) {}

  async getTopOpportunities(limit = 10) {
    return this.prisma.opportunity.findMany({
      include: { stock: true },
      orderBy: { rankingScore: 'desc' },
      take: limit,
    });
  }

  async getEarlySignals() {
    return this.prisma.opportunity.findMany({
      where: { earlyFlag: true },
      include: { stock: true },
      orderBy: { anomalyScore: 'desc' },
      take: 20,
    });
  }

  async getRecentSignals(limit = 20) {
    return this.prisma.stockSignal.findMany({
      where: { expiresAt: { gt: new Date() } },
      include: { stock: { select: { symbol: true, name: true } } },
      orderBy: { detectedAt: 'desc' },
      take: limit,
    });
  }
}
