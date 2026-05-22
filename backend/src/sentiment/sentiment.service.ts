import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CacheService } from '../cache/cache.service';
import axios from 'axios';

@Injectable()
export class SentimentService {
  private readonly logger = new Logger(SentimentService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly cache: CacheService,
  ) {}

  async getSentiment(symbol: string) {
    const cacheKey = `sentiment:${symbol}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const newsApiKey = this.config.get<string>('NEWS_API_KEY');
    const finnhubKey = this.config.get<string>('FINNHUB_API_KEY');
    const from       = new Date(Date.now() - 7 * 86400 * 1000).toISOString().split('T')[0];

    const [newsRes, finnSentRes] = await Promise.allSettled([
      newsApiKey
        ? axios.get('https://newsapi.org/v2/everything', {
            params: { q: symbol, from, sortBy: 'publishedAt', language: 'en', pageSize: 20, apiKey: newsApiKey },
          }).then(r => r.data)
        : Promise.resolve(null),
      finnhubKey
        ? axios.get('https://finnhub.io/api/v1/news-sentiment', {
            params: { symbol, token: finnhubKey },
          }).then(r => r.data)
        : Promise.resolve(null),
    ]);

    const news     = newsRes.status     === 'fulfilled' ? newsRes.value     : null;
    const finnSent = finnSentRes.status === 'fulfilled' ? finnSentRes.value : null;

    const buzz           = finnSent?.buzz?.buzz                    ?? 0;
    const weeklyAvg      = finnSent?.buzz?.weeklyAverage           ?? 0;
    const bullishPct     = finnSent?.sentiment?.bullishPercent     ?? null;
    const bearishPct     = finnSent?.sentiment?.bearishPercent     ?? null;
    const sentimentScore = finnSent?.companyNewsScore              ?? null;
    const sectorAvg      = finnSent?.sectorAverageBullishPercent   ?? null;

    let score = 0;
    if (bullishPct != null && bearishPct != null) score = bullishPct - bearishPct;
    else if (sentimentScore != null) score = (sentimentScore - 0.5) * 2;

    const articles = news?.articles?.slice(0, 10).map((a: any) => ({
      title: a.title, source: a.source?.name, publishedAt: a.publishedAt, url: a.url,
    })) ?? [];

    const result = {
      symbol, score: Math.round(score * 100) / 100,
      bullishPercent: bullishPct, bearishPercent: bearishPct,
      buzz, weeklyAvgBuzz: weeklyAvg, sectorAvgBullish: sectorAvg,
      articlesCount: news?.totalResults ?? 0, articles,
      dataSource: [finnSent ? 'Finnhub' : null, news ? 'NewsAPI' : null].filter(Boolean),
    };

    await this.cache.set(cacheKey, result, 900);
    return result;
  }

  // controller calls getNewsArticles(symbol)
  async getNewsArticles(symbol: string) {
    const cacheKey = `sentiment:news:${symbol}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const finnhubKey = this.config.get<string>('FINNHUB_API_KEY');
    const newsApiKey = this.config.get<string>('NEWS_API_KEY');
    const from = new Date(Date.now() - 7 * 86400 * 1000).toISOString().split('T')[0];
    const to   = new Date().toISOString().split('T')[0];

    const [finnRes, newsRes] = await Promise.allSettled([
      finnhubKey
        ? axios.get('https://finnhub.io/api/v1/company-news', {
            params: { symbol, from, to, token: finnhubKey },
          }).then(r => r.data)
        : Promise.resolve([]),
      newsApiKey
        ? axios.get('https://newsapi.org/v2/everything', {
            params: { q: symbol, from, sortBy: 'publishedAt', language: 'en', pageSize: 10, apiKey: newsApiKey },
          }).then(r => r.data?.articles ?? [])
        : Promise.resolve([]),
    ]);

    const finnNews = finnRes.status === 'fulfilled' && Array.isArray(finnRes.value)
      ? finnRes.value.slice(0, 15).map((a: any) => ({
          title: a.headline, source: a.source,
          publishedAt: new Date(a.datetime * 1000).toISOString(),
          url: a.url, summary: a.summary,
        }))
      : [];

    const apiNews = newsRes.status === 'fulfilled' && Array.isArray(newsRes.value)
      ? newsRes.value.slice(0, 10).map((a: any) => ({
          title: a.title, source: a.source?.name,
          publishedAt: a.publishedAt, url: a.url, summary: a.description,
        }))
      : [];

    const result = { symbol, articles: [...finnNews, ...apiNews] };
    await this.cache.set(cacheKey, result, 900);
    return result;
  }

  // controller calls getSocialMentions(symbol)
  async getSocialMentions(symbol: string) {
    const cacheKey = `sentiment:social:${symbol}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const finnhubKey = this.config.get<string>('FINNHUB_API_KEY');
    const data = finnhubKey
      ? await axios.get('https://finnhub.io/api/v1/stock/social-sentiment', {
          params: { symbol, from: new Date(Date.now() - 7 * 86400 * 1000).toISOString().split('T')[0], token: finnhubKey },
        }).then(r => r.data).catch(() => null)
      : null;

    const result = {
      symbol,
      reddit:  data?.reddit  ?? [],
      twitter: data?.twitter ?? [],
      note: data ? null : 'Social sentiment requires Finnhub premium.',
    };

    await this.cache.set(cacheKey, result, 900);
    return result;
  }

  // controller calls getVelocity(symbol)
  async getVelocity(symbol: string) {
    const cacheKey = `sentiment:velocity:${symbol}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const finnhubKey = this.config.get<string>('FINNHUB_API_KEY');
    const data = finnhubKey
      ? await axios.get('https://finnhub.io/api/v1/news-sentiment', {
          params: { symbol, token: finnhubKey },
        }).then(r => r.data).catch(() => null)
      : null;

    const result = {
      symbol,
      buzz:           data?.buzz?.buzz           ?? 0,
      weeklyAverage:  data?.buzz?.weeklyAverage  ?? 0,
      monthlyAverage: data?.buzz?.monthlyAverage ?? 0,
      bullishPercent: data?.sentiment?.bullishPercent ?? null,
      bearishPercent: data?.sentiment?.bearishPercent ?? null,
    };

    await this.cache.set(cacheKey, result, 900);
    return result;
  }
}
