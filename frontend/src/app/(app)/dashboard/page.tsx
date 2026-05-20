'use client';
import AppShell from '@/components/layout/AppShell';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import StatCard from '@/components/ui/StatCard';
import ScoreBar from '@/components/ui/ScoreBar';
import SignalBadge from '@/components/ui/SignalBadge';
import SkeletonCard from '@/components/ui/SkeletonCard';
import { formatPct, formatNumber, timeAgo } from '@/lib/utils';
import { Zap, TrendingUp, Activity, BarChart2, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts';

const MOCK_MARKET_TREND = [
  { t: '09:00', v: 4210 }, { t: '10:00', v: 4225 }, { t: '11:00', v: 4198 },
  { t: '12:00', v: 4240 }, { t: '13:00', v: 4255 }, { t: '14:00', v: 4268 },
  { t: '15:00', v: 4280 }, { t: '16:00', v: 4310 },
];

export default function DashboardPage() {
  const { data: opportunities, isLoading: loadingOpps } = useQuery({
    queryKey: ['opportunities'],
    queryFn: () => api.get('/opportunities/top').then(r => r.data),
  });
  const { data: signals, isLoading: loadingSignals } = useQuery({
    queryKey: ['signals-recent'],
    queryFn: () => api.get('/alpha/signals/recent').then(r => r.data),
  });

  const topOpps = opportunities?.slice(0, 5) ?? [];
  const recentSignals = signals?.slice(0, 6) ?? [];

  return (
    <AppShell title="Dashboard">
      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Top Opportunities" value={loadingOpps ? '—' : opportunities?.length ?? 0}
          subValue="ranked today" icon={Zap} color="primary" />
        <StatCard label="Early Signals" value={loadingSignals ? '—' : recentSignals.filter((s: {earlyFlag: boolean}) => s.earlyFlag).length}
          subValue="⚡ pre-move detected" icon={Activity} color="warning" />
        <StatCard label="Avg Score" value={loadingOpps ? '—' : (topOpps.reduce((a: number, o: {finalScore: number}) => a + o.finalScore, 0) / (topOpps.length || 1)).toFixed(1)}
          subValue="out of 10" icon={BarChart2} color="success" />
        <StatCard label="Market Pulse" value="+1.24%" subValue="S&P 500 today" icon={TrendingUp} trend="up" color="success" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        {/* Market Trend Chart */}
        <div className="card p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-text">Market Trend — S&P 500</h2>
            <span className="text-xs text-success font-mono">+1.24%</span>
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={MOCK_MARKET_TREND} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
              <defs>
                <linearGradient id="spGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="t" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} domain={['auto','auto']} />
              <Tooltip contentStyle={{ background: '#0f1117', border: '1px solid #1e2435', borderRadius: 8, fontSize: 11 }}
                labelStyle={{ color: '#64748b' }} itemStyle={{ color: '#3b82f6' }} />
              <Area type="monotone" dataKey="v" stroke="#3b82f6" strokeWidth={2} fill="url(#spGrad)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Recent Signals */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-text">Recent Signals</h2>
            <Link href="/opportunities" className="text-xs text-primary hover:text-primary-hover flex items-center gap-1">
              All <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {loadingSignals ? (
            <div className="space-y-3">{[...Array(4)].map((_,i) => <SkeletonCard key={i} rows={1} />)}</div>
          ) : recentSignals.length === 0 ? (
            <p className="text-xs text-muted text-center py-8">No signals yet. Add API keys in Settings.</p>
          ) : (
            <div className="space-y-3">
              {recentSignals.map((sig: {symbol: string; signalType: string; earlyFlag: boolean; detectedAt: string; strength: number}, i: number) => (
                <div key={i} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-mono font-semibold text-text">{sig.symbol}</p>
                    <SignalBadge signal={sig.signalType} earlyFlag={sig.earlyFlag} />
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-mono text-muted">{timeAgo(sig.detectedAt)}</p>
                    <p className="text-xs text-muted">{(sig.strength * 100).toFixed(0)}% str</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Top Opportunities Table */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-text">Top Opportunities Today</h2>
          <Link href="/opportunities" className="text-xs text-primary hover:text-primary-hover flex items-center gap-1">
            Full ranking <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        {loadingOpps ? (
          <SkeletonCard rows={5} />
        ) : topOpps.length === 0 ? (
          <p className="text-xs text-muted text-center py-8">No opportunities computed yet. Configure APIs in Settings.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="table-header text-left pb-2">Symbol</th>
                  <th className="table-header text-left pb-2">Score</th>
                  <th className="table-header text-left pb-2">Anomaly</th>
                  <th className="table-header text-left pb-2">Signal</th>
                  <th className="table-header text-right pb-2">Change</th>
                  <th className="table-header text-right pb-2"></th>
                </tr>
              </thead>
              <tbody>
                {topOpps.map((opp: {symbol: string; name: string; finalScore: number; anomalyScore: number; signalType: string; earlyFlag: boolean; priceChangePct: number}, i: number) => (
                  <tr key={i} className="border-b border-border/50 hover:bg-surface-2/50 transition-colors">
                    <td className="py-2.5">
                      <div>
                        <p className="text-sm font-mono font-semibold text-text">{opp.symbol}</p>
                        <p className="text-xs text-muted truncate max-w-[100px]">{opp.name}</p>
                      </div>
                    </td>
                    <td className="py-2.5">
                      <div className="w-24"><ScoreBar score={opp.finalScore} /></div>
                    </td>
                    <td className="py-2.5">
                      <span className="text-xs font-mono text-text">{(opp.anomalyScore * 100).toFixed(0)}%</span>
                    </td>
                    <td className="py-2.5">
                      <SignalBadge signal={opp.signalType} earlyFlag={opp.earlyFlag} />
                    </td>
                    <td className="py-2.5 text-right">
                      <span className={`text-xs font-mono ${opp.priceChangePct >= 0 ? 'text-success' : 'text-danger'}`}>
                        {formatPct(opp.priceChangePct)}
                      </span>
                    </td>
                    <td className="py-2.5 text-right">
                      <Link href={`/analysis/${opp.symbol}`}
                        className="text-xs text-primary hover:text-primary-hover">Analyse</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppShell>
  );
}
