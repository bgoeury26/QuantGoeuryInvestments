import { Injectable } from "@nestjs/common";
import { CacheService } from "../cache/cache.service";
import { ConfigService } from "@nestjs/config";
import axios from "axios";

@Injectable()
export class SentimentService {
  constructor(private cache: CacheService, private config: ConfigService) {}

  // NewsAPI — 100 req/day free. Cached 30 min
  async getNewsSentiment(symbol: string) {
    const cached = await this.cache.get("news", { symbol });
    if (cached) return cached;
    const key = this.config.get("NEWS_API_KEY");
    if (!key) return { articles: [], sentiment: 0 };
    try {
      const { data } = await axios.get(`https://newsapi.org/v2/everything?q=${symbol}&language=en&sortBy=publishedAt&pageSize=20&apiKey=${key}`);
      const arts = data.articles || [];
      const sentiment = this.scoreArticles(arts);
      const result = { articles: arts.slice(0, 10), sentiment, count: arts.length };
      await this.cache.set("news", { symbol }, result, 1800);
      return result;
    } catch { return { articles: [], sentiment: 0 }; }
  }

  // Reddit sentiment — FREE public JSON API. Cached 1h
  async getRedditSentiment(symbol: string) {
    const cached = await this.cache.get("reddit", { symbol });
    if (cached) return cached;
    try {
      const subs = ["wallstreetbets", "investing", "stocks"];
      const results = await Promise.all(subs.map(sub =>
        axios.get(`https://www.reddit.com/r/${sub}/search.json?q=${symbol}&sort=new&limit=25&t=week`, {
          headers: { "User-Agent": "QuantGoeuryInvestments/1.0" },
        }).catch(() => ({ data: { data: { children: [] } } }))
      ));
      const posts = results.flatMap(r => r.data?.data?.children || []);
      const result = {
        posts: posts.slice(0, 20).map((p: any) => ({ title: p.data?.title, score: p.data?.score, subreddit: p.data?.subreddit })),
        totalMentions: posts.length,
        sentiment: this.scoreReddit(posts),
      };
      await this.cache.set("reddit", { symbol }, result, 3600);
      return result;
    } catch { return { posts: [], totalMentions: 0, sentiment: 0 }; }
  }

  // GDELT — FREE, no key. Cached 1h
  async getGdeltSentiment(symbol: string) {
    const cached = await this.cache.get("gdelt", { symbol });
    if (cached) return cached;
    try {
      const q = encodeURIComponent(`"${symbol}" sourcelang:english`);
      const { data } = await axios.get(`https://api.gdeltproject.org/api/v2/doc/doc?query=${q}&mode=artlist&maxrecords=25&format=json`, { timeout: 10000 });
      const arts = data?.articles || [];
      const avgTone = arts.length ? arts.reduce((s: number, a: any) => s + parseFloat(a.tone || "0"), 0) / arts.length : 0;
      const result = { articles: arts.slice(0, 10), count: arts.length, avgTone };
      await this.cache.set("gdelt", { symbol }, result, 3600);
      return result;
    } catch { return { articles: [], count: 0, avgTone: 0 }; }
  }

  // Wikipedia pageviews — FREE. Cached 6h
  async getWikipediaPageviews(companyName: string) {
    const cached = await this.cache.get("wikipedia", { companyName });
    if (cached) return cached;
    try {
      const page = encodeURIComponent(companyName.replace(/ /g, "_"));
      const end = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      const start = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10).replace(/-/g, "");
      const { data } = await axios.get(`https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/all-agents/${page}/daily/${start}/${end}`, {
        headers: { "User-Agent": "QuantGoeuryInvestments (contact@quant.com)" },
      });
      const items = data?.items || [];
      const views = items.map((i: any) => i.views);
      const r7 = views.slice(-7).reduce((a: number, b: number) => a + b, 0) / 7 || 0;
      const p7 = views.slice(-14, -7).reduce((a: number, b: number) => a + b, 0) / 7 || 1;
      const result = { views: items, recent7dayAvg: r7, spikeRatio: r7 / p7 };
      await this.cache.set("wikipedia", { companyName }, result, 21600);
      return result;
    } catch { return { views: [], spikeRatio: 1 }; }
  }

  async getAggregated(symbol: string, companyName: string) {
    const [news, reddit, gdelt, wiki] = await Promise.all([
      this.getNewsSentiment(symbol), this.getRedditSentiment(symbol),
      this.getGdeltSentiment(symbol), this.getWikipediaPageviews(companyName),
    ]);
    const combined = (news as any).sentiment * 0.35 + (reddit as any).sentiment * 0.30 + ((gdelt as any).avgTone / 10) * 0.25;
    return { news, reddit, gdelt, wiki, combinedSentiment: Math.max(-1, Math.min(1, combined)), sentimentScore: (combined + 1) * 5 };
  }

  private scoreArticles(arts: any[]): number {
    const pos = ["surge","gain","rise","beat","record","strong","bullish","upgrade"];
    const neg = ["fall","drop","loss","miss","decline","weak","bearish","downgrade"];
    let s = 0, n = 0;
    for (const a of arts) {
      const t = `${a.title} ${a.description}`.toLowerCase();
      const p = pos.filter(w => t.includes(w)).length;
      const ng = neg.filter(w => t.includes(w)).length;
      if (p + ng > 0) { s += (p - ng) / (p + ng); n++; }
    }
    return n ? s / n : 0;
  }

  private scoreReddit(posts: any[]): number {
    const pos = ["moon","buy","calls","bull","long","bullish","🚀"];
    const neg = ["puts","short","bear","dump","crash","bearish","🌈🐻"];
    let s = 0, n = 0;
    for (const p of posts) {
      const t = (p.data?.title || "").toLowerCase();
      const pos2 = pos.filter(w => t.includes(w)).length;
      const neg2 = neg.filter(w => t.includes(w)).length;
      if (pos2 + neg2 > 0) { s += (pos2 - neg2) / (pos2 + neg2); n++; }
    }
    return n ? s / n : 0;
  }
}
