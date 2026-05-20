import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class SettingsService {
  private readonly key: Buffer;

  constructor(private prisma: PrismaService, private config: ConfigService) {
    const rawKey = this.config.get('ENCRYPTION_KEY') || 'default_key_32chars_change_this!';
    this.key = Buffer.from(rawKey.padEnd(32).slice(0, 32));
  }

  private encrypt(text: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', this.key, iv);
    const encrypted = Buffer.concat([cipher.update(text), cipher.final()]);
    return `${iv.toString('hex')}:${encrypted.toString('hex')}`;
  }

  private decrypt(text: string): string {
    try {
      const [ivHex, encHex] = text.split(':');
      const iv = Buffer.from(ivHex, 'hex');
      const enc = Buffer.from(encHex, 'hex');
      const decipher = crypto.createDecipheriv('aes-256-cbc', this.key, iv);
      return Buffer.concat([decipher.update(enc), decipher.final()]).toString();
    } catch { return ''; }
  }

  private mask(val: string): string {
    if (!val || val.length < 8) return '***';
    return val.slice(0, 4) + '*'.repeat(val.length - 8) + val.slice(-4);
  }

  async getSettings(userId: string) {
    const s = await this.prisma.userSettings.findUnique({ where: { userId } });
    if (!s) return null;
    return {
      fmpApiKey: s.fmpApiKey ? this.mask(this.decrypt(s.fmpApiKey)) : null,
      finnhubApiKey: s.finnhubApiKey ? this.mask(this.decrypt(s.finnhubApiKey)) : null,
      polygonApiKey: s.polygonApiKey ? this.mask(this.decrypt(s.polygonApiKey)) : null,
      alphaVantageKey: s.alphaVantageKey ? this.mask(this.decrypt(s.alphaVantageKey)) : null,
      newsApiKey: s.newsApiKey ? this.mask(this.decrypt(s.newsApiKey)) : null,
      fredApiKey: s.fredApiKey ? this.mask(this.decrypt(s.fredApiKey)) : null,
      redditClientId: s.redditClientId ? this.mask(this.decrypt(s.redditClientId)) : null,
      blueskyIdentifier: s.blueskyIdentifier || null,
      congressApiKey: s.congressApiKey ? this.mask(this.decrypt(s.congressApiKey)) : null,
      gdeltEnabled: s.gdeltEnabled,
    };
  }

  async saveSettings(userId: string, dto: any) {
    const data: any = { gdeltEnabled: dto.gdeltEnabled ?? true };
    if (dto.fmpApiKey) data.fmpApiKey = this.encrypt(dto.fmpApiKey);
    if (dto.finnhubApiKey) data.finnhubApiKey = this.encrypt(dto.finnhubApiKey);
    if (dto.polygonApiKey) data.polygonApiKey = this.encrypt(dto.polygonApiKey);
    if (dto.alphaVantageKey) data.alphaVantageKey = this.encrypt(dto.alphaVantageKey);
    if (dto.newsApiKey) data.newsApiKey = this.encrypt(dto.newsApiKey);
    if (dto.fredApiKey) data.fredApiKey = this.encrypt(dto.fredApiKey);
    if (dto.redditClientId) data.redditClientId = this.encrypt(dto.redditClientId);
    if (dto.redditClientSecret) data.redditClientSecret = this.encrypt(dto.redditClientSecret);
    if (dto.blueskyIdentifier) data.blueskyIdentifier = dto.blueskyIdentifier;
    if (dto.blueskyPassword) data.blueskyPassword = this.encrypt(dto.blueskyPassword);
    if (dto.congressApiKey) data.congressApiKey = this.encrypt(dto.congressApiKey);
    return this.prisma.userSettings.upsert({
      where: { userId },
      update: data,
      create: { userId, ...data },
    });
  }
}
