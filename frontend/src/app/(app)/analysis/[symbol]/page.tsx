'use client';

import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import AppShell from '@/components/layout/AppShell';
import api from '@/lib/api';
import { useState } from 'react';
import {
  TrendingUp, TrendingDown, Minus, Zap, Activity, BarChart2,
  Brain, AlertTriangle, CheckCircle2, Info, ChevronDown, ChevronUp,
  ArrowLeft, Star, Download, RefreshCw,
} from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis,
  Tooltip, CartesianGrid, ReferenceLine, BarChart, Bar,
} from 'recharts';
import { cn, fmt, fmtPct, timeAgo } from '@/lib/utils';

// ─── helpers ────────────────────────────────────────────────────────────────

const scoreColor = (s: number) =>
  s >= 7.5 ? 'text-success' : s >= 5 ? 'text-warning' : 'text-danger';

const scoreBg = (s: number) =>
  s >= 7.5 ? 'bg-success/10 border-success/30' : s >= 5 ? 'bg-warning/10 border-warning/30' : 'bg-danger/10 border-danger/30';

const changeColor = (v: number) =>
  v > 0 ? 'text-success' : v < 0 ? 'text-danger' : 'text-muted';

const SignalBadge = ({ type }: { type: string }) => {
  const map: Record<string, { label: string; cls: string }> = {
    SMART_MONEY_ENTRY:  { label: '🧠 Smart Money',   cls: 'badge-primary' },
    ACCUMULATION:       { label: '📦 Accumulation',   cls: 'badge-success' },
    SENTIMENT_PUMP:     { label: '📣 Sentiment Pump', cls: 'badge-warning' },
    MOMENTUM_IGNITION:  { label: '🚀 Momentum',       cls: 'badge-primary' },
    RISK_WARNING:       { label: '⚠️ Risk Warning',   cls: 'badge-danger'  },
    NEUTRAL:            { label: '⚪ Neutral',         cls: 'badge-muted'   },
  };
  const m = map[type] ?? map.NEUTRAL;
  return <span className={cn('badge text-[10px] font-semibold', m.cls)}>{m.label}</span>;
};

const ScoreBar = ({ label, value, max = 10 }: { label: string; value: number; max?: number }) => (
  <div className="flex items-center gap-3">
    <span className="text-xs text-muted w-28 shrink-0">{label}</span>
    <div className="flex-1 h-1.5 bg-surface-2 rounded-full overflow-hidden">
      <div
        className={cn('h-full rounded-full transition-all', value / max >= 0.75 ? 'bg-success' : value / max >= 0.5 ? 'bg-warning' : 'bg-danger')}
        style={{ width: `${(value / max) * 100}%` }}
      />
    </div>
    <span className={cn('text-xs font-semibold w-8 text-right tabular-nums', scoreColor(value))}>{value.toFixed(1)}</span>
  </div>
);

// ─── sub-sections ────────────────────────────────────────────────────────────

function QuoteHeader({ quote, symbol }: { quote: any; symbol: string }) {
  const change = quote?.change ?? 0;
  const pct    = quote?.changesPercentage ?? 0;
  return (
    <div className="flex flex-wrap items-end gap-4">
      <div>
        <p className="text-3xl font-bold text-text tabular-nums">${fmt(quote?.price ?? 0)}</p>
        <p className={cn('flex items-center gap-1 text-sm font-medium mt-0.5', changeColor(change))}>
          {change > 0 ? <TrendingUp className="w-3.5 h-3.5" /> : change < 0 ? <TrendingDown className="w-3.5 h-3.5" /> : <Minus className="w-3.5 h-3.5" />}
          {change > 0 ? '+' : ''}{fmt(change)} ({pct > 0 ? '+' : ''}{fmtPct(pct / 100)}) today
        </p>
      </div>
      <div className="flex gap-4 text-xs text-muted ml-auto flex-wrap">
        {[
          ['Open',    quote?.open],
          ['High',    quote?.dayHigh],
          ['Low',     quote?.dayLow],
          ['52W H',   quote?.yearHigh],
          ['52W L',   quote?.yearLow],
          ['Vol',     quote?.volume ? (quote.volume / 1e6).toFixed(1) + 'M' : '—'],
          ['Mkt Cap', quote?.marketCap ? '$' + (quote.marketCap / 1e9).toFixed(1) + 'B' : '—'],
        ].map(([k, v]) => (
          <div key={k as string} className="text-center">
            <p className="text-[10px] uppercase tracking-wider text-faint">{k}</p>
            <p className="text-xs font-medium text-text tabular-nums">{v ?? '—'}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function PriceChart({ history }: { history: any[] }) {
  const data = (history ?? []).map((d: any) => ({
    date:  d.date,
    close: d.close,
    vol:   d.volume,
  }));
  const min  = Math.min(...data.map(d => d.close)) * 0.98;
  const max  = Math.max(...data.map(d => d.close)) * 1.02;
  const last = data[data.length - 1]?.close ?? 0;
  const first = data[0]?.close ?? last;
  const up    = last >= first;

  return (
    <div className="card p-4">
      <h3 className="text-xs font-semibold text-text mb-3">Price History (6 months)</h3>
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={up ? 'var(--color-success)' : 'var(--color-danger)'} stopOpacity={0.25} />
              <stop offset="95%" stopColor={up ? 'var(--color-success)' : 'var(--color-danger)'} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" strokeOpacity={0.4} />
          <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--color-muted)' }} tickLine={false} axisLine={false}
            tickFormatter={(v) => v?.slice(5)} interval={Math.floor(data.length / 6)} />
          <YAxis domain={[min, max]} tick={{ fontSize: 10, fill: 'var(--color-muted)' }} tickLine={false} axisLine={false}
            tickFormatter={(v) => '$' + v.toFixed(0)} width={52} />
          <Tooltip
            contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: 12 }}
            labelStyle={{ color: 'var(--color-muted)' }}
            formatter={(v: any) => ['$' + fmt(v), 'Close']}
          />
          <Area type="monotone" dataKey="close" stroke={up ? 'var(--color-success)' : 'var(--color-danger)'}
            strokeWidth={1.5} fill="url(#priceGrad)" dot={false} />
        </AreaChart>
      </ResponsiveContainer>

      {/* Volume bars */}
      <div className="mt-2">
        <ResponsiveContainer width="100%" height={48}>
          <BarChart data={data} margin={{ top: 0, right: 4, bottom: 0, left: 0 }}>
            <Bar dataKey="vol" fill="var(--color-primary)" opacity={0.4} radius={[1,1,0,0]} />
            <XAxis hide /><YAxis hide />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function TechnicalPanel({ tech }: { tech: any }) {
  if (!tech) return null;
  const indicators = [
    { label: 'RSI (14)',     value: tech.rsi?.toFixed(1) ?? '—',   signal: tech.rsi < 30 ? 'Oversold' : tech.rsi > 70 ? 'Overbought' : 'Neutral', bullish: tech.rsi < 40 },
    { label: 'MACD Signal',  value: tech.macdSignal ?? '—',        signal: tech.macdSignal === 'bullish' ? 'Bullish Cross' : tech.macdSignal === 'bearish' ? 'Bearish Cross' : 'Neutral', bullish: tech.macdSignal === 'bullish' },
    { label: 'MA 20',        value: '$' + fmt(tech.ma20 ?? 0),     signal: tech.price > tech.ma20 ? 'Above' : 'Below', bullish: tech.price > tech.ma20 },
    { label: 'MA 50',        value: '$' + fmt(tech.ma50 ?? 0),     signal: tech.price > tech.ma50 ? 'Above' : 'Below', bullish: tech.price > tech.ma50 },
    { label: 'MA 200',       value: '$' + fmt(tech.ma200 ?? 0),    signal: tech.price > tech.ma200 ? 'Above' : 'Below', bullish: tech.price > tech.ma200 },
    { label: 'Vol vs 30d',   value: tech.volumeRatio?.toFixed(2) + 'x' ?? '—', signal: tech.volumeRatio > 1.5 ? 'Spike' : tech.volumeRatio > 1 ? 'Above avg' : 'Below avg', bullish: tech.volumeRatio > 1 },
  ];
  return (
    <div className="card p-4 space-y-2">
      <h3 className="text-xs font-semibold text-text mb-3 flex items-center gap-2">
        <BarChart2 className="w-4 h-4 text-primary" /> Technical Indicators
      </h3>
      {indicators.map(ind => (
        <div key={ind.label} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
          <span className="text-xs text-muted">{ind.label}</span>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-medium text-text">{ind.value}</span>
            <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-medium', ind.bullish ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger')}>
              {ind.signal}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

function FundamentalsPanel({ fund }: { fund: any }) {
  if (!fund) return null;
  const rows = [
    ['P/E Ratio',         fund.peRatioTTM?.toFixed(2) ?? '—'],
    ['EPS (TTM)',         fund.epsTTM ? '$' + fmt(fund.epsTTM) : '—'],
    ['Revenue Growth',   fund.revenueGrowth ? fmtPct(fund.revenueGrowth) : '—'],
    ['Gross Margin',     fund.grossProfitMargin ? fmtPct(fund.grossProfitMargin) : '—'],
    ['Operating Margin', fund.operatingProfitMargin ? fmtPct(fund.operatingProfitMargin) : '—'],
    ['Net Margin',       fund.netProfitMargin ? fmtPct(fund.netProfitMargin) : '—'],
    ['ROE',              fund.returnOnEquity ? fmtPct(fund.returnOnEquity) : '—'],
    ['ROA',              fund.returnOnAssets ? fmtPct(fund.returnOnAssets) : '—'],
    ['Debt/Equity',      fund.debtEquityRatio?.toFixed(2) ?? '—'],
    ['Current Ratio',    fund.currentRatio?.toFixed(2) ?? '—'],
    ['Beta',             fund.beta?.toFixed(2) ?? '—'],
    ['Dividend Yield',   fund.dividendYield ? fmtPct(fund.dividendYield) : 'N/A'],
  ];
  return (
    <div className="card p-4">
      <h3 className="text-xs font-semibold text-text mb-3 flex items-center gap-2">
        <Activity className="w-4 h-4 text-primary" /> Fundamentals
      </h3>
      <div className="grid grid-cols-2 gap-x-4">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between items-center py-1.5 border-b border-border last:border-0 col-span-1">
            <span className="text-xs text-muted">{k}</span>
            <span className="text-xs font-mono font-medium text-text tabular-nums">{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function AnalystPanel({ analyst }: { analyst: any }) {
  if (!analyst) return null;
  const cons = analyst.consensus ?? 'N/A';
  const consColor = cons === 'Buy' || cons === 'Strong Buy' ? 'text-success bg-success/10' : cons === 'Sell' || cons === 'Strong Sell' ? 'text-danger bg-danger/10' : 'text-warning bg-warning/10';
  const upside = analyst.targetPrice && analyst.currentPrice
    ? ((analyst.targetPrice - analyst.currentPrice) / analyst.currentPrice) * 100 : null;
  return (
    <div className="card p-4">
      <h3 className="text-xs font-semibold text-text mb-3 flex items-center gap-2">
        <Star className="w-4 h-4 text-primary" /> Analyst Ratings
      </h3>
      <div className="flex items-center gap-4 mb-4">
        <div className={cn('px-3 py-1.5 rounded-lg text-sm font-bold', consColor)}>{cons}</div>
        {analyst.targetPrice && (
          <div>
            <p className="text-[10px] text-faint uppercase tracking-wider">Price Target</p>
            <p className="text-sm font-semibold text-text">${fmt(analyst.targetPrice)}</p>
          </div>
        )}
        {upside !== null && (
          <div>
            <p className="text-[10px] text-faint uppercase tracking-wider">Upside</p>
            <p className={cn('text-sm font-semibold', upside > 0 ? 'text-success' : 'text-danger')}>
              {upside > 0 ? '+' : ''}{upside.toFixed(1)}%
            </p>
          </div>
        )}
      </div>
      {analyst.ratings && (
        <div className="space-y-1.5">
          {[
            { label: 'Strong Buy', value: analyst.ratings.strongBuy  ?? 0, color: 'bg-success' },
            { label: 'Buy',        value: analyst.ratings.buy        ?? 0, color: 'bg-success/60' },
            { label: 'Hold',       value: analyst.ratings.hold       ?? 0, color: 'bg-warning' },
            { label: 'Sell',       value: analyst.ratings.sell       ?? 0, color: 'bg-danger/60' },
            { label: 'Strong Sell',value: analyst.ratings.strongSell ?? 0, color: 'bg-danger' },
          ].map(r => {
            const total = (analyst.ratings.strongBuy ?? 0) + (analyst.ratings.buy ?? 0) + (analyst.ratings.hold ?? 0) + (analyst.ratings.sell ?? 0) + (analyst.ratings.strongSell ?? 0);
            const pct   = total > 0 ? (r.value / total) * 100 : 0;
            return (
              <div key={r.label} className="flex items-center gap-2">
                <span className="text-[10px] text-muted w-20">{r.label}</span>
                <div className="flex-1 h-1.5 bg-surface-2 rounded-full overflow-hidden">
                  <div className={cn('h-full rounded-full', r.color)} style={{ width: `${pct}%` }} />
                </div>
                <span className="text-[10px] text-faint w-6 text-right">{r.value}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AlphaPanel({ alpha }: { alpha: any }) {
  if (!alpha) return null;
  return (
    <div className={cn('card p-4 border', alpha.earlyFlag ? 'border-primary/40 bg-primary/5' : 'border-border')}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-text flex items-center gap-2">
          <Zap className="w-4 h-4 text-primary" /> Alpha Engine
        </h3>
        {alpha.earlyFlag && (
          <span className="badge badge-primary text-[10px] font-bold animate-pulse">⚡ EARLY OPPORTUNITY</span>
        )}
      </div>

      {/* Anomaly score */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative w-16 h-16">
          <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
            <circle cx="32" cy="32" r="28" fill="none" stroke="var(--color-border)" strokeWidth="6" />
            <circle cx="32" cy="32" r="28" fill="none"
              stroke={alpha.anomalyScore > 0.6 ? 'var(--color-danger)' : alpha.anomalyScore > 0.35 ? 'var(--color-warning)' : 'var(--color-primary)'}
              strokeWidth="6" strokeLinecap="round"
              strokeDasharray={`${(alpha.anomalyScore ?? 0) * 175.9} 175.9`} />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-text">
            {((alpha.anomalyScore ?? 0) * 100).toFixed(0)}%
          </span>
        </div>
        <div>
          <p className="text-[10px] text-faint uppercase tracking-wider">Anomaly Score</p>
          <SignalBadge type={alpha.signalType ?? 'NEUTRAL'} />
          {alpha.detectedAt && <p className="text-[10px] text-faint mt-1">{timeAgo(alpha.detectedAt)}</p>}
        </div>
      </div>

      {/* Drivers */}
      {alpha.drivers?.length > 0 && (
        <div>
          <p className="text-[10px] text-faint uppercase tracking-wider mb-1.5">Key Drivers</p>
          <div className="flex flex-wrap gap-1.5">
            {alpha.drivers.map((d: string) => (
              <span key={d} className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">{d}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ScoringPanel({ score }: { score: any }) {
  if (!score) return null;
  return (
    <div className={cn('card p-4 border', scoreBg(score.finalScore ?? 0))}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-semibold text-text flex items-center gap-2">
          <BarChart2 className="w-4 h-4 text-primary" /> Composite Score
        </h3>
        <div className="text-right">
          <p className={cn('text-2xl font-bold tabular-nums', scoreColor(score.finalScore ?? 0))}>
            {(score.finalScore ?? 0).toFixed(1)}
            <span className="text-xs text-muted font-normal"> /10</span>
          </p>
          <p className="text-[10px] text-faint">confidence {((score.confidenceFactor ?? 1) * 100).toFixed(0)}%</p>
        </div>
      </div>
      <div className="space-y-2">
        <ScoreBar label="Fundamental"   value={score.fundamentalScore   ?? 0} />
        <ScoreBar label="Technical"     value={score.technicalScore     ?? 0} />
        <ScoreBar label="Sentiment"     value={score.sentimentScore     ?? 0} />
        <ScoreBar label="Institutional" value={score.institutionalScore ?? 0} />
        <ScoreBar label="Analyst"       value={score.analystScore       ?? 0} />
        <ScoreBar label="Political"     value={score.politicalScore     ?? 0} />
        <ScoreBar label="Macro"         value={score.macroScore         ?? 0} />
      </div>
      {score.rankingScore && (
        <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
          <span className="text-xs text-muted">Ranking Score</span>
          <span className="text-sm font-bold text-primary tabular-nums">{score.rankingScore.toFixed(2)}</span>
        </div>
      )}
    </div>
  );
}

function AIAnalysisPanel({ ai }: { ai: any }) {
  const [open, setOpen] = useState<string | null>('bullish');
  if (!ai) return null;
  const analysts = [
    { key: 'bullish',  label: '🟢 Bullish Analyst', data: ai.bullish,  color: 'border-success/40 bg-success/5' },
    { key: 'bearish',  label: '🔴 Bearish Analyst',  data: ai.bearish,  color: 'border-danger/40 bg-danger/5' },
    { key: 'neutral',  label: '⚪ Neutral Analyst',  data: ai.neutral,  color: 'border-border bg-surface-2' },
  ];
  return (
    <div className="card p-4 space-y-2">
      <h3 className="text-xs font-semibold text-text mb-3 flex items-center gap-2">
        <Brain className="w-4 h-4 text-primary" /> AI Multi-Agent Analysis
      </h3>
      {analysts.map(a => (
        <div key={a.key} className={cn('rounded-lg border overflow-hidden', a.color)}>
          <button className="w-full flex items-center justify-between px-3 py-2.5"
            onClick={() => setOpen(open === a.key ? null : a.key)}>
            <span className="text-xs font-semibold text-text">{a.label}</span>
            <div className="flex items-center gap-2">
              {a.data?.recommendation && (
                <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded',
                  a.data.recommendation === 'BUY' ? 'bg-success/20 text-success' :
                  a.data.recommendation === 'SELL' ? 'bg-danger/20 text-danger' : 'bg-muted/20 text-muted')}>
                  {a.data.recommendation}
                </span>
              )}
              {open === a.key ? <ChevronUp className="w-3.5 h-3.5 text-muted" /> : <ChevronDown className="w-3.5 h-3.5 text-muted" />}
            </div>
          </button>
          {open === a.key && a.data && (
            <div className="px-3 pb-3 space-y-2 border-t border-border/50">
              {a.data.thesis && <p className="text-xs text-text leading-relaxed mt-2">{a.data.thesis}</p>}
              {a.data.keyPoints?.length > 0 && (
                <ul className="space-y-1 mt-2">
                  {a.data.keyPoints.map((pt: string, i: number) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-muted">
                      <span className="text-primary mt-0.5">•</span>{pt}
                    </li>
                  ))}
                </ul>
              )}
              {a.data.confidence !== undefined && (
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-[10px] text-faint">Confidence</span>
                  <div className="flex-1 h-1 bg-surface rounded-full">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${a.data.confidence * 100}%` }} />
                  </div>
                  <span className="text-[10px] text-muted">{(a.data.confidence * 100).toFixed(0)}%</span>
                </div>
              )}
              {a.data.outlook && (
                <p className="text-[10px] text-faint italic mt-1">{a.data.outlook}</p>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function NewsPanel({ news }: { news: any[] }) {
  return (
    <div className="card p-4">
      <h3 className="text-xs font-semibold text-text mb-3 flex items-center gap-2">
        <Info className="w-4 h-4 text-primary" /> Recent News
      </h3>
      {!news?.length ? (
        <p className="text-xs text-muted py-4 text-center">No recent news</p>
      ) : (
        <div className="space-y-3">
          {news.slice(0, 8).map((n: any, i: number) => (
            <a key={i} href={n.url} target="_blank" rel="noopener noreferrer"
              className="block group">
              <div className="flex items-start gap-2">
                <div className={cn('mt-1.5 w-1.5 h-1.5 rounded-full shrink-0',
                  n.sentiment === 'positive' ? 'bg-success' : n.sentiment === 'negative' ? 'bg-danger' : 'bg-muted')} />
                <div>
                  <p className="text-xs text-text group-hover:text-primary transition-colors leading-relaxed">{n.title}</p>
                  <p className="text-[10px] text-faint mt-0.5">{n.source} · {n.publishedAt ? timeAgo(n.publishedAt) : ''}</p>
                </div>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── main page ───────────────────────────────────────────────────────────────

export default function AnalysisPage() {
  const { symbol } = useParams<{ symbol: string }>();
  const sym        = symbol?.toUpperCase() ?? '';
  const router     = useRouter();
  const [tab, setTab] = useState<'overview' | 'technical' | 'flows' | 'ai'>('overview');

  // Queries
  const { data: quote }    = useQuery({ queryKey: ['quote', sym],    queryFn: () => api.get(`/stocks/${sym}/quote`).then(r => r.data),        enabled: !!sym, staleTime: 60_000 });
  const { data: stock }    = useQuery({ queryKey: ['stock', sym],    queryFn: () => api.get(`/stocks/${sym}`).then(r => r.data),              enabled: !!sym, staleTime: 300_000 });
  const { data: fund }     = useQuery({ queryKey: ['fund', sym],     queryFn: () => api.get(`/stocks/${sym}/fundamentals`).then(r => r.data), enabled: !!sym, staleTime: 3_600_000 });
  const { data: tech }     = useQuery({ queryKey: ['tech', sym],     queryFn: () => api.get(`/stocks/${sym}/technicals`).then(r => r.data),   enabled: !!sym, staleTime: 300_000 });
  const { data: analyst }  = useQuery({ queryKey: ['analyst', sym],  queryFn: () => api.get(`/stocks/${sym}/analyst`).then(r => r.data),      enabled: !!sym, staleTime: 3_600_000 });
  const { data: history }  = useQuery({ queryKey: ['hist', sym],     queryFn: () => api.get(`/stocks/${sym}/history`).then(r => r.data),      enabled: !!sym, staleTime: 300_000 });
  const { data: alpha }    = useQuery({ queryKey: ['alpha', sym],    queryFn: () => api.get(`/alpha/anomaly/${sym}`).then(r => r.data),       enabled: !!sym, staleTime: 300_000 });
  const { data: score }    = useQuery({ queryKey: ['score', sym],    queryFn: () => stock?.id ? api.get(`/scoring/stock/${stock.id}`).then(r => r.data) : null, enabled: !!stock?.id, staleTime: 600_000 });
  const { data: flows }    = useQuery({ queryKey: ['flows', sym],    queryFn: () => api.get(`/flows/${sym}/summary`).then(r => r.data),       enabled: !!sym && tab === 'flows', staleTime: 300_000 });
  const { data: insider }  = useQuery({ queryKey: ['insider', sym],  queryFn: () => api.get(`/flows/${sym}/insider`).then(r => r.data),       enabled: !!sym && tab === 'flows', staleTime: 300_000 });
  const { data: political }= useQuery({ queryKey: ['pol', sym],      queryFn: () => api.get(`/flows/${sym}/political`).then(r => r.data),     enabled: !!sym && tab === 'flows', staleTime: 3_600_000 });
  const { data: ai }       = useQuery({ queryKey: ['ai', sym],       queryFn: () => api.get(`/ai/analyze/${sym}`).then(r => r.data),          enabled: !!sym && tab === 'ai',   staleTime: 1_800_000 });
  const { data: sentiment }= useQuery({ queryKey: ['sent', sym],     queryFn: () => api.get(`/sentiment/${sym}`).then(r => r.data),           enabled: !!sym, staleTime: 600_000 });

  const TABS = [
    { key: 'overview',  label: 'Overview'   },
    { key: 'technical', label: 'Technical'  },
    { key: 'flows',     label: 'Flows'      },
    { key: 'ai',        label: 'AI Analysis'},
  ] as const;

  return (
    <AppShell title={sym}>
      {/* Back + header */}
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => router.back()} className="btn-ghost h-8 w-8 p-0 flex items-center justify-center">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-lg font-bold text-text">{sym}</h1>
            {stock?.name && <span className="text-sm text-muted">{stock.name}</span>}
            {stock?.sector && <span className="badge badge-muted text-[10px]">{stock.sector}</span>}
            {alpha?.earlyFlag && <span className="badge badge-primary text-[10px] animate-pulse">⚡ Early Opportunity</span>}
          </div>
        </div>
        <a href={`/reports?prefill=${sym}`} className="btn-ghost h-8 flex items-center gap-1.5 text-xs">
          <Download className="w-3.5 h-3.5" /> PDF Report
        </a>
      </div>

      {/* Quote header */}
      {quote && <div className="card p-4 mb-4"><QuoteHeader quote={quote} symbol={sym} /></div>}

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b border-border">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={cn('px-4 py-2 text-xs font-medium transition-colors border-b-2 -mb-px',
              tab === t.key ? 'border-primary text-primary' : 'border-transparent text-muted hover:text-text')}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Left: chart + score + alpha */}
          <div className="lg:col-span-2 space-y-4">
            <PriceChart history={history ?? []} />
            <ScoringPanel score={score} />
            <AlphaPanel alpha={alpha} />
          </div>
          {/* Right: fundamentals + analyst + news */}
          <div className="space-y-4">
            <FundamentalsPanel fund={fund} />
            <AnalystPanel analyst={analyst} />
            {sentiment?.news && <NewsPanel news={sentiment.news} />}
          </div>
        </div>
      )}

      {tab === 'technical' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <TechnicalPanel tech={tech} />
          <div className="space-y-4">
            <PriceChart history={history ?? []} />
            {score && (
              <div className="card p-4 space-y-2">
                <h3 className="text-xs font-semibold text-text mb-3">Technical Score Breakdown</h3>
                <ScoreBar label="Technical" value={score.technicalScore ?? 0} />
                <ScoreBar label="Momentum"  value={score.rankingScore  ?? 0} max={12} />
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'flows' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Insider trades */}
          <div className="card p-4">
            <h3 className="text-xs font-semibold text-text mb-3 flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" /> Insider Trades
            </h3>
            {!insider?.length ? (
              <p className="text-xs text-muted py-6 text-center">No recent insider activity</p>
            ) : (
              <div className="space-y-2">
                {insider.slice(0, 10).map((t: any, i: number) => (
                  <div key={i} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                    <div>
                      <p className="text-xs font-medium text-text">{t.insiderName}</p>
                      <p className="text-[10px] text-muted">{t.position} · {t.transactionDate}</p>
                    </div>
                    <div className="text-right">
                      <p className={cn('text-xs font-semibold', t.transactionType?.toLowerCase() === 'buy' ? 'text-success' : 'text-danger')}>
                        {t.transactionType?.toUpperCase()}
                      </p>
                      <p className="text-[10px] text-muted tabular-nums">${fmt(t.value ?? t.securitiesTransacted * t.price)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Institutional */}
          <div className="card p-4">
            <h3 className="text-xs font-semibold text-text mb-3 flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-primary" /> Institutional Holdings
            </h3>
            {!flows?.institutional?.length ? (
              <p className="text-xs text-muted py-6 text-center">No institutional data</p>
            ) : (
              <div className="space-y-2">
                {flows.institutional.slice(0, 8).map((h: any, i: number) => (
                  <div key={i} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                    <p className="text-xs text-text truncate max-w-[160px]">{h.holder}</p>
                    <div className="text-right">
                      <p className="text-xs font-mono text-text">{fmt(h.shares)}</p>
                      <p className={cn('text-[10px]', (h.change ?? 0) > 0 ? 'text-success' : 'text-danger')}>
                        {(h.change ?? 0) > 0 ? '▲' : '▼'} {Math.abs(h.changePercent ?? 0).toFixed(1)}%
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Political */}
          <div className="card p-4 lg:col-span-2">
            <h3 className="text-xs font-semibold text-text mb-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-warning" /> Political Signals
            </h3>
            {!political?.length ? (
              <p className="text-xs text-muted py-6 text-center">No political activity found for {sym}</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {political.slice(0, 6).map((p: any, i: number) => (
                  <div key={i} className="p-3 rounded-lg bg-surface-2 border border-border">
                    <p className="text-xs font-medium text-text">{p.name}</p>
                    <p className="text-[10px] text-muted mt-0.5">{p.type} · {p.date}</p>
                    {p.amount && <p className="text-[10px] text-primary mt-1">${fmt(p.amount)}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'ai' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <AIAnalysisPanel ai={ai} />
          </div>
          <div className="space-y-4">
            <ScoringPanel score={score} />
            <AlphaPanel alpha={alpha} />
          </div>
        </div>
      )}
    </AppShell>
  );
}
