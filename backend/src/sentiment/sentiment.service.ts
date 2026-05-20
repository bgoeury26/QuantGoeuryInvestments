import { Injectable } from '@nestjs/common';
import { CacheService } from '../cache/cache.service';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class SentimentService {
  constructor(private cache: CacheService, private config: ConfigService) {}

  async getNewsSentiment(symbol: string) {
    const cached = await this.cache.get('news', { symbol });
    if (cached) return cached;
    const key = this.config.get('NEWS_API_KEY');
    if (!key) return { articles: [], sentiment: 0 };
    try {
      const { data } = await axios.get(`https://newsapi.org/v2/everything?q=${symbol}&language=en&sortBy=publishedAt&pageSize=20&apiKey=${key}`);
      const articles = data.articles || [];
      const pos = ['surge','gain','rise','beat','record','growth','strong','bullish','buy','upgrade'];
      const neg = ['fall','drop','loss','miss','decline','weak','bearish','sell','downgrade','concern'];
      let score = 0, count = 0;
      for (const a of articles) {
        const t = `${a.title} ${a.description}`.toLowerCase();
        const p = pos.filter(w => t.includes(w)).length;
        const n = neg.filter(w => t.includes(w)).length;
        if (p + n > 0) { score += (p - n) / (p + n); count++; }
      }
      const result = { articles: articles.slice(0,10), sentiment: count ? score / count : 0, count: articles.length };
      await this.cache.set('news', { symbol }, result, 1800);
      return result;
    } catch { return { articles: [], sentiment: 0 }; }
  }

  async getRedditSentiment(symbol: string) {
    const cached = await this.cache.get('reddit', { symbol });
    if (cached) return cached;
    try {
      const subs = ['wallstreetbets','investing','stocks'];
      const responses = await Promise.all(subs.map(sub =>
        axios.get(`https://www.reddit.com/r/${sub}/search.json?q=${symbol}&sort=new&limit=25&t=week`, {
          headers: { 'User-Agent': 'QuantGoeuryInvestments/1.0' }
        }).catch(() => ({ data: { data: { children: [] } } }))
      ));
      const posts = responses.flatMap(r => r.data?.data?.children || []);
      const bull = ['moon','buy','calls','bull','long','hodl','bullish','pump'];
      const bear = ['puts','short','bear','dump','sell','crash','bearish'];
      let score = 0, count = 0;
      for (const p of posts) {
        const t = (p.data?.title || '').toLowerCase();
        const b = bull.filter(w => t.includes(w)).length;
        const n = bear.filter(w => t.includes(w)).length;
        if (b + n > 0) { score += (b - n) / (b + n); count++; }
      }
      const result = { posts: posts.slice(0,20).map((p: any) => ({ title: p.data?.title, score: p.data?.score, subreddit: p.data?.subreddit })), totalMentions: posts.length, sentiment: count ? score / count : 0 };
      await this.cache.set('reddit', { symbol }, result, 3600);
      return result;
    } catch { return { posts: [], totalMentions: 0, sentiment: 0 }; }
  }

  async getGdeltSentiment(symbol: string) {
    const cached = await this.cache.get('gdelt', { symbol });
    if (cached) return cached;
    try {
      const q = encodeURIComponent(`"${symbol}" sourcelang:english`);
      const { data } = await axios.get(`https://api.gdeltproject.org/api/v2/doc/doc?query=${q}&mode=artlist&maxrecords=25&format=json`, { timeout: 10000 });
      const articles = data?.articles || [];
      const avgTone = articles.length ? articles.reduce((s: number, a: any) => s + parseFloat(a.tone || '0'), 0) / articles.length : 0;
      const result = { articles: articles.slice(0,10), count: articles.length, avgTone };
      await this.cache.set('gdelt', { symbol }, result, 3600);
      return result;
    } catch { return { articles: [], count: 0, avgTone: 0 }; }
  }

  async getWikipediaViews(companyName: string) {
    const cached = await this.cache.get('wikipedia', { companyName });
    if (cached) return cached;
    try {
      const page = encodeURIComponent(companyName.replace(/ /g, '_'));
      const end = new Date().toISOString().slice(0,10).replace(/-/g,'');
      const start = new Date(Date.now() - 30*86400000).toISOString().slice(0,10).replace(/-/g,'');
      const { data } = await axios.get(`https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/all-agents/${page}/daily/${start}/${end}`, { headers: { 'User-Agent': 'QuantGoeuryInvestments (contact@quant.com)' } });
      const items = data?.items || [];
      const views = items.map((i: any) => i.views);
      const r7 = views.slice(-7).reduce((a: number, b: number) => a + b, 0) / 7;
      const p7 = views.slice(-14,-7).reduce((a: number, b: number) => a + b, 0) / 7;
      const result = { views: items, recent7: r7, prior7: p7, spikeRatio: p7 > 0 ? r7 / p7 : 1 };
      await this.cache.set('wikipedia', { companyName }, result, 21600);
      return result;
    } catch { return { views: [], spikeRatio: 1 }; }
  }

  async getAggregated(symbol: string, companyName: string) {
    const [news, reddit, gdelt] = await Promise.all([this.getNewsSentiment(symbol), this.getRedditSentiment(symbol), this.getGdeltSentiment(symbol)]);
    const combined = (news.sentiment||0)*0.35 + (reddit.sentiment||0)*0.30 + (gdelt.avgTone/10||0)*0.25;
    return { news, reddit, gdelt, combinedSentiment: Math.max(-1, Math.min(1, combined)), sentimentScore: (combined + 1) * 5 };
  }
}
