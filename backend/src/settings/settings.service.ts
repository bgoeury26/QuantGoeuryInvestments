import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { ConfigService } from "@nestjs/config";
import * as CryptoJS from "crypto-js";

@Injectable()
export class SettingsService {
  private encKey: string;
  constructor(private prisma: PrismaService, private config: ConfigService) {
    this.encKey = this.config.get("ENCRYPTION_KEY") || "default_dev_key_32chars_change!";
  }

  private encrypt(val: string): string { return CryptoJS.AES.encrypt(val, this.encKey).toString(); }
  private decrypt(val: string): string {
    try { return CryptoJS.AES.decrypt(val, this.encKey).toString(CryptoJS.enc.Utf8); } catch { return ""; }
  }
  private mask(val: string): string { if (!val || val.length < 8) return "****"; return val.slice(0, 4) + "****" + val.slice(-4); }

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
    const fields = ["fmpApiKey","finnhubApiKey","polygonApiKey","alphaVantageKey","newsApiKey","fredApiKey","redditClientId","redditClientSecret","blueskyPassword","congressApiKey"];
    for (const f of fields) {
      if (dto[f] && !dto[f].includes("****")) data[f] = this.encrypt(dto[f]);
    }
    if (dto.blueskyIdentifier) data.blueskyIdentifier = dto.blueskyIdentifier;
    return this.prisma.userSettings.upsert({ where: { userId }, update: data, create: { userId, ...data } });
  }

  async getDecryptedKey(userId: string, keyName: string): Promise<string | null> {
    const s = await this.prisma.userSettings.findUnique({ where: { userId } });
    if (!s || !s[keyName]) return null;
    return this.decrypt(s[keyName]);
  }
}
