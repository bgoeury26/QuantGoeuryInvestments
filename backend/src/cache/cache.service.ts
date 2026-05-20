import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CacheService {
  constructor(private prisma: PrismaService) {}

  private key(endpoint: string, params: Record<string,any> = {}): string {
    return `${endpoint}:${Object.keys(params).sort().map(k=>`${k}=${params[k]}`).join('&')}`;
  }

  async get<T>(endpoint: string, params: Record<string,any> = {}): Promise<T | null> {
    const c = await this.prisma.apiCache.findUnique({ where: { cacheKey: this.key(endpoint, params) } });
    if (!c || c.expiresAt < new Date()) return null;
    return c.data as T;
  }

  async set(endpoint: string, params: Record<string,any> = {}, data: any, ttl = 3600) {
    const cacheKey = this.key(endpoint, params);
    const expiresAt = new Date(Date.now() + ttl * 1000);
    await this.prisma.apiCache.upsert({
      where: { cacheKey },
      update: { data, expiresAt },
      create: { cacheKey, data, endpoint, symbol: params.symbol, expiresAt },
    });
  }

  async cleanup() {
    await this.prisma.apiCache.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  }
}
