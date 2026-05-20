import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class SettingsService {
  private readonly ENC_KEY: string;

  constructor(private prisma: PrismaService, private config: ConfigService) {
    this.ENC_KEY = (config.get('ENCRYPTION_KEY') || 'fallback_key_32_chars_padded____').slice(0, 32);
  }

  private encrypt(text: string): string {
    if (!text) return '';
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(this.ENC_KEY), iv);
    return iv.toString('hex') + ':' + Buffer.concat([cipher.update(text), cipher.final()]).toString('hex');
  }

  private decrypt(encrypted: string): string {
    if (!encrypted) return '';
    try {
      const [ivHex, dataHex] = encrypted.split(':');
      const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(this.ENC_KEY), Buffer.from(ivHex, 'hex'));
      return Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]).toString();
    } catch { return ''; }
  }

  private mask(key: string): string {
    if (!key || key.length < 8) return '***';
    return key.slice(0, 4) + '****' + key.slice(-4);
  }

  async getSettings(userId: string) {
    const s = await this.prisma.userSettings.findUnique({ where: { userId } });
    if (!s) return { userId, configured: false };
    return {
      userId,
      configured: true,
      fmpApiKey: this.mask(this.decrypt(s.fmpApiKey || '')),
      finnhubApiKey: this.mask(this.decrypt(s.finnhubApiKey || '')),
      polygonApiKey: this.mask(this.decrypt(s.polygonApiKey || '')),
      alphaVantageKey: this.mask(this.decrypt(s.alphaVantageKey || '')),
      newsApiKey: this.mask(this.decrypt(s.newsApiKey || '')),
      fredApiKey: this.mask(this.decrypt(s.fredApiKey || '')),
      redditClientId: this.mask(this.decrypt(s.redditClientId || '')),
      blueskyIdentifier: s.blueskyIdentifier || '',
      congressApiKey: this.mask(this.decrypt(s.congressApiKey || '')),
      gdeltEnabled: s.gdeltEnabled,
    };
  }

  async saveSettings(userId: string, dto: any) {
    const data: any = { gdeltEnabled: dto.gdeltEnabled ?? true };
    if (dto.fmpApiKey && !dto.fmpApiKey.includes('****')) data.fmpApiKey = this.encrypt(dto.fmpApiKey);
    if (dto.finnhubApiKey && !dto.finnhubApiKey.includes('****')) data.finnhubApiKey = this.encrypt(dto.finnhubApiKey);
    if (dto.polygonApiKey && !dto.polygonApiKey.includes('****')) data.polygonApiKey = this.encrypt(dto.polygonApiKey);
    if (dto.alphaVantageKey && !dto.alphaVantageKey.includes('****')) data.alphaVantageKey = this.encrypt(dto.alphaVantageKey);
    if (dto.newsApiKey && !dto.newsApiKey.includes('****')) data.newsApiKey = this.encrypt(dto.newsApiKey);
    if (dto.fredApiKey && !dto.fredApiKey.includes('****')) data.fredApiKey = this.encrypt(dto.fredApiKey);
    if (dto.redditClientId && !dto.redditClientId.includes('****')) data.redditClientId = this.encrypt(dto.redditClientId);
    if (dto.congressApiKey && !dto.congressApiKey.includes('****')) data.congressApiKey = this.encrypt(dto.congressApiKey);
    if (dto.blueskyIdentifier) data.blueskyIdentifier = dto.blueskyIdentifier;
    return this.prisma.userSettings.upsert({ where: { userId }, update: data, create: { userId, ...data } });
  }

  async getDecryptedForApi(userId: string) {
    const s = await this.prisma.userSettings.findUnique({ where: { userId } });
    if (!s) return {};
    return {
      fmpApiKey: this.decrypt(s.fmpApiKey || ''),
      finnhubApiKey: this.decrypt(s.finnhubApiKey || ''),
      alphaVantageKey: this.decrypt(s.alphaVantageKey || ''),
      newsApiKey: this.decrypt(s.newsApiKey || ''),
      fredApiKey: this.decrypt(s.fredApiKey || ''),
      gdeltEnabled: s.gdeltEnabled,
    };
  }
}
