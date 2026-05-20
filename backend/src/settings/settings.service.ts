import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { ConfigService } from "@nestjs/config";
import * as CryptoJS from "crypto-js";

@Injectable()
export class SettingsService {
  private readonly key: string;
  constructor(private prisma: PrismaService, private config: ConfigService) {
    this.key = config.get("ENCRYPTION_KEY") || "default-32-char-key-change-me!!";
  }

  private encrypt(val: string): string { return CryptoJS.AES.encrypt(val, this.key).toString(); }
  private decrypt(val: string): string {
    try { return CryptoJS.AES.decrypt(val, this.key).toString(CryptoJS.enc.Utf8); }
    catch { return ""; }
  }
  private mask(val: string): string { if (!val || val.length < 8) return "***"; return val.slice(0, 4) + "*".repeat(val.length - 8) + val.slice(-4); }

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
      gdeltEnabled: s.gdeltEnabled,
      hasReddit: !!s.redditClientId,
      hasBluesky: !!s.blueskyIdentifier,
    };
  }

  async saveSettings(userId: string, dto: Record<string, any>) {
    const data: Record<string, any> = { gdeltEnabled: dto.gdeltEnabled ?? true };
    const fields = ["fmpApiKey","finnhubApiKey","polygonApiKey","alphaVantageKey","newsApiKey","fredApiKey","redditClientId","redditClientSecret","blueskyIdentifier","blueskyPassword","congressApiKey"];
    for (const f of fields) {
      if (dto[f]) data[f] = this.encrypt(dto[f]);
    }
    return this.prisma.userSettings.upsert({
      where: { userId },
      update: data,
      create: { userId, ...data },
    });
  }
}
