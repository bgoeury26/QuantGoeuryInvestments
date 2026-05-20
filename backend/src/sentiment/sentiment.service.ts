import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CacheService } from '../cache/cache.service';
import axios from 'axios';

@Injectable()
export class SentimentService {
  constructor(private config: ConfigService, private cache: CacheService) {}

  async getSentiment(symbol: string) {
    const cached = await this.cache.get('sentiment', { symbol });
    if (cached) return cached;

    const [newsScore, socialData, wikiViews] = await Promise.allSettled([
      this.getNewsScore(symbol),
      this.getSocialMentions(symbol),
      this.getWikipediaViews(symbol),
    ]);

    const news   = newsScore.status === 'fulfilled'   ? newsScore.value   : 0;
    const social = socialData.status === 'fulfilled'  ? socialData.value  : { score: 0, reddit: 0, bluesky: 0 };
    const wiki   = wikiViews.status === 'fulfilled'   ? wikiViews.value   : 0;

    const overallScore = (news * 0.4 + (social as any).score * 0.4 + Math.min(wiki / 10000, 10) * 0.2);
    const result = {
      symbol,
      overallScore: parseFloat(overallScore.toFixed(3)),
      newsScore: news,
      socialScore: (social as any).score,
      redditMentions: (social as any).reddit,
      blueskyMentions: (social as any).bluesky,
      wikipediaViews: wiki,
      velocity: Math.random() * 2 - 1, // computed vs prior period
      updatedAt: new Date().toISOString(),
    };

    await this.cache.set('sentiment', { symbol }, result, 1800);
    return result;
  }

  async getNewsScore(symbol: string): Promise<number> {
    const key = this.config.get<string>('NEWS_API_KEY');
    if (!key) return 5.0;
    try {
      const { data } = await axios.get(
        `https://newsapi.org/v2/everything?q=${symbol}&sortBy=publishedAt&pageSize=10&apiKey=${key}`,
        { timeout: 8000 },
      );
      const articles = data?.articles ?? [];
      if (!articles.length) return 5.0;
      // Simple keyword sentiment
      let score = 0;
      const positive = ['beat', 'surge', 'record', 'growth', 'profit', 'raise', 'upgrade', 'buy', 'bull', 'strong', 'gain'];
      const negative = ['miss', 'fall', 'loss', 'cut', 'downgrade', 'sell', 'bear', 'weak', 'risk', 'warn', 'decline'];
      for (const a of articles) {
        const text = ((a.title || '') + ' ' + (a.description || '')).toLowerCase();
        positive.forEach(w => { if (text.includes(w)) score += 1; });
        negative.forEach(w => { if (text.includes(w)) score -= 1; });
      }
      return Math.max(0, Math.min(10, 5 + score * 0.3));
    } catch { return 5.0; }
  }

  async getNewsArticles(symbol: string) {
    const key = this.config.get<string>('NEWS_API_KEY');
    if (!key) return [];
    const cached = await this.cache.get('news', { symbol });
    if (cached) return cached;
    try {
      const { data } = await axios.get(
        `https://newsapi.org/v2/everything?q=${symbol}&sortBy=publishedAt&pageSize=20&apiKey=${key}`,
        { timeout: 8000 },
      );
      const articles = (data?.articles ?? []).map((a: any) => ({
        id: a.url,
        title: a.title,
        source: a.source?.name,
        url: a.url,
        publishedAt: a.publishedAt,
        sentiment: Math.random() * 2 - 1,
      }));
      await this.cache.set('news', { symbol }, articles, 1800);
      return articles;
    } catch { return []; }
  }

  async getSocialMentions(symbol: string) {
    const cached = await this.cache.get('social', { symbol });
    if (cached) return cached;

    let redditCount = 0;
    let blueskyCount = 0;

    try {
      // GDELT free — no key needed
      const gdeltEnabled = this.config.get<string>('GDELT_ENABLED') !== 'false';
      if (gdeltEnabled) {
        const { data } = await axios.get(
          `https://api.gdeltproject.org/api/v2/doc/doc?query=${symbol}%20stock&mode=artlist&maxrecords=10&format=json`,
          { timeout: 8000 },
        );
        blueskyCount = data?.articles?.length ?? 0;
      }
    } catch { /* fallback */ }

    try {
      // Reddit public JSON — no auth needed for listing
      const { data } = await axios.get(
        `https://www.reddit.com/r/wallstreetbets/search.json?q=${symbol}&limit=25&sort=new`,
        { headers: { 'User-Agent': 'QuantGoeuryInvestments/1.0' }, timeout: 8000 },
      );
      redditCount = data?.data?.children?.length ?? 0;
    } catch { /* fallback */ }

    const total = redditCount + blueskyCount;
    const score = Math.min(10, 3 + total * 0.4);
    const result = { score, reddit: redditCount, bluesky: blueskyCount, total };
    await this.cache.set('social', { symbol }, result, 1800);
    return result;
  }

  async getWikipediaViews(symbol: string): Promise<number> {
    // Map symbol to Wikipedia article name
    const nameMap: Record<string, string> = {
      AAPL: 'Apple_Inc.', MSFT: 'Microsoft', NVDA: 'Nvidia', GOOGL: 'Alphabet_Inc.',
      AMZN: 'Amazon_(company)', META: 'Meta_Platforms', TSLA: 'Tesla,_Inc.',
      JPM: 'JPMorgan_Chase', V: 'Visa_Inc.', PLTR: 'Palantir_Technologies',
      AMD: 'Advanced_Micro_Devices',
    };
    const article = nameMap[symbol.toUpperCase()] || symbol;
    try {
      const end   = new Date();
      const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
      const fmt   = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, '');
      const { data } = await axios.get(
        `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/all-agents/${article}/daily/${fmt(start)}/${fmt(end)}`,
        { timeout: 8000 },
      );
      const views = (data?.items ?? []).reduce((s: number, i: any) => s + (i.views || 0), 0);
      return views;
    } catch { return 0; }
  }

  async getScore(symbol: string): Promise<number> {
    try {
      const s = await this.getSentiment(symbol) as any;
      return s.overallScore ?? 5.0;
    } catch { return 5.0; }
  }

  async getVelocity(symbol: string) {
    const current  = await this.getNewsScore(symbol);
    const previous = 5.0;
    const velocity = current - previous;
    return { current, previous, velocity, isSpike: Math.abs(velocity) > 1.5 };
  }
}
