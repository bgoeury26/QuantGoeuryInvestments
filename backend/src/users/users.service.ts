import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserStatus } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.user.findMany({
      select: { id: true, email: true, name: true, role: true, status: true, createdAt: true },
    });
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, name: true, role: true, status: true, createdAt: true },
    });
    if (!user) throw new NotFoundException(`User ${id} not found`);
    return user;
  }

  // Alias used by JwtStrategy
  async findById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, name: true, role: true, status: true },
    });
  }

  async updateStatus(id: string, status: UserStatus) {
    return this.prisma.user.update({
      where: { id },
      data: { status },
      select: { id: true, email: true, name: true, role: true, status: true },
    });
  }

  // Watchlist — uses WatchlistEntry (userId + stockId)
  // To add by symbol: first resolve stock, then create entry
  async addToWatchlist(userId: string, stockId: string) {
    return this.prisma.watchlistEntry.create({
      data: { userId, stockId },
    });
  }

  async getWatchlist(userId: string) {
    return this.prisma.watchlistEntry.findMany({
      where: { userId },
      include: { stock: true },
      orderBy: { addedAt: 'desc' },
    });
  }

  async removeFromWatchlist(userId: string, entryId: string) {
    return this.prisma.watchlistEntry.delete({
      where: { id: entryId, userId },
    });
  }
}
