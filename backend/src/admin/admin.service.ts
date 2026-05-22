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
    const cacheCount = await this.prisma.apiCache.count({
      where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
    });
    return { totalUsers, pendingUsers, approvedUsers, totalScoresComputed: totalScores, totalSignalsDetected: totalSignals, apiCallsToday: cacheCount };
  }

  // ─── Cache Management ────────────────────────────────────────────────────────

  async getCacheStats() {
    const now = new Date();
    const [total, alive, expired, byEndpoint] = await Promise.all([
      this.prisma.apiCache.count(),
      this.prisma.apiCache.count({ where: { expiresAt: { gte: now } } }),
      this.prisma.apiCache.count({ where: { expiresAt: { lt: now } } }),
      this.prisma.apiCache.groupBy({
        by: ['endpoint'],
        _count: { cacheKey: true },
        orderBy: { _count: { cacheKey: 'desc' } },
      }),
    ]);
    const recentEntries = await this.prisma.apiCache.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: { cacheKey: true, endpoint: true, createdAt: true, expiresAt: true },
    });
    return {
      total,
      alive,
      expired,
      byEndpoint: byEndpoint.map(e => ({ endpoint: e.endpoint, count: e._count.cacheKey })),
      recentEntries,
    };
  }

  async bustSymbol(symbol: string) {
    const upper = symbol.toUpperCase();
    const result = await this.prisma.apiCache.deleteMany({
      where: { cacheKey: { contains: upper } },
    });
    return {
      symbol: upper,
      deleted: result.count,
      message: result.count > 0
        ? `✅ Cleared ${result.count} cache entr${result.count === 1 ? 'y' : 'ies'} for ${upper}. Next request will fetch live data.`
        : `ℹ️ No cached entries found for ${upper} — already fresh.`,
    };
  }

  async bustAll() {
    const result = await this.prisma.apiCache.deleteMany({});
    return {
      deleted: result.count,
      message: `✅ Wiped entire cache — ${result.count} entries removed. All next requests will fetch live data.`,
    };
  }

  async bustExpired() {
    const result = await this.prisma.apiCache.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    return {
      deleted: result.count,
      message: `✅ Removed ${result.count} expired entr${result.count === 1 ? 'y' : 'ies'}.`,
    };
  }
}
