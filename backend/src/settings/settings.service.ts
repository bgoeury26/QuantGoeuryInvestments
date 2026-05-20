import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import axios from 'axios';

@Injectable()
export class SettingsService {
  private algo = 'aes-256-cbc';
  private key: Buffer;

  constructor(private prisma: PrismaService, private config: ConfigService) {
    const hexKey = this.config.get<string>('ENCRYPTION_KEY') || '0'.repeat(64);
    this.key = Buffer.from(hexKey.padEnd(64, '0').slice(0, 64), 'hex');
  }

  private encrypt(text: string): string {
    if (!text) return '';
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(this.algo, this.key, iv);
    const enc = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
    return iv.toString('hex') + ':' + enc.toString('hex');
  }

  private decrypt(enc: string): string {
    if (!enc || !enc.includes(':')) return enc;
    try {
      const [ivHex, dataHex] = enc.split(':');
      const iv = Buffer.from(ivHex, 'hex');
      const data = Buffer.from(dataHex, 'hex');
      const decipher = crypto.createDecipheriv(this.algo, this.key, iv);
      return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
    } catch { return ''; }
  }

  private maskKey(key: string): string {
    if (!key || key.length < 8) return key ? '****' : '';
    return key.slice(0, 4) + '•'.repeat(key.length - 8) + key.slice(-4);
  }

  async getSettings(userId: string) {
    let s = await this.prisma.userSettings.findUnique({ where: { userId } });
    if (!s) s = await this.prisma.userSettings.create({ data: { userId, gdeltEnabled: true } });

    return {
      fmp:          this.maskKey(this.decrypt(s.fmpApiKey ?? '')),
      finnhub:      this.maskKey(this.decrypt(s.finnhubApiKey ?? '')),
      polygon:      this.maskKey(this.decrypt(s.polygonApiKey ?? '')),
      alphaVantage: this.maskKey(this.decrypt(s.alphaVantageKey ?? '')),
      newsApi:      this.maskKey(this.decrypt(s.newsApiKey ?? '')),
      fred:         this.maskKey(this.decrypt(s.fredApiKey ?? '')),
      reddit:       this.maskKey(this.decrypt(s.redditClientId ?? '')),
      bluesky:      this.maskKey(this.decrypt(s.blueskyIdentifier ?? '')),
      gdeltEnabled: s.gdeltEnabled,
    };
  }

  async saveSettings(userId: string, dto: any) {
    const data: any = { gdeltEnabled: dto.gdeltEnabled ?? true };
    if (dto.fmp          !== undefined && !dto.fmp.includes('•'))          data.fmpApiKey          = this.encrypt(dto.fmp);
    if (dto.finnhub      !== undefined && !dto.finnhub.includes('•'))      data.finnhubApiKey      = this.encrypt(dto.finnhub);
    if (dto.polygon      !== undefined && !dto.polygon.includes('•'))      data.polygonApiKey      = this.encrypt(dto.polygon);
    if (dto.alphaVantage !== undefined && !dto.alphaVantage.includes('•')) data.alphaVantageKey    = this.encrypt(dto.alphaVantage);
    if (dto.newsApi      !== undefined && !dto.newsApi.includes('•'))      data.newsApiKey         = this.encrypt(dto.newsApi);
    if (dto.fred         !== undefined && !dto.fred.includes('•'))         data.fredApiKey         = this.encrypt(dto.fred);
    if (dto.reddit       !== undefined && !dto.reddit.includes('•'))       data.redditClientId     = this.encrypt(dto.reddit);
    if (dto.bluesky      !== undefined && !dto.bluesky.includes('•'))      data.blueskyIdentifier  = this.encrypt(dto.bluesky);

    await this.prisma.userSettings.upsert({
      where: { userId },
      update: data,
      create: { userId, ...data },
    });
    return this.getSettings(userId);
  }

  async testProvider(provider: string, userId: string) {
    const s = await this.prisma.userSettings.findUnique({ where: { userId } });
    const t0 = Date.now();
    try {
      switch (provider) {
        case 'fmp': {
          const k = this.decrypt(s?.fmpApiKey ?? '');
          if (!k) return { ok: false, latencyMs: 0, error: 'No key configured' };
          await axios.get(`https://financialmodelingprep.com/api/v3/profile/AAPL?apikey=${k}`, { timeout: 5000 });
          break;
        }
        case 'finnhub': {
          const k = this.decrypt(s?.finnhubApiKey ?? '');
          if (!k) return { ok: false, latencyMs: 0, error: 'No key configured' };
          await axios.get(`https://finnhub.io/api/v1/quote?symbol=AAPL&token=${k}`, { timeout: 5000 });
          break;
        }
        case 'fred': {
          const k = this.decrypt(s?.fredApiKey ?? '');
          if (!k) return { ok: false, latencyMs: 0, error: 'No key configured' };
          await axios.get(`https://api.stlouisfed.org/fred/series?series_id=FEDFUNDS&api_key=${k}&file_type=json`, { timeout: 5000 });
          break;
        }
        case 'newsapi': {
          const k = this.decrypt(s?.newsApiKey ?? '');
          if (!k) return { ok: false, latencyMs: 0, error: 'No key configured' };
          await axios.get(`https://newsapi.org/v2/everything?q=AAPL&pageSize=1&apiKey=${k}`, { timeout: 5000 });
          break;
        }
        case 'gdelt':
          await axios.get('https://api.gdeltproject.org/api/v2/doc/doc?query=AAPL&mode=artlist&maxrecords=1&format=json', { timeout: 5000 });
          break;
        default:
          return { ok: false, latencyMs: 0, error: `Unknown provider: ${provider}` };
      }
      return { ok: true, latencyMs: Date.now() - t0 };
    } catch (e: any) {
      return { ok: false, latencyMs: Date.now() - t0, error: e.message };
    }
  }
}
