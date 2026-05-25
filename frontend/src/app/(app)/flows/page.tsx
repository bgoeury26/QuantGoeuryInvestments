'use client';
import AppShell from '@/components/layout/AppShell';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import SkeletonCard from '@/components/ui/SkeletonCard';
import { formatNumber, timeAgo } from '@/lib/utils';
import { Building2, Users, Flag, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts';

export default function FlowsPage() {
  const { data: flowsRaw, isLoading } = useQuery({
    queryKey: ['flows'],
    queryFn: () => api.get('/flows/summary').then(r => r.data),
  });
  const { data: insidersRaw, isLoading: insidersLoading } = useQuery({
    queryKey: ['insider-trades'],
    queryFn: () => api.get('/flows/insider-trades?limit=20').then(r => r.data),
  });
  const { data: politicalRaw } = useQuery({
    queryKey: ['political'],
    queryFn: () => api.get('/flows/political').then(r => r.data),
  });

  // Transform summaries into chart data using net insider shares as proxy
  const institutionalChart = (flowsRaw?.summaries ?? []).map((s: any) => ({
    symbol: s.symbol,
    netFlow: s.insider?.netShares ?? ((s.insider?.buying ?? 0) - (s.insider?.selling ?? 0)),
  }));

  const hasChartData = institutionalChart.some((d: any) => d.netFlow !== 0);

  const insiders: any[] = insidersRaw?.trades ?? [];
  const political: any[] = politicalRaw?.trades ?? [];

  const SignalBadge = ({ signal }: { signal: string }) => {
    if (signal === 'BULLISH') return <span className="flex items-center gap-1 text-xs text-success font-medium"><TrendingUp className="w-3 h-3" />Bullish</span>;
    if (signal === 'BEARISH') return <span className="flex items-center gap-1 text-xs text-error font-medium"><TrendingDown className="w-3 h-3" />Bearish</span>;
    return <span className="flex items-center gap-1 text-xs text-muted"><Minus className="w-3 h-3" />Neutral</span>;
  };

  return (
    <AppShell title="Flows Intelligence">
      {/* Summary grid */}
      {!isLoading && flowsRaw?.summaries?.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-4">
          {flowsRaw.summaries.map((s: any) => (
            <div key={s.symbol} className="card p-3">
              <p className="font-mono text-sm font-bold text-text">{s.symbol}</p>
              <SignalBadge signal={s.signal} />
              <p className="text-xs text-muted mt-1">
                {s.insider.buying}B / {s.insider.selling}S insider
              </p>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        {/* Insider Net Flow Chart */}
        <div className="card p-5 lg:col-span-2">
          <div className="flex items-center gap-2 mb-4">
            <Building2 className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold text-text">Insider Net Flow by Symbol</h2>
          </div>
          {isLoading ? <SkeletonCard rows={4} /> : hasChartData ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={institutionalChart} margin={{ left: -10 }}>
                <XAxis dataKey="symbol" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: '#0f1117', border: '1px solid #1e2435', borderRadius: 8, fontSize: 11 }}
                  formatter={(v: number) => [formatNumber(v) + ' shares', 'Net Insider Flow']}
                />
                <Bar dataKey="netFlow" radius={[4, 4, 0, 0]}>
                  {institutionalChart.map((entry: { netFlow: number }, index: number) => (
                    <Cell key={index} fill={entry.netFlow >= 0 ? '#10b981' : '#ef4444'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-xs text-muted text-center py-8">
              All insider trades are neutral (no BUY/SELL direction data from Finnhub free tier).
            </p>
          )}
        </div>

        {/* Political Trades */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Flag className="w-4 h-4 text-warning" />
            <h2 className="text-sm font-semibold text-text">Political Signals</h2>
          </div>
          {political.length > 0 ? (
            <div className="space-y-3">
              {political.slice(0, 6).map((p: any, i: number) => (
                <div key={i} className="data-row">
                  <div>
                    <p className="text-xs font-medium text-text">{p.politician}</p>
                    <p className="text-xs text-muted">{p.ticker} — {p.type}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-mono text-text">{p.amount}</p>
                    <p className="text-xs text-muted">{timeAgo(p.date)}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted text-center py-8">
              {politicalRaw?.note ?? 'No political trades data available.'}
            </p>
          )}
        </div>
      </div>

      {/* Insider Trades Table */}
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Users className="w-4 h-4 text-purple" />
          <h2 className="text-sm font-semibold text-text">
            Insider Transactions
            {insiders.length > 0 && <span className="ml-2 text-xs text-muted font-normal">({insiders.length} trades)</span>}
          </h2>
        </div>
        {insidersLoading ? <SkeletonCard rows={5} /> : insiders.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  {['Symbol', 'Insider', 'Type', 'Shares', 'Value', 'Date'].map(h => (
                    <th key={h} className="table-header text-left pb-2 pr-4 text-xs text-muted font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {insiders.map((t: any, i: number) => (
                  <tr key={i} className="border-b border-border/30 hover:bg-surface-2/50">
                    <td className="py-2.5 pr-4">
                      <span className="font-mono text-sm font-semibold text-text">{t.symbol}</span>
                    </td>
                    <td className="py-2.5 pr-4">
                      <span className="text-xs text-text">{t.name}</span>
                    </td>
                    <td className="py-2.5 pr-4">
                      {t.transactionType === 'BUY' ? (
                        <span className="badge badge-success">BUY</span>
                      ) : t.transactionType === 'SELL' ? (
                        <span className="badge badge-danger">SELL</span>
                      ) : (
                        <span className="badge">OTHER</span>
                      )}
                    </td>
                    <td className="py-2.5 pr-4">
                      <span className="text-xs font-mono text-muted">{formatNumber(t.shares ?? 0)}</span>
                    </td>
                    <td className="py-2.5 pr-4">
                      <span className="text-xs font-mono text-text">
                        {t.value ? '$' + formatNumber(t.value) : '—'}
                      </span>
                    </td>
                    <td className="py-2.5">
                      <span className="text-xs text-muted">{timeAgo(t.filingDate ?? t.transactionDate)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-xs text-muted text-center py-8">
            No insider trades found. Finnhub free tier may not return transaction types for all symbols.
          </p>
        )}
      </div>
    </AppShell>
  );
}
