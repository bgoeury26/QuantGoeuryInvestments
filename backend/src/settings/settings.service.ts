import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import * as CryptoJS from 'crypto-js';

@Injectable()
export class SettingsService {
  private readonly encKey:string;
  constructor(private prisma:PrismaService, private config:ConfigService) {
    this.encKey=this.config.get('ENCRYPTION_KEY')||'default-32-char-key-change-this!';
  }

  private encrypt(val:string):string { return CryptoJS.AES.encrypt(val,this.encKey).toString(); }
  private decrypt(val:string):string { try{return CryptoJS.AES.decrypt(val,this.encKey).toString(CryptoJS.enc.Utf8);}catch{return '';} }
  private mask(val:string):string { if(!val||val.length<8) return '****'; return val.slice(0,4)+'****'+val.slice(-4); }

  async getSettings(userId:string) {
    const s=await this.prisma.userSettings.findUnique({where:{userId}});
    if(!s) return null;
    return {
      fmpApiKey: s.fmpApiKey?this.mask(this.decrypt(s.fmpApiKey)):null,
      finnhubApiKey: s.finnhubApiKey?this.mask(this.decrypt(s.finnhubApiKey)):null,
      polygonApiKey: s.polygonApiKey?this.mask(this.decrypt(s.polygonApiKey)):null,
      alphaVantageKey: s.alphaVantageKey?this.mask(this.decrypt(s.alphaVantageKey)):null,
      newsApiKey: s.newsApiKey?this.mask(this.decrypt(s.newsApiKey)):null,
      fredApiKey: s.fredApiKey?this.mask(this.decrypt(s.fredApiKey)):null,
      gdeltEnabled: s.gdeltEnabled,
      blueskyIdentifier: s.blueskyIdentifier,
    };
  }

  async saveSettings(userId:string, dto:any) {
    const data:any={};
    if(dto.fmpApiKey) data.fmpApiKey=this.encrypt(dto.fmpApiKey);
    if(dto.finnhubApiKey) data.finnhubApiKey=this.encrypt(dto.finnhubApiKey);
    if(dto.polygonApiKey) data.polygonApiKey=this.encrypt(dto.polygonApiKey);
    if(dto.alphaVantageKey) data.alphaVantageKey=this.encrypt(dto.alphaVantageKey);
    if(dto.newsApiKey) data.newsApiKey=this.encrypt(dto.newsApiKey);
    if(dto.fredApiKey) data.fredApiKey=this.encrypt(dto.fredApiKey);
    if(dto.gdeltEnabled!==undefined) data.gdeltEnabled=dto.gdeltEnabled;
    if(dto.blueskyIdentifier) data.blueskyIdentifier=dto.blueskyIdentifier;
    if(dto.blueskyPassword) data.blueskyPassword=this.encrypt(dto.blueskyPassword);
    return this.prisma.userSettings.upsert({ where:{userId}, update:data, create:{userId,...data} });
  }
}
