import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CacheService } from '../cache/cache.service';
import { getJson, postJson } from '../common/http.util';

/**
 * SentimentService — news + social attention.
 *
 * Re-platformed off Finnhub premium endpoints (/news-sentiment,
 * /stock/social-sentiment are paid) onto free sources:
 *   - News      -> NewsAPI /everything           (NEWS_API_KEY, 100/day)
 *   - News bkup -> Finnhub /company-news          (works free)
 *   - Social    -> Reddit search across finance subs (OAuth, free)
 *   - Macro buzz-> GDELT DOC API                  (no key)
 *
 * Sentiment polarity is computed in-house with a small finance lexicon
 * (no paid NLP).
 */
@Injectable()
export class SentimentService {
  private readonly logger = new Logger(SentimentService.name);
  private redditToken: { value: string; expires: number } | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly cache: CacheService,
  ) {}

  private static readonly POSITIVE = [
    'beat', 'beats', 'surge', 'surged', 'rally', 'gains', 'growth', 'upgrade',
    'outperform', 'strong', 'record', 'profit', 'bullish', 'soar', 'jump',
    'breakthrough', 'wins', 'boost', 'optimistic', 'expansion',
  ];
  private static readonly NEGATIVE = [
    'miss', 'misses', 'plunge', 'plunged', 'fall', 'falls', 'loss', 'losses',
    'downgrade', 'underperform', 'weak', 'cut', 'lawsuit', 'bearish', 'crash',
    'slump', 'warning', 'decline', 'risk', 'concern', 'investigation', 'recall',
  ];

  /** Lexicon polarity of a text blob in [-1, 1]. */
  private polarity(text: string): number {
    if (!text) return 0;
    const words = text.toLowerCase().split(/\W+/);
    let score = 0;
    for (const w of words) {
      if (SentimentService.POSITIVE.includes(w)) score += 1;
      if (SentimentService.NEGATIVE.includes(w)) score -= 1;
    }
    const hits = Math.abs(score);
    return hits === 0 ? 0 : Math.max(-1, Math.min(1, score / Math.sqrt(hits) / 3));
  }

  // ----------------------------------------------------------- AGGREGATE
  async getSentiment(symbol: string) {
    const upper = symbol.toUpperCase();
    const cacheKey = `sentiment:${upper}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const [news, social, gdelt] = await Promise.all([
      this.getNewsArticles(upper),
      this.getSocialMentions(upper),
      this.getGdeltTone(upper),
    ]);

    const newsArticles = (news as any).articles ?? [];
    const newsPolarities = newsArticles.map((a: any) =>
      this.polarity(`${a.title ?? ''} ${a.summary ?? ''}`),
    );
    const newsScore = newsPolarities.length
      ? newsPolarities.reduce((a: number, b: number) => a + b, 0) / newsPolarities.length
      : 0;

    const socialScore = (social as any).score ?? 0;
    const gdeltScore = (gdelt as any).normalizedTone ?? 0;

    // Weighted blend; news weighted highest, then GDELT, then social.
    const parts = [
      { v: newsScore, w: newsArticles.length ? 0.5 : 0 },
      { v: gdeltScore, w: (gdelt as any).articleCount ? 0.3 : 0 },
      { v: socialScore, w: (social as any).mentionCount ? 0.2 : 0 },
    ];
    const totalW = parts.reduce((s, p) => s + p.w, 0);
    const score = totalW > 0 ? parts.reduce((s, p) => s + p.v * p.w, 0) / totalW : 0;

    const result = {
      symbol: upper,
      score: Math.round(score * 100) / 100, // [-1, 1]
      newsScore: Math.round(newsScore * 100) / 100,
      socialScore: Math.round(socialScore * 100) / 100,
      gdeltScore: Math.round(gdeltScore * 100) / 100,
      articlesCount: newsArticles.length,
      socialMentions: (social as any).mentionCount ?? 0,
      dataSources: [
        newsArticles.length ? 'NewsAPI/Finnhub' : null,
        (social as any).mentionCount ? 'Reddit' : null,
        (gdelt as any).articleCount ? 'GDELT' : null,
      ].filter(Boolean),
    };
    await this.cache.set(cacheKey, result, 900);
    return result;
  }

  // ---------------------------------------------------------------- NEWS
  async getNewsArticles(symbol: string) {
    const upper = symbol.toUpperCase();
    const cacheKey = `sentiment:news:${upper}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const newsApiKey = this.config.get<string>('NEWS_API_KEY');
    const fhKey = this.config.get<string>('FINNHUB_API_KEY');
    const from = new Date(Date.now() - 7 * 86400_000).toISOString().split('T')[0];
    const to = new Date().toISOString().split('T')[0];

    const [apiNews, fhNews] = await Promise.all([
      newsApiKey
        ? getJson<any>('https://newsapi.org/v2/everything', {
            params: {
              q: upper, from, sortBy: 'publishedAt', language: 'en',
              pageSize: 20, apiKey: newsApiKey,
            },
          }, 'NewsAPI')
        : Promise.resolve(null),
      fhKey
        ? getJson<any[]>('https://finnhub.io/api/v1/company-news', {
            params: { symbol: upper, from, to, token: fhKey },
          }, 'Finnhub news')
        : Promise.resolve(null),
    ]);

    const a1 = (apiNews?.articles ?? []).slice(0, 12).map((a: any) => ({
      title: a.title, source: a.source?.name, publishedAt: a.publishedAt,
      url: a.url, summary: a.description,
    }));
    const a2 = (Array.isArray(fhNews) ? fhNews : []).slice(0, 12).map((a: any) => ({
      title: a.headline, source: a.source,
      publishedAt: a.datetime ? new Date(a.datetime * 1000).toISOString() : null,
      url: a.url, summary: a.summary,
    }));

    const result = { symbol: upper, articles: [...a1, ...a2] };
    await this.cache.set(cacheKey, result, 900);
    return result;
  }

  // -------------------------------------------------------------- SOCIAL
  /** Reddit OAuth client-credentials token (cached until ~expiry). */
  private async getRedditToken(): Promise<string | null> {
    if (this.redditToken && this.redditToken.expires > Date.now()) {
      return this.redditToken.value;
    }
    const id = this.config.get<string>('REDDIT_CLIENT_ID');
    const secret = this.config.get<string>('REDDIT_CLIENT_SECRET');
    if (!id || !secret) return null;

    const data = await postJson<any>(
      'https://www.reddit.com/api/v1/access_token',
      'grant_type=client_credentials',
      {
        auth: { username: id, password: secret },
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      },
      'Reddit token',
    );
    if (!data?.access_token) return null;
    this.redditToken = {
      value: data.access_token,
      expires: Date.now() + (data.expires_in ?? 3600) * 1000 - 60_000,
    };
    return this.redditToken.value;
  }

  async getSocialMentions(symbol: string) {
    const upper = symbol.toUpperCase();
    const cacheKey = `sentiment:social:${upper}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const token = await this.getRedditToken();
    if (!token) {
      const result = {
        symbol: upper, mentionCount: 0, score: 0, posts: [],
        note: 'Reddit credentials not configured',
      };
      await this.cache.set(cacheKey, result, 900);
      return result;
    }

    const ua = this.config.get<string>('REDDIT_USER_AGENT') ?? 'QuantGoeuryInvestments/1.0';
    const data = await getJson<any>(
      'https://oauth.reddit.com/r/wallstreetbets+investing+stocks/search',
      {
        params: { q: upper, sort: 'new', limit: 25, restrict_sr: true, t: 'week' },
        headers: { Authorization: `Bearer ${token}`, 'User-Agent': ua },
      },
      'Reddit search',
    );

    const posts = (data?.data?.children ?? []).map((c: any) => ({
      title: c.data?.title,
      subreddit: c.data?.subreddit,
      score: c.data?.score,
      created: c.data?.created_utc
        ? new Date(c.data.created_utc * 1000).toISOString()
        : null,
      url: `https://reddit.com${c.data?.permalink ?? ''}`,
    }));

    const polarities = posts.map((p: any) => this.polarity(p.title ?? ''));
    const score = polarities.length
      ? polarities.reduce((a: number, b: number) => a + b, 0) / polarities.length
      : 0;

    const result = {
      symbol: upper,
      mentionCount: posts.length,
      score: Math.round(score * 100) / 100,
      posts: posts.slice(0, 10),
    };
    await this.cache.set(cacheKey, result, 900);
    return result;
  }

  // --------------------------------------------------------------- GDELT
  async getGdeltTone(symbol: string) {
    const upper = symbol.toUpperCase();
    const cacheKey = `sentiment:gdelt:${upper}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    if (this.config.get<string>('GDELT_ENABLED') !== 'true') {
      const result = { symbol: upper, normalizedTone: 0, articleCount: 0, note: 'GDELT disabled' };
      await this.cache.set(cacheKey, result, 900);
      return result;
    }

    const data = await getJson<any>(
      'https://api.gdeltproject.org/api/v2/doc/doc',
      {
        params: {
          query: upper, mode: 'tonechart', format: 'json', timespan: '7d',
        },
      },
      'GDELT',
    );

    // tonechart returns bins of {bin, count}; weighted average tone.
    const bins = data?.tonechart ?? [];
    let weighted = 0, total = 0;
    for (const b of bins) {
      weighted += (b.bin ?? 0) * (b.count ?? 0);
      total += b.count ?? 0;
    }
    const avgTone = total ? weighted / total : 0; // GDELT tone roughly [-10, 10]
    const result = {
      symbol: upper,
      normalizedTone: Math.max(-1, Math.min(1, avgTone / 10)),
      articleCount: total,
    };
    await this.cache.set(cacheKey, result, 1800);
    return result;
  }

  // ------------------------------------------------------------ VELOCITY
  async getVelocity(symbol: string) {
    const upper = symbol.toUpperCase();
    const cacheKey = `sentiment:velocity:${upper}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const news: any = await this.getNewsArticles(upper);
    const articles: any[] = news.articles ?? [];
    const now = Date.now();
    const last24h = articles.filter(
      (a) => a.publishedAt && now - new Date(a.publishedAt).getTime() < 86400_000,
    ).length;
    const prev = Math.max(articles.length - last24h, 0);
    const dailyBaseline = prev / 6; // articles from the preceding 6 days
    const velocity = dailyBaseline > 0 ? last24h / dailyBaseline : last24h > 0 ? 2 : 0;

    const result = {
      symbol: upper,
      articles24h: last24h,
      dailyBaseline: Math.round(dailyBaseline * 10) / 10,
      velocityRatio: Math.round(velocity * 100) / 100, // >1 = accelerating
      isBurst: velocity >= 3,
    };
    await this.cache.set(cacheKey, result, 900);
    return result;
  }
}
