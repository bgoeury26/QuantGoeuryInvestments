'use client';

import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import AppShell from '@/components/layout/AppShell';
import api from '@/lib/api';
import { useState } from 'react';
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, CartesianGrid,
} from 'recharts';
import {
  TrendingUp, TrendingDown, Zap, Activity, BarChart2, Brain,
  AlertTriangle, CheckCircle2, Minus, ChevronLeft, Star, Download,
  Users, Shield, Globe, RefreshCw,
} from 'lucide-react';
import { cn, fmt, fmtPct, timeAgo } from '@/lib/utils';

// ─── Sub-components ────────────────────────────────────────────────────────────

function ScoreBadge({ score, size = 'md' }: { score: number; size?: 'sm' | 'md' | 'lg' }) {
  const color =
    score >= 7 ? 'text-success bg-success/10 border-success/20' :
    score >= 5 ? 'text-warning bg-warning/10 border-warning/20' :
                 'text-danger  bg-danger/10  border-danger/20';
  const sz = size === 'lg' ? 'text-3xl font-bold px-4 py-2' : size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm font-semibold px-3 py-1';
  return (
    <span className={cn('rounded-lg border font-mono tabular-nums', color, sz)}>
      {score.toFixed(1)}
    </span>
  );
}

function StatCard({ label, value, sub, color = '' }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="card p-4 space-y-1">
      <p className="text-xs text-muted">{label}</p>
      <p className={cn('text-lg font-semibold tabular-nums', color)}>{value}</p>
      {sub && <p className="text-xs text-muted">{sub}</p>}
    </div>
  );
}

function SignalBadge({ type }: { type: string }) {
  const map: Record<string, string> = {
    SMART_MONEY_ENTRY:  'bg-purple/10  text-purple  border-purple/20',
    ACCUMULATION:       'bg-cyan/10    text-cyan     border-cyan/20',
    SENTIMENT_PUMP:     'bg-warning/10 text-warning  border-warning/20',
    MOMENTUM_IGNITION:  'bg-success/10 text-success  border-success/20',
    RISK_WARNING:       'bg-danger/10  text-danger   border-danger/20',
    NEUTRAL:            'bg-border     text-muted    border-border',
  };
  return (
    <span className={cn('text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded border', map[type] ?? map.NEUTRAL)}>
      {type.replace(/_/g, ' ')}
    </span>
  );
}

function AiAnalystCard({ stance, data }: { stance: 'bullish' | 'bearish' | 'neutral'; data: any }) {
  const cfg = {
    bullish: { icon: TrendingUp,   color: 'text-success', bg: 'bg-success/5 border-success/20', label: 'Bullish Analyst' },
    bearish: { icon: TrendingDown, color: 'text-danger',  bg: 'bg-danger/5  border-danger/20',  label: 'Bearish Analyst' },
    neutral: { icon: Minus,        color: 'text-muted',   bg: 'bg-surface-2 border-border',      label: 'Neutral Analyst' },
  }[stance];
  const Icon = cfg.icon;
  return (
    <div className={cn('rounded-xl border p-4 space-y-3', cfg.bg)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className={cn('w-4 h-4', cfg.color)} />
          <span className={cn('text-xs font-semibold', cfg.color)}>{cfg.label}</span>
        </div>
        {data?.confidence != null && (
          <span className="text-xs text-muted font-mono">conf {(data.confidence * 100).toFixed(0)}%</span>
        )}
      </div>
      {data?.recommendation && (
        <p className="text-xs font-semibold text-text">{data.recommendation}</p>
      )}
      {data?.rationale && (
        <p className="text-xs text-muted leading-relaxed">{data.rationale}</p>
      )}
      {data?.keyPoints?.length > 0 && (
        <ul className="space-y-1">
          {data.keyPoints.map((pt: string, i: number) => (
            <li key={i} className="text-xs text-muted flex gap-1.5">
              <span className={cn('mt-0.5 shrink-0', cfg.color)}>•</span>
              {pt}
            </li>
          ))}
        </ul>
      )}
      {data?.outlook && (
        <div className="pt-2 border-t border-current/10">
          <p className="text-[10px] text-muted uppercase tracking-wider mb-1">Probabilistic Outlook</p>
          <p className="text-xs text-text">{data.outlook}</p>
        </div>
      )}
    </div>
  );
}

// ─── Custom chart tooltip ───────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-surface-3 border border-border rounded-lg px-3 py-2 text-xs shadow-lg">
      <p className="text-muted mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color }} className="font-mono">
          {p.name}: {typeof p.value === 'number' ? p.value.toLocaleString() : p.value}
        </p>
      ))}
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────────

const TABS = ['Overview', 'Technicals', 'Fundamentals', 'Flows', 'AI Analysis', 'Signals'] as const;
type Tab = typeof TABS[number];

export default function AnalysisPage() {
  const { symbol } = useParams<{ symbol: string }>();
  const router = useRouter();
  const sym = symbol.toUpperCase();
  const [tab, setTab] = useState<Tab>('Overview');
  const [exporting, setExporting] = useState(false);

  // ── Data fetches ──
  const { data: stock }        = useQuery({ queryKey: ['stock', sym],        queryFn: () => api.get(`/stocks/${sym}`).then(r => r.data) });
  const { data: quote }        = useQuery({ queryKey: ['quote', sym],        queryFn: () => api.get(`/stocks/${sym}/quote`).then(r => r.data), refetchInterval: 30000 });
  const { data: fundamentals } = useQuery({ queryKey: ['fundamentals', sym], queryFn: () => api.get(`/stocks/${sym}/fundamentals`).then(r => r.data) });
  const { data: technicals }   = useQuery({ queryKey: ['technicals', sym],   queryFn: () => api.get(`/stocks/${sym}/technicals`).then(r => r.data) });
  const { data: analyst }      = useQuery({ queryKey: ['analyst', sym],      queryFn: () => api.get(`/stocks/${sym}/analyst`).then(r => r.data) });
  const { data: history }      = useQuery({ queryKey: ['history', sym],      queryFn: () => api.get(`/stocks/${sym}/history`).then(r => r.data) });
  const { data: scoreData }    = useQuery({ queryKey: ['score', sym],        queryFn: () => api.get(`/alpha/anomaly/${sym}`).then(r => r.data) });
  const { data: flows }        = useQuery({ queryKey: ['flows-summary', sym], queryFn: () => api.get(`/flows/${sym}/summary`).then(r => r.data) });
  const { data: insider }      = useQuery({ queryKey: ['insider', sym],      queryFn: () => api.get(`/flows/${sym}/insider`).then(r => r.data) });
  const { data: aiData }       = useQuery({ queryKey: ['ai', sym],           queryFn: () => api.get(`/ai/analyze/${sym}`).then(r => r.data) });
  const { data: signals }      = useQuery({ queryKey: ['signals', sym],      queryFn: () => api.get(`/alpha/signals/${stock?.id ?? ''}`).then(r => r.data), enabled: !!stock?.id });

  // ── Derived ──
  const price     = quote?.price ?? stock?.lastPrice ?? 0;
  const change    = quote?.change ?? 0;
  const changePct = quote?.changePct ?? 0;
  const isUp      = change >= 0;

  const exportReport = async () => {
    setExporting(true);
    try {
      await api.post('/reports/generate', { symbol: sym });
      router.push('/reports');
    } finally {
      setExporting(false);
    }
  };

  return (
    <AppShell title={`${sym} — Analysis`}>
      {/* ── Header ── */}
      <div className="flex items-start justify-between mb-5 gap-4">
        <div className="flex items-start gap-3">
          <button onClick={() => router.back()} className="btn-ghost h-8 w-8 p-0 mt-0.5">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-text">{sym}</h1>
              {stock?.name && <p className="text-sm text-muted">{stock.name}</p>}
              {scoreData?.earlyFlag && (
                <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-warning bg-warning/10 border border-warning/30 px-2 py-0.5 rounded-full animate-pulse-slow">
                  <Zap className="w-3 h-3" /> Early Signal
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-2xl font-mono font-semibold text-text tabular-nums">${fmt(price)}</span>
              <span className={cn('flex items-center gap-1 text-sm font-medium', isUp ? 'text-success' : 'text-danger')}>
                {isUp ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                {isUp ? '+' : ''}{fmt(change)} ({fmtPct(changePct)})
              </span>
              {quote?.updatedAt && <span className="text-xs text-muted">{timeAgo(quote.updatedAt)}</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {scoreData?.anomalyScore != null && (
            <div className="card px-3 py-2 text-center">
              <p className="text-[10px] text-muted mb-0.5">Anomaly</p>
              <p className="text-sm font-bold font-mono text-warning tabular-nums">
                {(scoreData.anomalyScore * 10).toFixed(1)}
              </p>
            </div>
          )}
          <button onClick={exportReport} disabled={exporting}
            className="btn-primary h-9 flex items-center gap-2">
            {exporting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            Export PDF
          </button>
        </div>
      </div>

      {/* ── Score bar ── */}
      {scoreData && (
        <div className="card p-4 mb-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Final Score', value: scoreData.finalScore ?? 0, icon: Star },
            { label: 'Confidence',  value: (scoreData.confidence ?? 0.7) * 10, icon: Shield },
            { label: 'Anomaly',     value: (scoreData.anomalyScore ?? 0) * 10, icon: Zap },
            { label: 'Ranking',     value: scoreData.rankingScore ?? 0, icon: BarChart2 },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Icon className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-[10px] text-muted">{label}</p>
                <p className="text-base font-bold font-mono tabular-nums text-text">{value.toFixed(1)}</p>
              </div>
              <div className="flex-1 h-1.5 bg-surface-3 rounded-full overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all', value >= 7 ? 'bg-success' : value >= 5 ? 'bg-warning' : 'bg-danger')}
                  style={{ width: `${Math.min(100, (value / 12) * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Tabs ── */}
      <div className="flex gap-1 mb-4 border-b border-border overflow-x-auto">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={cn('px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px',
              tab === t ? 'text-primary border-primary' : 'text-muted border-transparent hover:text-text')}>
            {t}
          </button>
        ))}
      </div>

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* TAB: Overview                                               */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {tab === 'Overview' && (
        <div className="space-y-4 animate-fade-in">
          {/* Price chart */}
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-text mb-3">Price History</h3>
            {history?.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={history}>
                  <defs>
                    <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"   stopColor="#3b82f6" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} width={55} tickFormatter={v => `$${v}`} />
                  <Tooltip content={<ChartTooltip />} />
                  <Area type="monotone" dataKey="close" name="Price" stroke="#3b82f6" strokeWidth={2} fill="url(#priceGrad)" dot={false} />
                  {technicals?.ma20  && <ReferenceLine y={technicals.ma20}  stroke="#f59e0b" strokeDasharray="4 4" label={{ value: 'MA20',  fill: '#f59e0b', fontSize: 9 }} />}
                  {technicals?.ma50  && <ReferenceLine y={technicals.ma50}  stroke="#8b5cf6" strokeDasharray="4 4" label={{ value: 'MA50',  fill: '#8b5cf6', fontSize: 9 }} />}
                  {technicals?.ma200 && <ReferenceLine y={technicals.ma200} stroke="#ef4444" strokeDasharray="4 4" label={{ value: 'MA200', fill: '#ef4444', fontSize: 9 }} />}
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="skeleton h-[220px] w-full" />
            )}
          </div>

          {/* Key stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="Market Cap"  value={fundamentals?.marketCap ? `$${(fundamentals.marketCap / 1e9).toFixed(1)}B` : '—'} />
            <StatCard label="P/E Ratio"   value={fundamentals?.peRatio?.toFixed(1) ?? '—'} />
            <StatCard label="52W High"    value={`$${fmt(quote?.week52High ?? 0)}`} />
            <StatCard label="52W Low"     value={`$${fmt(quote?.week52Low ?? 0)}`} />
            <StatCard label="Volume"      value={quote?.volume ? `${(quote.volume / 1e6).toFixed(1)}M` : '—'} />
            <StatCard label="Avg Volume"  value={quote?.avgVolume ? `${(quote.avgVolume / 1e6).toFixed(1)}M` : '—'} />
            <StatCard label="EPS"         value={fundamentals?.eps?.toFixed(2) ? `$${fundamentals.eps.toFixed(2)}` : '—'} />
            <StatCard label="Beta"        value={fundamentals?.beta?.toFixed(2) ?? '—'} />
          </div>

          {/* Analyst consensus */}
          {analyst && (
            <div className="card p-4">
              <h3 className="text-sm font-semibold text-text mb-3 flex items-center gap-2">
                <Star className="w-4 h-4 text-gold" /> Analyst Consensus
              </h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <p className="text-xs text-muted mb-1">Rating</p>
                  <p className={cn('text-lg font-bold', analyst.consensus === 'Buy' || analyst.consensus === 'Strong Buy' ? 'text-success' : analyst.consensus === 'Sell' ? 'text-danger' : 'text-warning')}>
                    {analyst.consensus ?? '—'}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted mb-1">Price Target</p>
                  <p className="text-lg font-bold text-text font-mono">${fmt(analyst.priceTarget ?? 0)}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted mb-1">Upside</p>
                  <p className={cn('text-lg font-bold font-mono', (analyst.upside ?? 0) >= 0 ? 'text-success' : 'text-danger')}>
                    {analyst.upside != null ? `${analyst.upside >= 0 ? '+' : ''}${fmtPct(analyst.upside / 100)}` : '—'}
                  </p>
                </div>
              </div>
              {analyst.analystCount != null && (
                <p className="text-xs text-muted mt-3 text-center">{analyst.analystCount} analysts covering</p>
              )}
            </div>
          )}

          {/* Business model */}
          {fundamentals?.description && (
            <div className="card p-4">
              <h3 className="text-sm font-semibold text-text mb-2">Business Overview</h3>
              <p className="text-xs text-muted leading-relaxed line-clamp-4">{fundamentals.description}</p>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* TAB: Technicals                                             */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {tab === 'Technicals' && (
        <div className="space-y-4 animate-fade-in">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="RSI (14)"    value={technicals?.rsi?.toFixed(1) ?? '—'}
              color={technicals?.rsi < 30 ? 'text-success' : technicals?.rsi > 70 ? 'text-danger' : 'text-text'}
              sub={technicals?.rsi < 30 ? 'Oversold' : technicals?.rsi > 70 ? 'Overbought' : 'Neutral'} />
            <StatCard label="MACD Signal" value={technicals?.macdSignal ?? '—'}
              color={technicals?.macdSignal === 'bullish' ? 'text-success' : technicals?.macdSignal === 'bearish' ? 'text-danger' : 'text-text'} />
            <StatCard label="MA20"  value={technicals?.ma20  ? `$${fmt(technicals.ma20)}`  : '—'} />
            <StatCard label="MA200" value={technicals?.ma200 ? `$${fmt(technicals.ma200)}` : '—'} />
          </div>

          {/* Volume chart */}
          {history?.length > 0 && (
            <div className="card p-4">
              <h3 className="text-sm font-semibold text-text mb-3">Volume</h3>
              <ResponsiveContainer width="100%" height={140}>
                <BarChart data={history.slice(-60)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                  <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 9 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 9 }} axisLine={false} tickLine={false} width={45}
                    tickFormatter={v => `${(v / 1e6).toFixed(0)}M`} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="volume" name="Volume" fill="#3b82f6" opacity={0.7} radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* MA lines chart */}
          {history?.length > 0 && (
            <div className="card p-4">
              <h3 className="text-sm font-semibold text-text mb-3">Moving Averages vs Price</h3>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={history.slice(-120)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 9 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 9 }} axisLine={false} tickLine={false} width={55} tickFormatter={v => `$${v}`} />
                  <Tooltip content={<ChartTooltip />} />
                  <Line type="monotone" dataKey="close"  name="Price" stroke="#3b82f6" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="ma20"   name="MA20"  stroke="#f59e0b" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
                  <Line type="monotone" dataKey="ma50"   name="MA50"  stroke="#8b5cf6" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
                  <Line type="monotone" dataKey="ma200"  name="MA200" stroke="#ef4444" strokeWidth={1.5} dot={false} strokeDasharray="6 3" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* TAB: Fundamentals                                           */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {tab === 'Fundamentals' && (
        <div className="space-y-4 animate-fade-in">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { label: 'Revenue Growth', value: fundamentals?.revenueGrowth != null ? fmtPct(fundamentals.revenueGrowth) : '—', color: (fundamentals?.revenueGrowth ?? 0) > 0 ? 'text-success' : 'text-danger' },
              { label: 'Operating Margin', value: fundamentals?.operatingMargin != null ? fmtPct(fundamentals.operatingMargin) : '—', color: (fundamentals?.operatingMargin ?? 0) > 0.15 ? 'text-success' : 'text-warning' },
              { label: 'ROE', value: fundamentals?.roe != null ? fmtPct(fundamentals.roe) : '—', color: (fundamentals?.roe ?? 0) > 0.15 ? 'text-success' : 'text-warning' },
              { label: 'Debt / Equity', value: fundamentals?.debtToEquity?.toFixed(2) ?? '—', color: (fundamentals?.debtToEquity ?? 0) < 1 ? 'text-success' : 'text-danger' },
              { label: 'Free Cash Flow', value: fundamentals?.fcf ? `$${(fundamentals.fcf / 1e9).toFixed(1)}B` : '—', color: (fundamentals?.fcf ?? 0) > 0 ? 'text-success' : 'text-danger' },
              { label: 'Dividend Yield', value: fundamentals?.dividendYield != null ? fmtPct(fundamentals.dividendYield) : 'N/A', color: 'text-text' },
            ].map(({ label, value, color }) => (
              <StatCard key={label} label={label} value={value} color={color} />
            ))}
          </div>

          {/* Revenue sparkline */}
          {fundamentals?.revenueHistory?.length > 0 && (
            <div className="card p-4">
              <h3 className="text-sm font-semibold text-text mb-3">Revenue Trend</h3>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={fundamentals.revenueHistory}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                  <XAxis dataKey="period" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} width={55} tickFormatter={v => `$${(v / 1e9).toFixed(0)}B`} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="revenue" name="Revenue" fill="#10b981" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* TAB: Flows                                                  */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {tab === 'Flows' && (
        <div className="space-y-4 animate-fade-in">
          {/* Flows summary KPIs */}
          {flows && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard label="Institutional Ownership" value={flows.institutionalOwnership != null ? fmtPct(flows.institutionalOwnership) : '—'} />
              <StatCard label="Inst. Change (QoQ)" value={flows.institutionalChange != null ? `${flows.institutionalChange >= 0 ? '+' : ''}${fmtPct(flows.institutionalChange)}` : '—'}
                color={(flows.institutionalChange ?? 0) >= 0 ? 'text-success' : 'text-danger'} />
              <StatCard label="Net Insider" value={flows.netInsider != null ? `$${(flows.netInsider / 1e6).toFixed(1)}M` : '—'}
                color={(flows.netInsider ?? 0) >= 0 ? 'text-success' : 'text-danger'} />
              <StatCard label="Political Activity" value={flows.politicalCount != null ? `${flows.politicalCount} trades` : '—'} />
            </div>
          )}

          {/* Insider trades table */}
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-text mb-3 flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" /> Insider Trades
            </h3>
            {insider?.length > 0 ? (
              <div className="space-y-2">
                {insider.slice(0, 10).map((t: any, i: number) => (
                  <div key={i} className="flex items-center justify-between p-2.5 rounded-lg bg-surface-2 hover:bg-surface-3 transition-colors">
                    <div>
                      <p className="text-xs font-medium text-text">{t.insiderName ?? 'Unknown'}</p>
                      <p className="text-[10px] text-muted">{t.role ?? ''} · {t.filedAt ? timeAgo(t.filedAt) : ''}</p>
                    </div>
                    <div className="text-right">
                      <p className={cn('text-xs font-semibold font-mono tabular-nums', t.transactionType === 'buy' ? 'text-success' : 'text-danger')}>
                        {t.transactionType === 'buy' ? '+' : '-'}${(Math.abs(t.value ?? 0) / 1e3).toFixed(0)}K
                      </p>
                      <p className="text-[10px] text-muted">{t.shares?.toLocaleString()} shares</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted py-6 text-center">No insider trades available</p>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* TAB: AI Analysis                                            */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {tab === 'AI Analysis' && (
        <div className="space-y-4 animate-fade-in">
          <div className="flex items-center gap-2 mb-2">
            <Brain className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold text-text">Multi-Agent AI Analysis</span>
            <span className="text-xs text-muted">— Three independent viewpoints synthesized</span>
          </div>

          {aiData ? (
            <>
              <AiAnalystCard stance="bullish" data={aiData.bullish} />
              <AiAnalystCard stance="bearish" data={aiData.bearish} />
              <AiAnalystCard stance="neutral" data={aiData.neutral} />

              {aiData.recommendation && (
                <div className="card p-4 border-primary/30 bg-primary/5">
                  <p className="text-xs text-muted mb-1">Overall Recommendation</p>
                  <p className="text-sm font-semibold text-text">{aiData.recommendation}</p>
                  {aiData.confidence != null && (
                    <div className="flex items-center gap-2 mt-2">
                      <div className="flex-1 h-1.5 bg-surface-3 rounded-full">
                        <div className="h-full bg-primary rounded-full" style={{ width: `${aiData.confidence * 100}%` }} />
                      </div>
                      <span className="text-xs font-mono text-muted">{(aiData.confidence * 100).toFixed(0)}% conf</span>
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <div key={i} className="skeleton h-40 w-full rounded-xl" />)}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* TAB: Signals                                                */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {tab === 'Signals' && (
        <div className="space-y-4 animate-fade-in">
          {/* Live anomaly */}
          {scoreData && (
            <div className={cn('card p-4 border', scoreData.earlyFlag ? 'border-warning/40 bg-warning/5' : 'border-border')}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Zap className={cn('w-4 h-4', scoreData.earlyFlag ? 'text-warning' : 'text-muted')} />
                  <span className="text-sm font-semibold text-text">Live Anomaly Detection</span>
                </div>
                <SignalBadge type={scoreData.signalType ?? 'NEUTRAL'} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-muted">Anomaly Score</p>
                  <p className="text-xl font-bold font-mono tabular-nums text-text">
                    {((scoreData.anomalyScore ?? 0) * 10).toFixed(2)}
                    <span className="text-xs text-muted font-normal"> / 10</span>
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted">Early Signal</p>
                  <p className={cn('text-sm font-semibold mt-0.5', scoreData.earlyFlag ? 'text-warning' : 'text-muted')}>
                    {scoreData.earlyFlag ? '⚡ Detected' : 'None'}
                  </p>
                </div>
              </div>
              {scoreData.drivers?.length > 0 && (
                <div className="mt-3 pt-3 border-t border-border/50">
                  <p className="text-[10px] text-muted uppercase tracking-wider mb-2">Key Drivers</p>
                  <div className="flex flex-wrap gap-1.5">
                    {scoreData.drivers.map((d: string) => (
                      <span key={d} className="text-[10px] bg-surface-3 border border-border px-2 py-0.5 rounded-full text-muted">{d}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Historical signals */}
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-text mb-3 flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" /> Signal History
            </h3>
            {signals?.length > 0 ? (
              <div className="space-y-2">
                {signals.map((s: any) => (
                  <div key={s.id} className="flex items-center justify-between p-2.5 rounded-lg bg-surface-2">
                    <div className="flex items-center gap-3">
                      <SignalBadge type={s.signalType} />
                      {s.earlyFlag && (
                        <span className="text-[10px] text-warning font-semibold">⚡ Early</span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-right">
                      <div>
                        <p className="text-xs font-mono tabular-nums text-text">{(s.strength * 10).toFixed(1)}</p>
                        <p className="text-[10px] text-muted">strength</p>
                      </div>
                      <p className="text-xs text-muted w-20">{timeAgo(s.detectedAt)}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-10 text-center">
                <AlertTriangle className="w-6 h-6 text-faint mx-auto mb-2" />
                <p className="text-xs text-muted">No signals detected yet. Run the scoring engine to populate.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </AppShell>
  );
}
