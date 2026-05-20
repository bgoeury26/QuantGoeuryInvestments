'use client';
import AppShell from '@/components/layout/AppShell';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import ScoreBar from '@/components/ui/ScoreBar';
import SignalBadge from '@/components/ui/SignalBadge';
import SkeletonCard from '@/components/ui/SkeletonCard';
import { formatPct, formatNumber } from '@/lib/utils';
import Link from 'next/link';
import { RefreshCw, Filter } from 'lucide-react';
import { useState } from 'react';

export default function OpportunitiesPage() {
  const [minScore, setMinScore] = useState(0);
  const [earlyOnly, setEarlyOnly] = useState(false);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['opportunities-full'],
    queryFn: () => api.get('/opportunities/top?limit=50').then(r => r.data),
  });

  const filtered = (data ?? []).filter((o: {finalScore: number; earlyFlag: boolean}) =>
    o.finalScore >= minScore && (!earlyOnly || o.earlyFlag)
  );

  return (
    <AppShell title="Opportunities">
      {/* Controls */}
      <div className="flex items-center gap-4 mb-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted" />
          <span className="text-xs text-muted">Min Score:</span>
          <input type="range" min={0} max={9} step={0.5} value={minScore}
            onChange={e => setMinScore(parseFloat(e.target.value))}
            className="w-24 accent-primary" />
          <span className="text-xs font-mono text-text w-6">{minScore}</span>
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <div onClick={() => setEarlyOnly(!earlyOnly)}
            className={`w-8 h-4 rounded-full transition-colors ${earlyOnly ? 'bg-cyan' : 'bg-faint'} relative`}>
            <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform ${earlyOnly ? 'translate-x-4' : 'translate-x-0.5'}`} />
          </div>
          <span className="text-xs text-muted">⚡ Early signals only</span>
        </label>
        <button onClick={() => refetch()} disabled={isFetching}
          className="ml-auto btn-ghost flex items-center gap-1.5 text-xs h-8">
          <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Summary Row */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="card p-4">
          <p className="text-xs text-muted mb-1">Total Opportunities</p>
          <p className="text-2xl font-bold text-text">{filtered.length}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-muted mb-1">Early Signals</p>
          <p className="text-2xl font-bold text-cyan">{filtered.filter((o: {earlyFlag: boolean}) => o.earlyFlag).length}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-muted mb-1">High Conviction (&ge;7.5)</p>
          <p className="text-2xl font-bold text-success">{filtered.filter((o: {finalScore: number}) => o.finalScore >= 7.5).length}</p>
        </div>
      </div>

      {/* Full Table */}
      <div className="card p-5">
        <h2 className="text-sm font-semibold text-text mb-4">Ranked Opportunities</h2>
        {isLoading ? <SkeletonCard rows={10} /> : filtered.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted text-sm">No opportunities match your filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="table-header text-left pb-2">#</th>
                  <th className="table-header text-left pb-2">Symbol</th>
                  <th className="table-header text-left pb-2">Ranking Score</th>
                  <th className="table-header text-left pb-2">Final Score</th>
                  <th className="table-header text-left pb-2">Anomaly</th>
                  <th className="table-header text-left pb-2">Signal</th>
                  <th className="table-header text-right pb-2">Change</th>
                  <th className="table-header text-right pb-2">Volume</th>
                  <th className="table-header text-right pb-2"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((opp: {
                  symbol: string; name: string;
                  rankingScore: number; finalScore: number;
                  anomalyScore: number; signalType: string; earlyFlag: boolean;
                  priceChangePct: number; volume: number;
                }, i: number) => (
                  <tr key={i} className="border-b border-border/30 hover:bg-surface-2/50 transition-colors">
                    <td className="py-3 text-xs text-muted font-mono">{i + 1}</td>
                    <td className="py-3">
                      <div>
                        <p className="text-sm font-mono font-semibold text-text">{opp.symbol}</p>
                        <p className="text-xs text-muted truncate max-w-[80px]">{opp.name}</p>
                      </div>
                    </td>
                    <td className="py-3"><div className="w-28"><ScoreBar score={opp.rankingScore} /></div></td>
                    <td className="py-3"><div className="w-24"><ScoreBar score={opp.finalScore} /></div></td>
                    <td className="py-3">
                      <div className="flex items-center gap-1">
                        <div className={`w-2 h-2 rounded-full ${opp.anomalyScore > 0.6 ? 'bg-warning' : 'bg-faint'}`} />
                        <span className="text-xs font-mono text-text">{(opp.anomalyScore * 100).toFixed(0)}%</span>
                      </div>
                    </td>
                    <td className="py-3"><SignalBadge signal={opp.signalType} earlyFlag={opp.earlyFlag} /></td>
                    <td className="py-3 text-right">
                      <span className={`text-xs font-mono ${opp.priceChangePct >= 0 ? 'text-success' : 'text-danger'}`}>
                        {formatPct(opp.priceChangePct)}
                      </span>
                    </td>
                    <td className="py-3 text-right">
                      <span className="text-xs font-mono text-muted">{formatNumber(opp.volume)}</span>
                    </td>
                    <td className="py-3 text-right">
                      <Link href={`/analysis/${opp.symbol}`} className="text-xs text-primary hover:text-primary-hover">View</Link>
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
