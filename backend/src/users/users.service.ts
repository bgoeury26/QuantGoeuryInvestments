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

  async updateStatus(id: string, status: UserStatus) {
    return this.prisma.user.update({
      where: { id },
      data: { status },
      select: { id: true, email: true, name: true, role: true, status: true },
    });
  }

  async addToWatchlist(userId: string, symbol: string) {
    return this.prisma.watchlistItem.create({
      data: { userId, symbol },
    });
  }

  async getWatchlist(userId: string) {
    return this.prisma.watchlistItem.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async removeFromWatchlist(userId: string, id: string) {
    return this.prisma.watchlistItem.delete({
      where: { id, userId },
    });
  }
}
