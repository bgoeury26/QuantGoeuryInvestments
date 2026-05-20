import axios, { AxiosInstance } from 'axios';
import Cookies from 'js-cookie';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// ----------------------------------------------------------------
// Axios instance with JWT interceptors
// ----------------------------------------------------------------
export const api: AxiosInstance = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
});

api.interceptors.request.use((config) => {
  const token = Cookies.get('access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      Cookies.remove('access_token');
      if (typeof window !== 'undefined') window.location.href = '/login';
    }
    return Promise.reject(err);
  },
);

// ----------------------------------------------------------------
// AUTH
// ----------------------------------------------------------------
export const authApi = {
  login: (email: string, password: string) =>
    api.post<{ access_token: string; user: User }>('/auth/login', { email, password }),
  signup: (email: string, password: string, name: string) =>
    api.post<{ message: string }>('/auth/signup', { email, password, name }),
  me: () => api.get<User>('/auth/me'),
  logout: () => { Cookies.remove('access_token'); },
};

// ----------------------------------------------------------------
// STOCKS
// ----------------------------------------------------------------
export const stocksApi = {
  search:  (q: string) => api.get<StockSearchResult[]>('/stocks/search', { params: { q } }),
  get:     (symbol: string) => api.get<StockDetail>(`/stocks/${symbol}`),
  quote:   (symbol: string) => api.get<StockQuote>(`/stocks/${symbol}/quote`),
  chart:   (symbol: string, range = '1M') => api.get<OHLCVPoint[]>(`/stocks/${symbol}/chart`, { params: { range } }),
  technicals: (symbol: string) => api.get<Technicals>(`/stocks/${symbol}/technicals`),
  fundamentals: (symbol: string) => api.get<Fundamentals>(`/stocks/${symbol}/fundamentals`),
  analysts: (symbol: string) => api.get<AnalystRatings>(`/stocks/${symbol}/analysts`),
};

// ----------------------------------------------------------------
// SCORING ENGINE
// ----------------------------------------------------------------
export const scoringApi = {
  getScore:    (symbol: string) => api.get<ScoreResult>(`/scoring/${symbol}`),
  computeScore:(symbol: string) => api.post<ScoreResult>(`/scoring/${symbol}/compute`),
  topOpportunities: (limit = 10) => api.get<RankedOpportunity[]>('/scoring/opportunities/top', { params: { limit } }),
};

// ----------------------------------------------------------------
// ALPHA ENGINE
// ----------------------------------------------------------------
export const alphaApi = {
  getSignals:    (symbol: string) => api.get<AlphaSignal[]>(`/alpha/${symbol}/signals`),
  earlyOpps:     () => api.get<EarlyOpportunity[]>('/alpha/early-opportunities'),
  anomalyScore:  (symbol: string) => api.get<AnomalyResult>(`/alpha/${symbol}/anomaly`),
};

// ----------------------------------------------------------------
// FLOWS (Institutional + Insider + Political)
// ----------------------------------------------------------------
export const flowsApi = {
  institutional: (symbol: string) => api.get<InstitutionalFlow[]>(`/flows/${symbol}/institutional`),
  insider:       (symbol: string) => api.get<InsiderTrade[]>(`/flows/${symbol}/insider`),
  political:     (symbol: string) => api.get<PoliticalTrade[]>(`/flows/${symbol}/political`),
  netPositioning:(symbol: string) => api.get<NetPositioning>(`/flows/${symbol}/net-positioning`),
  overview:      () => api.get<FlowsOverview>('/flows/overview'),
};

// ----------------------------------------------------------------
// SENTIMENT
// ----------------------------------------------------------------
export const sentimentApi = {
  get:      (symbol: string) => api.get<SentimentData>(`/sentiment/${symbol}`),
  news:     (symbol: string) => api.get<NewsArticle[]>(`/sentiment/${symbol}/news`),
  social:   (symbol: string) => api.get<SocialMentions>(`/sentiment/${symbol}/social`),
  velocity: (symbol: string) => api.get<SentimentVelocity>(`/sentiment/${symbol}/velocity`),
};

// ----------------------------------------------------------------
// MACRO
// ----------------------------------------------------------------
export const macroApi = {
  dashboard: () => api.get<MacroDashboard>('/macro/dashboard'),
  indicator: (id: string) => api.get<MacroIndicator>(`/macro/indicators/${id}`),
  calendar:  () => api.get<EconomicEvent[]>('/macro/calendar'),
};

// ----------------------------------------------------------------
// OPPORTUNITIES RANKER
// ----------------------------------------------------------------
export const opportunitiesApi = {
  top:    (limit = 10) => api.get<RankedOpportunity[]>('/opportunities/top', { params: { limit } }),
  ranked: (filters?: OpportunityFilters) => api.get<RankedOpportunity[]>('/opportunities/ranked', { params: filters }),
  early:  () => api.get<EarlyOpportunity[]>('/opportunities/early'),
};

// ----------------------------------------------------------------
// AI ANALYSIS
// ----------------------------------------------------------------
export const aiApi = {
  analyze: (symbol: string) => api.post<AIAnalysis>(`/ai/${symbol}/analyze`),
  report:  (symbol: string) => api.get<AIReport>(`/ai/${symbol}/report`),
};

// ----------------------------------------------------------------
// REPORTS (PDF)
// ----------------------------------------------------------------
export const reportsApi = {
  generate: (symbol: string) =>
    api.post(`/reports/${symbol}`, {}, { responseType: 'blob' }),
  list: () => api.get<ReportMeta[]>('/reports'),
  download: (id: string) =>
    api.get(`/reports/${id}/download`, { responseType: 'blob' }),
};

// ----------------------------------------------------------------
// SETTINGS
// ----------------------------------------------------------------
export const settingsApi = {
  get:  () => api.get<ApiSettings>('/settings'),
  save: (settings: Partial<ApiSettings>) => api.put<ApiSettings>('/settings', settings),
  test: (provider: string) => api.post<{ ok: boolean; latencyMs: number }>(`/settings/test/${provider}`),
};

// ----------------------------------------------------------------
// ADMIN
// ----------------------------------------------------------------
export const adminApi = {
  users:       () => api.get<User[]>('/admin/users'),
  approve:     (userId: string) => api.post(`/admin/users/${userId}/approve`),
  reject:      (userId: string) => api.post(`/admin/users/${userId}/reject`),
  metrics:     () => api.get<AdminMetrics>('/admin/metrics'),
};

// ----------------------------------------------------------------
// HEALTH
// ----------------------------------------------------------------
export const healthApi = {
  check: () => api.get<HealthStatus>('/health'),
};

export default api;

// ----------------------------------------------------------------
// TYPES
// ----------------------------------------------------------------
export interface User {
  id: string; email: string; name: string;
  role: 'USER' | 'ADMIN'; status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
}

export interface StockSearchResult { symbol: string; name: string; exchange: string; type: string; }
export interface StockDetail { symbol: string; name: string; sector: string; industry: string; description: string; marketCap: number; employees: number; ceo: string; website: string; }
export interface StockQuote { symbol: string; price: number; change: number; changePct: number; volume: number; avgVolume: number; high52: number; low52: number; marketCap: number; updatedAt: string; }
export interface OHLCVPoint { date: string; open: number; high: number; low: number; close: number; volume: number; }
export interface Technicals { rsi: number; macd: number; macdSignal: number; macdHist: number; ma20: number; ma50: number; ma200: number; priceVsMA200: number; volumeRatio: number; atr: number; }
export interface Fundamentals { peRatio: number; pbRatio: number; roe: number; roa: number; revenueGrowth: number; earningsGrowth: number; operatingMargin: number; netMargin: number; debtToEquity: number; currentRatio: number; fcfYield: number; }
export interface AnalystRatings { consensus: 'BUY' | 'HOLD' | 'SELL'; targetPrice: number; currentPrice: number; upside: number; totalAnalysts: number; strong_buy: number; buy: number; hold: number; sell: number; strong_sell: number; }

export interface ScoreResult {
  symbol: string; finalScore: number; confidenceFactor: number;
  fundamentalScore: number; technicalScore: number; sentimentScore: number;
  institutionalScore: number; analystScore: number; politicalScore: number; macroScore: number;
  rankingScore: number; anomalyScore: number; computedAt: string;
}

export interface RankedOpportunity {
  rank: number; symbol: string; name: string;
  rankingScore: number; finalScore: number; confidenceFactor: number; anomalyScore: number;
  signalType: string; earlyFlag: boolean;
  keyDrivers: string[]; price: number; changePct: number;
}

export interface AlphaSignal {
  id: string; signalType: string; strength: number; earlyFlag: boolean;
  volumeAnomaly: number; sentimentVelocity: number; insiderActivity: number; institutionalShift: number;
  detectedAt: string; expiresAt: string;
}

export interface EarlyOpportunity extends RankedOpportunity { signals: AlphaSignal[]; }
export interface AnomalyResult { symbol: string; anomalyScore: number; volumeAnomaly: number; sentimentVelocity: number; insiderActivity: number; institutionalShift: number; isEarlyOpportunity: boolean; }

export interface InstitutionalFlow { institution: string; sharesHeld: number; prevSharesHeld: number; changeShares: number; changePct: number; value: number; filedAt: string; }
export interface InsiderTrade { insider: string; role: string; type: 'BUY' | 'SELL'; shares: number; value: number; price: number; tradedAt: string; }
export interface PoliticalTrade { politician: string; party: string; chamber: string; type: 'BUY' | 'SELL'; amount: string; symbol: string; reportedAt: string; }
export interface NetPositioning { netInstitutional: number; netInsider: number; trend: 'ACCUMULATING' | 'DISTRIBUTING' | 'NEUTRAL'; }
export interface FlowsOverview { topAccumulating: string[]; topDistributing: string[]; totalInsiderBuys: number; totalInsiderSells: number; }

export interface SentimentData { symbol: string; overallScore: number; newsScore: number; socialScore: number; wikipediaViews: number; velocity: number; updatedAt: string; }
export interface NewsArticle { id: string; title: string; source: string; url: string; sentiment: number; publishedAt: string; }
export interface SocialMentions { reddit: number; bluesky: number; total: number; change24h: number; }
export interface SentimentVelocity { current: number; previous: number; velocity: number; isSpike: boolean; }

export interface MacroDashboard { fedRate: number; inflation: number; gdpGrowth: number; unemployment: number; yieldCurve: number; vix: number; dxy: number; updatedAt: string; }
export interface MacroIndicator { id: string; name: string; value: number; previousValue: number; change: number; unit: string; frequency: string; updatedAt: string; series: { date: string; value: number }[]; }
export interface EconomicEvent { date: string; time: string; event: string; importance: 'HIGH' | 'MEDIUM' | 'LOW'; forecast: string; previous: string; actual?: string; }

export interface AIAnalysis { bullish: AIArgument; bearish: AIArgument; neutral: AIArgument; recommendation: 'BUY' | 'HOLD' | 'SELL'; confidence: number; outlook: string; generatedAt: string; }
export interface AIArgument { stance: string; summary: string; arguments: string[]; targetPrice: number; confidence: number; }
export interface AIReport { symbol: string; companyDescription: string; revenueStreams: string[]; competitiveAdvantage: string; risks: string[]; analysis: AIAnalysis; generatedAt: string; }

export interface OpportunityFilters { minScore?: number; maxScore?: number; signalType?: string; earlyOnly?: boolean; sector?: string; limit?: number; }
export interface ApiSettings { fmp: string; finnhub: string; polygon: string; alphaVantage: string; newsApi: string; fred: string; reddit: string; bluesky: string; gdeltEnabled: boolean; }
export interface ReportMeta { id: string; symbol: string; createdAt: string; filePath: string; }
export interface AdminMetrics { totalUsers: number; pendingUsers: number; approvedUsers: number; totalScoresComputed: number; totalSignalsDetected: number; apiCallsToday: number; }
export interface HealthStatus { status: string; timestamp: string; database: { status: string; latencyMs: number }; uptime: number; }
