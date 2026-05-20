import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AlphaService {
  constructor(private prisma: PrismaService) {}

  detectVolumeAnomaly(current:number, hist:number[]): number {
    if(hist.length<5) return 0;
    const mean=hist.reduce((a,b)=>a+b,0)/hist.length;
    const std=Math.sqrt(hist.reduce((s,v)=>s+Math.pow(v-mean,2),0)/hist.length);
    if(std===0) return 0;
    return Math.min(1,Math.max(0,((current-mean)/std-1)/3));
  }

  detectSentimentVelocity(cur:number,prev:number,newsCur:number,newsPrev:number): number {
    const s:number[]=[];
    if(prev>0) s.push(Math.min(1,Math.max(0,(cur-prev)/prev/3)));
    if(newsPrev>0) s.push(Math.min(1,Math.max(0,(newsCur-newsPrev)/newsPrev/5)));
    return s.length?s.reduce((a,b)=>a+b,0)/s.length:0;
  }

  detectInsiderActivity(trades:{type:string;daysAgo:number;value:number}[]): number {
    const buys=trades.filter(t=>t.type==='buy'&&t.daysAgo<=30);
    const sells=trades.filter(t=>t.type==='sell'&&t.daysAgo<=30);
    if(!buys.length) return 0;
    const bv=buys.reduce((s,t)=>s+t.value,0);
    const sv=sells.reduce((s,t)=>s+t.value,0);
    const cluster=buys.length>=3?0.3:buys.length===2?0.15:0;
    return Math.min(1,Math.max(0,(bv-sv*0.5)/Math.max(bv+sv,1)+cluster));
  }

  detectInstitutionalShift(cur:number,prev:number,fundsUp:number,total:number): number {
    if(prev===0) return 0;
    const change=(cur-prev)/prev;
    const participation=total>0?fundsUp/total:0;
    return change>0?Math.min(1,change*2+participation*0.3):0;
  }

  computeAnomalyScore(vol:number,sent:number,insider:number,inst:number): number {
    return Math.min(1,Math.max(0,vol*0.30+sent*0.25+insider*0.25+inst*0.20));
  }

  classifySignal(vol:number,sent:number,insider:number,inst:number,pricePct:number): string {
    if(insider>0.6&&inst>0.4) return 'SMART_MONEY_ENTRY';
    if(vol>0.6&&Math.abs(pricePct)<0.02) return 'ACCUMULATION';
    if(sent>0.7&&vol>0.5) return 'SENTIMENT_PUMP';
    if(vol>0.7&&pricePct>0.02) return 'MOMENTUM_IGNITION';
    if(vol>0.5&&insider<0.1&&pricePct<-0.03) return 'RISK_WARNING';
    return 'NEUTRAL';
  }

  isEarlyOpportunity(anomaly:number, pricePct:number): boolean {
    return anomaly>0.45&&Math.abs(pricePct)<0.03;
  }

  async getLatestSignals(stockId:string) {
    return this.prisma.stockSignal.findMany({ where:{stockId,expiresAt:{gt:new Date()}}, orderBy:{detectedAt:'desc'}, take:10 });
  }

  async getEarlyOpportunities() {
    return this.prisma.stockSignal.findMany({ where:{earlyFlag:true,expiresAt:{gt:new Date()}}, include:{stock:true}, orderBy:{strength:'desc'}, take:20 });
  }
}
