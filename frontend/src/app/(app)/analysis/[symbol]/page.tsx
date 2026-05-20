'use client';
import { use } from 'react';
import AppShell from '@/components/layout/AppShell';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import ScoreBar from '@/components/ui/ScoreBar';
import SignalBadge from '@/components/ui/SignalBadge';
import SkeletonCard from '@/components/ui/SkeletonCard';
import { formatCurrency, formatNumber, formatPct, scoreColor, timeAgo } from '@/lib/utils';
import { TrendingUp, TrendingDown, Activity, Brain, BarChart2, DollarSign, Building2 } from 'lucide-react';
import {
  ResponsiveContainer, ComposedChart, Line, Bar, XAxis, YAxis, Tooltip, Legend
} from 'recharts';

interface PageProps { params: Promise<{ symbol: string }> }

export default function AnalysisPage({ params }: PageProps) {
  const { symbol } = use(params);

  const { data: stock, isLoading: loadingStock } = useQuery({
    queryKey: ['stock', symbol],
    queryFn: () => api.get(`/stocks/${symbol}`).then(r => r.data),
    enabled: !!symbol,
  });
  const { data: score, isLoading: loadingScore } = useQuery({
    queryKey: ['score', symbol],
    queryFn: () => api.get(`/scoring/${symbol}`).then(r => r.data),
    enabled: !!symbol,
  });
  const { data: alpha } = useQuery({
    queryKey: ['alpha', symbol],
    queryFn: () => api.get(`/alpha/${symbol}`).then(r => r.data),
    enabled: !!symbol,
  });
  const { data: aiAnalysis, isLoading: loadingAI } = useQuery({
    queryKey: ['ai', symbol],
    queryFn: () => api.get(`/ai/analysis/${symbol}`).then(r => r.data),
    enabled: !!symbol,
  });
  const { data: candles } = useQuery({
    queryKey: ['candles', symbol],
    queryFn: () => api.get(`/stocks/${symbol}/candles?period=30`).then(r => r.data),
    enabled: !!symbol,
  });

  const SCORE_FACTORS = [
    { key: 'fundamentalScore', label: 'Fundamental', max: 2.5, icon: DollarSign },
    { key: 'technicalScore',   label: 'Technical',   max: 2.0, icon: BarChart2 },
    { key: 'sentimentScore',   label: 'Sentiment',   max: 1.5, icon: Activity },
    { key: 'institutionalScore', label: 'Institutional', max: 2.0, icon: Building2 },
    { key: 'analystScore',     label: 'Analyst',     max: 1.0, icon: TrendingUp },
    { key: 'politicalScore',   label: 'Political',   max: 0.5, icon: Activity },
    { key: 'macroScore',       label: 'Macro',       max: 0.5, icon: BarChart2 },
  ];

  return (
    <AppShell title={`Analysis — ${symbol}`}>
      {/* Header */}
      {loadingStock ? <SkeletonCard rows={2} /> : stock ? (
        <div className="card p-5 mb-4 flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold font-mono text-text">{stock.symbol}</h1>
              {stock.priceChangePct >= 0
                ? <TrendingUp className="w-5 h-5 text-success" />
                : <TrendingDown className="w-5 h-5 text-danger" />}
            </div>
            <p className="text-sm text-muted mb-2">{stock.name}</p>
            <div className="flex items-center gap-4">
              <span className="text-muted text-xs">{stock.sector}</span>
              <span className="text-muted text-xs">•</span>
              <span className="text-muted text-xs">{stock.industry}</span>
            </div>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold font-mono text-text">{formatCurrency(stock.lastPrice)}</p>
            <p className={`text-sm font-mono mt-1 ${stock.priceChangePct >= 0 ? 'text-success' : 'text-danger'}`}>
              {formatPct(stock.priceChangePct)} today
            </p>
            <p className="text-xs text-muted mt-1">Vol: {formatNumber(stock.volume)}</p>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        {/* Score Breakdown */}
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-text mb-4">Scoring Engine V2</h2>
          {loadingScore ? <SkeletonCard rows={7} /> : score ? (
            <>
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-border">
                <span className="text-xs text-muted">Final Score</span>
                <span className={`text-2xl font-bold font-mono ${scoreColor(score.finalScore)}`}>
                  {score.finalScore.toFixed(1)}
                </span>
              </div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-muted">Confidence</span>
                <span className="text-xs font-mono text-text">{score.confidenceFactor.toFixed(2)}x</span>
              </div>
              <div className="space-y-2.5">
                {SCORE_FACTORS.map(({ key, label, max }) => (
                  <ScoreBar key={key} score={(score[key] / max) * 10} label={label} size="sm" />
                ))}
              </div>
            </>
          ) : <p className="text-xs text-muted">Score not computed yet.</p>}
        </div>

        {/* Price Chart */}
        <div className="card p-5 lg:col-span-2">
          <h2 className="text-sm font-semibold text-text mb-4">Price & Volume — 30 days</h2>
          {candles ? (
            <ResponsiveContainer width="100%" height={220}>
              <ComposedChart data={candles} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                <defs>
                  <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="price" orientation="right" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="vol" orientation="left" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: '#0f1117', border: '1px solid #1e2435', borderRadius: 8, fontSize: 11 }} />
                <Bar yAxisId="vol" dataKey="volume" fill="#1e2435" opacity={0.6} />
                <Line yAxisId="price" type="monotone" dataKey="close" stroke="#3b82f6" strokeWidth={2} dot={false} />
                <Line yAxisId="price" type="monotone" dataKey="ma20" stroke="#f59e0b" strokeWidth={1} dot={false} strokeDasharray="4 2" />
                <Line yAxisId="price" type="monotone" dataKey="ma50" stroke="#8b5cf6" strokeWidth={1} dot={false} strokeDasharray="4 2" />
                <Legend wrapperStyle={{ fontSize: 10, color: '#64748b' }} />
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex items-center justify-center">
              <p className="text-xs text-muted">Chart data loading...</p>
            </div>
          )}
        </div>
      </div>

      {/* Alpha Signals */}
      {alpha && (
        <div className="card p-5 mb-4">
          <h2 className="text-sm font-semibold text-text mb-4">Alpha Engine — Hidden Signals</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            {[
              { label: 'Anomaly Score', value: `${(alpha.anomalyScore * 100).toFixed(0)}%`, color: alpha.anomalyScore > 0.6 ? 'text-warning' : 'text-text' },
              { label: 'Volume Spike', value: alpha.volumeAnomaly?.toFixed(2) ?? '—', color: 'text-text' },
              { label: 'Sentiment Vel.', value: alpha.sentimentVelocity?.toFixed(2) ?? '—', color: 'text-text' },
              { label: 'Insider Activity', value: alpha.insiderActivity?.toFixed(2) ?? '—', color: 'text-text' },
            ].map((m, i) => (
              <div key={i} className="card-2 p-3">
                <p className="text-xs text-muted mb-1">{m.label}</p>
                <p className={`text-lg font-bold font-mono ${m.color}`}>{m.value}</p>
              </div>
            ))}
          </div>
          {alpha.signals?.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {alpha.signals.map((sig: {signalType: string; earlyFlag: boolean}, i: number) => (
                <SignalBadge key={i} signal={sig.signalType} earlyFlag={sig.earlyFlag} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* AI Multi-Agent Analysis */}
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Brain className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-semibold text-text">AI Multi-Agent Analysis</h2>
        </div>
        {loadingAI ? <SkeletonCard rows={6} /> : aiAnalysis ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {(['bullish','bearish','neutral'] as const).map((stance) => {
              const a = aiAnalysis[stance];
              if (!a) return null;
              const color = stance === 'bullish' ? 'border-success/30 bg-success/5'
                : stance === 'bearish' ? 'border-danger/30 bg-danger/5'
                : 'border-border bg-surface-2';
              const titleColor = stance === 'bullish' ? 'text-success' : stance === 'bearish' ? 'text-danger' : 'text-muted';
              return (
                <div key={stance} className={`rounded-xl border p-4 ${color}`}>
                  <p className={`text-xs font-semibold uppercase tracking-wider mb-2 ${titleColor}`}>{stance} analyst</p>
                  <p className="text-sm text-text mb-3">{a.argument}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted">Confidence</span>
                    <span className="text-xs font-mono text-text">{(a.confidence * 100).toFixed(0)}%</span>
                  </div>
                  {a.recommendation && (
                    <p className="text-xs text-muted mt-2">{a.recommendation}</p>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-muted text-center py-6">AI analysis requires FMP or Finnhub API key. Configure in Settings.</p>
        )}
      </div>
    </AppShell>
  );
}
