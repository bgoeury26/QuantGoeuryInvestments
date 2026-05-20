import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as crypto from 'crypto';

@Injectable()
export class CacheService {
  constructor(private prisma: PrismaService) {}

  private makeKey(endpoint: string, params: Record<string, any>): string {
    const sorted = JSON.stringify(params, Object.keys(params).sort());
    return crypto.createHash('md5').update(endpoint + sorted).digest('hex');
  }

  async get(endpoint: string, params: Record<string, any>): Promise<any | null> {
    try {
      const key = this.makeKey(endpoint, params);
      const entry = await this.prisma.apiCache.findUnique({ where: { cacheKey: key } });
      if (!entry) return null;
      if (entry.expiresAt < new Date()) {
        await this.prisma.apiCache.delete({ where: { cacheKey: key } }).catch(() => {});
        return null;
      }
      return entry.data;
    } catch { return null; }
  }

  async set(endpoint: string, params: Record<string, any>, data: any, ttlSeconds: number): Promise<void> {
    try {
      const key = this.makeKey(endpoint, params);
      const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
      await this.prisma.apiCache.upsert({
        where: { cacheKey: key },
        update: { data, expiresAt, createdAt: new Date() },
        create: { cacheKey: key, data, endpoint, symbol: params.symbol ?? null, expiresAt },
      });
    } catch { /* non-fatal */ }
  }

  async invalidate(endpoint: string, params: Record<string, any>): Promise<void> {
    try {
      const key = this.makeKey(endpoint, params);
      await this.prisma.apiCache.delete({ where: { cacheKey: key } }).catch(() => {});
    } catch { /* non-fatal */ }
  }

  async cleanup(): Promise<void> {
    try {
      await this.prisma.apiCache.deleteMany({ where: { expiresAt: { lt: new Date() } } });
    } catch { /* non-fatal */ }
  }
}
