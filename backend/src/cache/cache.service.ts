import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CacheService {
  constructor(private prisma: PrismaService) {}

  private buildKey(endpoint: string, params: Record<string, any> = {}): string {
    const sorted = Object.keys(params).sort().map(k => `${k}=${params[k]}`).join('&');
    return `${endpoint}:${sorted}`;
  }

  async get<T>(endpoint: string, params: Record<string, any> = {}): Promise<T | null> {
    const key = this.buildKey(endpoint, params);
    const cached = await this.prisma.apiCache.findUnique({ where: { cacheKey: key } });
    if (!cached) return null;
    if (cached.expiresAt < new Date()) {
      await this.prisma.apiCache.delete({ where: { cacheKey: key } }).catch(() => {});
      return null;
    }
    return cached.data as T;
  }

  async set(endpoint: string, params: Record<string, any> = {}, data: any, ttlSeconds = 3600): Promise<void> {
    const key = this.buildKey(endpoint, params);
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
    await this.prisma.apiCache.upsert({
      where: { cacheKey: key },
      update: { data, expiresAt },
      create: { cacheKey: key, data, endpoint, symbol: params.symbol || null, expiresAt },
    });
  }

  async cleanup(): Promise<number> {
    const result = await this.prisma.apiCache.deleteMany({ where: { expiresAt: { lt: new Date() } } });
    return result.count;
  }
}
