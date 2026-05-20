import { Injectable } from '@nestjs/common';
import { CacheService } from '../cache/cache.service';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class SentimentService {
  constructor(private cache:CacheService, private config:ConfigService) {}

  async getNews(symbol:string) {
    const c=await this.cache.get('news',{symbol}); if(c) return c;
    const k=this.config.get('NEWS_API_KEY'); if(!k) return{articles:[],sentiment:0};
    try {
      const {data}=await axios.get(`https://newsapi.org/v2/everything?q=${symbol}&language=en&sortBy=publishedAt&pageSize=20&apiKey=${k}`);
      const articles=data.articles||[];
      const pos=['surge','gain','rise','beat','record','growth','strong','bullish'];
      const neg=['fall','drop','loss','miss','decline','weak','bearish','concern'];
      let score=0,n=0;
      articles.forEach((a:any)=>{ const t=`${a.title} ${a.description}`.toLowerCase(); const p=pos.filter(w=>t.includes(w)).length; const ng=neg.filter(w=>t.includes(w)).length; if(p+ng>0){score+=(p-ng)/(p+ng);n++;} });
      const r={articles:articles.slice(0,10),sentiment:n>0?score/n:0,count:articles.length};
      await this.cache.set('news',{symbol},r,1800); return r;
    } catch{return{articles:[],sentiment:0};}
  }

  async getReddit(symbol:string) {
    const c=await this.cache.get('reddit',{symbol}); if(c) return c;
    try {
      const subs=['wallstreetbets','investing','stocks'];
      const res=await Promise.all(subs.map(s=>axios.get(`https://www.reddit.com/r/${s}/search.json?q=${symbol}&sort=new&limit=25&t=week`,{headers:{'User-Agent':'QuantGoeuryInvestments/1.0'}}).catch(()=>({data:{data:{children:[]}}}))));
      const posts=res.flatMap((r:any)=>r.data?.data?.children||[]);
      const bull=['moon','buy','calls','bull','long','bullish','🚀'];
      const bear=['puts','short','bear','dump','sell','crash','bearish'];
      let score=0,n=0;
      posts.forEach((p:any)=>{ const t=(p.data?.title||'').toLowerCase(); const b=bull.filter(w=>t.includes(w)).length; const br=bear.filter(w=>t.includes(w)).length; if(b+br>0){score+=(b-br)/(b+br);n++;} });
      const r={posts:posts.slice(0,20).map((p:any)=>({title:p.data?.title,score:p.data?.score,subreddit:p.data?.subreddit})),totalMentions:posts.length,sentiment:n>0?score/n:0};
      await this.cache.set('reddit',{symbol},r,3600); return r;
    } catch{return{posts:[],totalMentions:0,sentiment:0};}
  }

  async getGdelt(symbol:string) {
    const c=await this.cache.get('gdelt',{symbol}); if(c) return c;
    try {
      const {data}=await axios.get(`https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(`"${symbol}" sourcelang:english`)}&mode=artlist&maxrecords=25&format=json`,{timeout:10000});
      const articles=data?.articles||[];
      const tones=articles.map((a:any)=>parseFloat(a.tone||'0'));
      const r={articles:articles.slice(0,10),count:articles.length,avgTone:tones.length?tones.reduce((a:number,b:number)=>a+b,0)/tones.length:0};
      await this.cache.set('gdelt',{symbol},r,3600); return r;
    } catch{return{articles:[],count:0,avgTone:0};}
  }

  async getWikipedia(name:string) {
    const c=await this.cache.get('wiki',{name}); if(c) return c;
    try {
      const page=encodeURIComponent(name.replace(/ /g,'_'));
      const end=new Date().toISOString().slice(0,10).replace(/-/g,'');
      const start=new Date(Date.now()-30*86400000).toISOString().slice(0,10).replace(/-/g,'');
      const {data}=await axios.get(`https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/all-agents/${page}/daily/${start}/${end}`,{headers:{'User-Agent':'QuantGoeuryInvestments (contact@quant.com)'}});
      const views=(data?.items||[]).map((i:any)=>i.views);
      const r7=views.slice(-7).reduce((a:number,b:number)=>a+b,0)/7;
      const p7=views.slice(-14,-7).reduce((a:number,b:number)=>a+b,0)/7;
      const r={views:data?.items||[],recent7:r7,prior7:p7,spikeRatio:p7>0?r7/p7:1};
      await this.cache.set('wiki',{name},r,21600); return r;
    } catch{return{views:[],spikeRatio:1};}
  }
}
