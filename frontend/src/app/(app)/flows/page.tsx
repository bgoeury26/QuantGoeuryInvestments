'use client';
import AppShell from '@/components/layout/AppShell';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import SkeletonCard from '@/components/ui/SkeletonCard';
import { formatNumber, timeAgo } from '@/lib/utils';
import { Building2, Users, Flag } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts';

export default function FlowsPage() {
  const { data: flowsRaw, isLoading } = useQuery({
    queryKey: ['flows'],
    queryFn: () => api.get('/flows/summary').then(r => r.data),
  });
  const { data: insidersRaw } = useQuery({
    queryKey: ['insider-trades'],
    queryFn: () => api.get('/flows/insider-trades?limit=20').then(r => r.data),
  });
  const { data: politicalRaw } = useQuery({
    queryKey: ['political'],
    queryFn: () => api.get('/flows/political').then(r => r.data),
  });

  // API returns { summaries: [{symbol, institutional:{buying,selling}, insider:{buying,selling}, signal}] }
  // Transform into chart-friendly { symbol, netFlow } shape
  const institutionalChart = (flowsRaw?.summaries ?? []).map((s: any) => ({
    symbol: s.symbol,
    netFlow: (s.institutional?.buying ?? 0) - (s.institutional?.selling ?? 0),
  }));

  // API returns { trades: [{name, transactionType, shares, value, transactionDate, filingDate, symbol}] }
  const insiders: any[] = insidersRaw?.trades ?? [];

  // API returns { trades: [], note: string }
  const political: any[] = politicalRaw?.trades ?? [];

  return (
    <AppShell title="Flows Intelligence">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        {/* Institutional Flows */}
        <div className="card p-5 lg:col-span-2">
          <div className="flex items-center gap-2 mb-4">
            <Building2 className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold text-text">Institutional Net Flows (Top 10)</h2>
          </div>
          {isLoading ? <SkeletonCard rows={4} /> : institutionalChart.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={institutionalChart} margin={{ left: -10 }}>
                <XAxis dataKey="symbol" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: '#0f1117', border: '1px solid #1e2435', borderRadius: 8, fontSize: 11 }} />
                <Bar dataKey="netFlow" radius={[4, 4, 0, 0]}>
                  {institutionalChart.map((entry: { netFlow: number }, index: number) => (
                    <Cell key={index} fill={entry.netFlow >= 0 ? '#10b981' : '#ef4444'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-xs text-muted text-center py-8">No institutional flow data yet. Flows load when stocks are tracked.</p>}
        </div>

        {/* Political Trades */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Flag className="w-4 h-4 text-warning" />
            <h2 className="text-sm font-semibold text-text">Political Signals</h2>
          </div>
          {political.length > 0 ? (
            <div className="space-y-3">
              {political.slice(0, 6).map((p: { politician: string; ticker: string; type: string; amount: string; date: string }, i: number) => (
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

      {/* Insider Trades */}
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Users className="w-4 h-4 text-purple" />
          <h2 className="text-sm font-semibold text-text">Insider Transactions</h2>
        </div>
        {insiders.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  {['Symbol', 'Insider', 'Transaction', 'Shares', 'Value', 'Date'].map(h => (
                    <th key={h} className="table-header text-left pb-2 pr-4">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {insiders.map((t: { symbol: string; name: string; transactionType: string; shares: number; value: number; transactionDate: string; filingDate: string }, i: number) => (
                  <tr key={i} className="border-b border-border/30 hover:bg-surface-2/50">
                    <td className="py-2.5 pr-4"><span className="font-mono text-sm font-semibold text-text">{t.symbol}</span></td>
                    <td className="py-2.5 pr-4"><span className="text-xs text-text">{t.name}</span></td>
                    <td className="py-2.5 pr-4">
                      <span className={`badge ${t.transactionType === 'BUY' ? 'badge-success' : 'badge-danger'}`}>{t.transactionType}</span>
                    </td>
                    <td className="py-2.5 pr-4"><span className="text-xs font-mono text-muted">{formatNumber(t.shares)}</span></td>
                    <td className="py-2.5 pr-4"><span className="text-xs font-mono text-text">${formatNumber(t.value)}</span></td>
                    <td className="py-2.5"><span className="text-xs text-muted">{timeAgo(t.filingDate ?? t.transactionDate)}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-xs text-muted text-center py-8">
            No insider trades loaded yet. Add stocks to your watchlist to populate data.
          </p>
        )}
      </div>
    </AppShell>
  );
}
