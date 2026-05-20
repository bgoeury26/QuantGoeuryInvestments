import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../cache/cache.service';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class StocksService {
  constructor(private prisma:PrismaService, private cache:CacheService, private config:ConfigService) {}

  getAll() {
    return this.prisma.stock.findMany({ include:{ scores:{orderBy:{computedAt:'desc'},take:1}, signals:{where:{expiresAt:{gt:new Date()}},orderBy:{detectedAt:'desc'},take:1} }, orderBy:{symbol:'asc'} });
  }

  async getBySymbol(symbol:string) {
    const s=await this.prisma.stock.findUnique({ where:{symbol:symbol.toUpperCase()}, include:{scores:{orderBy:{computedAt:'desc'},take:1},signals:{where:{expiresAt:{gt:new Date()}},take:5}} });
    if(!s) throw new NotFoundException(`Stock ${symbol} not found`);
    return s;
  }

  async getQuote(symbol:string) {
    const c=await this.cache.get('quote',{symbol}); if(c) return c;
    const k=this.config.get('FINNHUB_API_KEY'); if(!k) return null;
    try { const {data}=await axios.get(`https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${k}`); await this.cache.set('quote',{symbol},data,300); return data; } catch{return null;}
  }

  async getFundamentals(symbol:string) {
    const c=await this.cache.get('fundamentals',{symbol}); if(c) return c;
    const k=this.config.get('FMP_API_KEY'); if(!k) return null;
    try {
      const [p,r,g]=await Promise.all([
        axios.get(`https://financialmodelingprep.com/api/v3/profile/${symbol}?apikey=${k}`),
        axios.get(`https://financialmodelingprep.com/api/v3/ratios-ttm/${symbol}?apikey=${k}`),
        axios.get(`https://financialmodelingprep.com/api/v3/financial-growth/${symbol}?limit=1&apikey=${k}`),
      ]);
      const d={profile:p.data?.[0],ratios:r.data?.[0],growth:g.data?.[0]};
      await this.cache.set('fundamentals',{symbol},d,86400); return d;
    } catch{return null;}
  }

  async getTechnicals(symbol:string) {
    const c=await this.cache.get('technicals',{symbol}); if(c) return c;
    const k=this.config.get('ALPHA_VANTAGE_API_KEY'); if(!k) return null;
    try {
      const [r,m]=await Promise.all([
        axios.get(`https://www.alphavantage.co/query?function=RSI&symbol=${symbol}&interval=daily&time_period=14&series_type=close&apikey=${k}`),
        axios.get(`https://www.alphavantage.co/query?function=MACD&symbol=${symbol}&interval=daily&series_type=close&apikey=${k}`),
      ]);
      const d={rsi:r.data?.['Technical Analysis: RSI'],macd:m.data?.['Technical Analysis: MACD']};
      await this.cache.set('technicals',{symbol},d,3600); return d;
    } catch{return null;}
  }

  async getAnalystRatings(symbol:string) {
    const c=await this.cache.get('analyst',{symbol}); if(c) return c;
    const k=this.config.get('FINNHUB_API_KEY'); if(!k) return null;
    try {
      const [r,t]=await Promise.all([
        axios.get(`https://finnhub.io/api/v1/stock/recommendation?symbol=${symbol}&token=${k}`),
        axios.get(`https://finnhub.io/api/v1/stock/price-target?symbol=${symbol}&token=${k}`),
      ]);
      const d={recommendations:r.data?.slice(0,4),priceTarget:t.data};
      await this.cache.set('analyst',{symbol},d,21600); return d;
    } catch{return null;}
  }

  async getHistory(symbol:string, days=200) {
    const c=await this.cache.get('history',{symbol,days}); if(c) return c;
    const k=this.config.get('FMP_API_KEY'); if(!k) return [];
    try {
      const {data}=await axios.get(`https://financialmodelingprep.com/api/v3/historical-price-full/${symbol}?timeseries=${days}&apikey=${k}`);
      const prices=data?.historical||[]; await this.cache.set('history',{symbol,days},prices,3600); return prices;
    } catch{return [];}
  }

  search(q:string) { return this.prisma.stock.findMany({ where:{OR:[{symbol:{contains:q.toUpperCase()}},{name:{contains:q,mode:'insensitive'}}]}, take:20 }); }

  upsert(symbol:string, data:any) { return this.prisma.stock.upsert({ where:{symbol}, update:data, create:{symbol,name:data.name||symbol,...data} }); }
}
