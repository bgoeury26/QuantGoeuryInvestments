import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService, private config: ConfigService) {}

  getUsers() {
    return this.prisma.user.findMany({
      select: { id: true, email: true, name: true, role: true, status: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async approveUser(userId: string, adminEmail: string) {
    if (adminEmail !== this.config.get('ADMIN_EMAIL')) throw new ForbiddenException('Not authorised');
    return this.prisma.user.update({
      where: { id: userId },
      data: { status: 'APPROVED' },
      select: { id: true, email: true, name: true, status: true },
    });
  }

  async rejectUser(userId: string, adminEmail: string) {
    if (adminEmail !== this.config.get('ADMIN_EMAIL')) throw new ForbiddenException('Not authorised');
    return this.prisma.user.update({
      where: { id: userId },
      data: { status: 'REJECTED' },
      select: { id: true, email: true, name: true, status: true },
    });
  }

  async suspendUser(userId: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { status: 'SUSPENDED' },
      select: { id: true, email: true, name: true, status: true },
    });
  }

  async getMetrics() {
    const [totalUsers, pendingUsers, approvedUsers, totalScores, totalSignals] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { status: 'PENDING' } }),
      this.prisma.user.count({ where: { status: 'APPROVED' } }),
      this.prisma.stockScore.count(),
      this.prisma.stockSignal.count(),
    ]);
    const [cacheCount] = await Promise.all([
      this.prisma.apiCache.count({
        where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
      }),
    ]);
    return { totalUsers, pendingUsers, approvedUsers, totalScoresComputed: totalScores, totalSignalsDetected: totalSignals, apiCallsToday: cacheCount };
  }
}
