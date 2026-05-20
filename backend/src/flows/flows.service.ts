import { Injectable } from '@nestjs/common';
import { CacheService } from '../cache/cache.service';
import axios from 'axios';

@Injectable()
export class FlowsService {
  constructor(private cache:CacheService) {}

  private ago(days:number):string { const d=new Date(); d.setDate(d.getDate()-days); return d.toISOString().slice(0,10); }

  async getInstitutional(symbol:string) {
    const c=await this.cache.get('institutional',{symbol}); if(c) return c;
    try {
      const {data}=await axios.get(`https://efts.sec.gov/LATEST/search-index?q=%22${symbol}%22&dateRange=custom&startdt=${this.ago(90)}&enddt=${new Date().toISOString().slice(0,10)}&forms=13F-HR`,{headers:{'User-Agent':'QuantGoeuryInvestments contact@quant.com'}});
      const r={filings:data?.hits?.hits?.slice(0,20)||[],total:data?.hits?.total?.value||0};
      await this.cache.set('institutional',{symbol},r,86400); return r;
    } catch{return{filings:[],total:0};}
  }

  async getInsider(symbol:string) {
    const c=await this.cache.get('insider',{symbol}); if(c) return c;
    try {
      const {data}=await axios.get(`https://efts.sec.gov/LATEST/search-index?q=%22${symbol}%22&forms=4&dateRange=custom&startdt=${this.ago(90)}&enddt=${new Date().toISOString().slice(0,10)}`,{headers:{'User-Agent':'QuantGoeuryInvestments contact@quant.com'}});
      const r={trades:data?.hits?.hits?.slice(0,30)||[]};
      await this.cache.set('insider',{symbol},r,14400); return r;
    } catch{return{trades:[]};}
  }

  async getPolitical(symbol:string) {
    const c=await this.cache.get('political',{symbol}); if(c) return c;
    try {
      const {data}=await axios.get('https://house-stock-watcher-data.s3-us-east-2.amazonaws.com/data/all_transactions.json',{timeout:10000});
      const r={trades:(Array.isArray(data)?data:[]).filter((t:any)=>t.ticker===symbol).slice(0,20)};
      await this.cache.set('political',{symbol},r,43200); return r;
    } catch{return{trades:[]};}
  }

  async getSummary(symbol:string) {
    const [institutional,insider,political]=await Promise.all([this.getInstitutional(symbol),this.getInsider(symbol),this.getPolitical(symbol)]);
    return{institutional,insider,political};
  }
}
