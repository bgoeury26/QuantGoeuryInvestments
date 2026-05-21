import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { User } from '@prisma/client';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async create(data: {
    email: string;
    password: string;
    name: string;
  }): Promise<User> {
    const passwordHash = await bcrypt.hash(data.password, 10);
    return this.prisma.user.create({
      data: {
        email: data.email,
        passwordHash,
        name: data.name,
        status: 'PENDING',
      },
    });
  }

  async updateStatus(
    id: string,
    status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED',
  ): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data: { status },
    });
  }

  async listAll(): Promise<User[]> {
    return this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }
}
