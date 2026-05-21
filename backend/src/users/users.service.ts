import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { UserStatus, UserRole } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(email: string, password: string, name: string) {
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new ConflictException('Email already registered');
    const hash = await bcrypt.hash(password, 12);
    return this.prisma.user.create({
      data: { email, password: hash, name, status: UserStatus.PENDING, role: UserRole.USER },
    });
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async findById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async addToWatchlist(userId: string, stockId: string) {
    const stock = await this.prisma.stock.upsert({
      where: { symbol: stockId },
      create: { symbol: stockId, name: stockId },
      update: {},
    });
    return this.prisma.watchlistEntry.create({
      data: { userId, stockId: stock.id },
    });
  }

  async getWatchlist(userId: string) {
    return this.prisma.watchlistEntry.findMany({
      where: { userId },
      include: { stock: true },
    });
  }

  async removeFromWatchlist(userId: string, stockId: string) {
    const stock = await this.prisma.stock.findUnique({ where: { symbol: stockId } });
    if (!stock) throw new NotFoundException('Stock not found');
    return this.prisma.watchlistEntry.delete({
      where: { userId_stockId: { userId, stockId: stock.id } },
    });
  }

  async updateStatus(userId: string, status: UserStatus) {
    return this.prisma.user.update({ where: { id: userId }, data: { status } });
  }

  async findAll() {
    return this.prisma.user.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async findPending() {
    return this.prisma.user.findMany({ where: { status: UserStatus.PENDING }, orderBy: { createdAt: 'desc' } });
  }
}
