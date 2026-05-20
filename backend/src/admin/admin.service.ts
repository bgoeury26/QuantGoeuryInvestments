import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  getPendingUsers() {
    return this.prisma.user.findMany({
      where: { status: 'PENDING' },
      select: { id: true, email: true, name: true, createdAt: true, status: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  getAllUsers() {
    return this.prisma.user.findMany({
      select: { id: true, email: true, name: true, role: true, status: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  approveUser(id: string) { return this.prisma.user.update({ where: { id }, data: { status: 'APPROVED' } }); }
  rejectUser(id: string) { return this.prisma.user.update({ where: { id }, data: { status: 'REJECTED' } }); }
  suspendUser(id: string) { return this.prisma.user.update({ where: { id }, data: { status: 'SUSPENDED' } }); }

  getStats() {
    return Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { status: 'PENDING' } }),
      this.prisma.user.count({ where: { status: 'APPROVED' } }),
      this.prisma.stock.count(),
      this.prisma.stockScore.count(),
      this.prisma.apiCache.count(),
    ]).then(([total, pending, approved, stocks, scores, cacheEntries]) => ({
      users: { total, pending, approved },
      stocks,
      scores,
      cacheEntries,
    }));
  }
}
