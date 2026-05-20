import { Injectable } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminService {
  constructor(private users: UsersService, private prisma: PrismaService) {}

  getAllUsers() { return this.users.findAll(); }
  getPendingUsers() { return this.prisma.user.findMany({ where: { status: 'PENDING' }, select: { id: true, email: true, name: true, createdAt: true } }); }
  approveUser(id: string) { return this.users.updateStatus(id, 'APPROVED'); }
  rejectUser(id: string) { return this.users.updateStatus(id, 'REJECTED'); }
  suspendUser(id: string) { return this.users.updateStatus(id, 'SUSPENDED'); }

  async getStats() {
    const [users, stocks, signals, cacheSize] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.stock.count(),
      this.prisma.stockSignal.count({ where: { expiresAt: { gt: new Date() } } }),
      this.prisma.apiCache.count(),
    ]);
    return { users, stocks, activeSignals: signals, cachedEntries: cacheSize };
  }
}
