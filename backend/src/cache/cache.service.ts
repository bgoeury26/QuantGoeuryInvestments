import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CacheService {
  constructor(private readonly prisma: PrismaService) {}

  private buildKey(endpoint: string, params: Record<string, any>): string {
    return `${endpoint}:${JSON.stringify(params)}`;
  }

  // Overload: get<T>(cacheKey: string) — used by alpha/scoring services
  async get<T = any>(cacheKey: string): Promise<T | null>;
  // Overload: get(endpoint, params) — original signature
  async get<T = any>(endpoint: string, params: Record<string, any>): Promise<T | null>;
  async get<T = any>(endpointOrKey: string, params?: Record<string, any>): Promise<T | null> {
    const key = params ? this.buildKey(endpointOrKey, params) : endpointOrKey;
    const entry = await this.prisma.apiCache.findUnique({ where: { cacheKey: key } });
    if (!entry) return null;
    if (entry.expiresAt < new Date()) {
      await this.prisma.apiCache.delete({ where: { cacheKey: key } }).catch(() => null);
      return null;
    }
    return entry.data as T;
  }

  // Overload: set(cacheKey, data, ttlSeconds) — used by alpha/scoring services
  async set(cacheKey: string, data: any, ttlSeconds: number): Promise<void>;
  // Overload: set(endpoint, params, data, ttlSeconds) — original signature
  async set(endpoint: string, params: Record<string, any>, data: any, ttlSeconds: number): Promise<void>;
  async set(
    endpointOrKey: string,
    paramsOrData: Record<string, any> | any,
    dataOrTtl: any,
    ttlSeconds?: number,
  ): Promise<void> {
    let key: string;
    let data: any;
    let ttl: number;

    if (ttlSeconds !== undefined) {
      // 4-arg form: (endpoint, params, data, ttl)
      key = this.buildKey(endpointOrKey, paramsOrData as Record<string, any>);
      data = dataOrTtl;
      ttl = ttlSeconds;
    } else {
      // 3-arg form: (cacheKey, data, ttl)
      key = endpointOrKey;
      data = paramsOrData;
      ttl = dataOrTtl as number;
    }

    const expiresAt = new Date(Date.now() + ttl * 1000);
    await this.prisma.apiCache.upsert({
      where: { cacheKey: key },
      create: { cacheKey: key, data, endpoint: endpointOrKey, expiresAt },
      update: { data, expiresAt },
    });
  }

  async invalidate(endpoint: string, params: Record<string, any>): Promise<void> {
    const key = this.buildKey(endpoint, params);
    await this.prisma.apiCache.delete({ where: { cacheKey: key } }).catch(() => null);
  }

  async cleanup(): Promise<void> {
    await this.prisma.apiCache.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  }
}
