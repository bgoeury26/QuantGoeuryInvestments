import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  findById(id: string) {
    return this.prisma.user.findUnique({
      where:  { id },
      select: { id: true, email: true, name: true, role: true, status: true, createdAt: true },
    });
  }

  create(data: { email: string; password: string; name: string }) {
    return this.prisma.user.create({ data });
  }

  updateStatus(id: string, status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED') {
    return this.prisma.user.update({ where: { id }, data: { status } });
  }

  // ── Watchlist ────────────────────────────────────────────────────────────

  async getWatchlist(userId: string) {
    const rows = await this.prisma.watchlistItem.findMany({
      where:   { userId },
      include: { stock: true },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(r => r.stock);
  }

  async addToWatchlist(userId: string, stockId: string) {
    // upsert — silently ignore duplicates
    return this.prisma.watchlistItem.upsert({
      where:  { userId_stockId: { userId, stockId } },
      update: {},
      create: { userId, stockId },
    });
  }

  async removeFromWatchlist(userId: string, stockId: string) {
    return this.prisma.watchlistItem.delete({
      where: { userId_stockId: { userId, stockId } },
    }).catch(() => ({ removed: true })); // ignore not-found
  }
}
