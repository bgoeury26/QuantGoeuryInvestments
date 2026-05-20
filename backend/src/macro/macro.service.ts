import { Injectable } from '@nestjs/common';
import { CacheService } from '../cache/cache.service';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

const FRED_SERIES = {
  gdp: 'GDP', inflation: 'CPIAUCSL', unemployment: 'UNRATE',
  fedFundsRate: 'FEDFUNDS', yieldCurve: 'T10Y2Y', vix: 'VIXCLS',
  retailSales: 'RSAFS', industrialProduction: 'INDPRO'
};

@Injectable()
export class MacroService {
  constructor(private cache:CacheService, private config:ConfigService) {}

  async getFredSeries(seriesId:string) {
    const c=await this.cache.get('fred',{seriesId}); if(c) return c;
    const k=this.config.get('FRED_API_KEY'); if(!k) return null;
    try {
      const {data}=await axios.get(`https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${k}&file_type=json&limit=12&sort_order=desc`);
      const r=data?.observations||[];
      await this.cache.set('fred',{seriesId},r,86400); return r;
    } catch{return null;}
  }

  async getMacroSnapshot() {
    const c=await this.cache.get('macro_snapshot',{}); if(c) return c;
    const results = await Promise.all(
      Object.entries(FRED_SERIES).map(async ([key,id])=>({ key, data:await this.getFredSeries(id) }))
    );
    const snap = Object.fromEntries(results.map(r=>[r.key,r.data]));
    await this.cache.set('macro_snapshot',{},snap,86400); return snap;
  }

  computeMacroScore(snap:any): number {
    const scores:number[]=[];
    // Fed funds rate — lower is better for equities
    if(snap.fedFundsRate?.length) {
      const r=parseFloat(snap.fedFundsRate[0]?.value||'5');
      scores.push(r<2?8:r<4?6:r<6?4:2);
    }
    // Yield curve — positive = healthy
    if(snap.yieldCurve?.length) {
      const y=parseFloat(snap.yieldCurve[0]?.value||'0');
      scores.push(y>0.5?8:y>0?6:y>-0.5?4:2);
    }
    return scores.length?scores.reduce((a,b)=>a+b,0)/scores.length:5;
  }
}
