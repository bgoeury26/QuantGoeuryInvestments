'use client';
import AppShell from '@/components/layout/AppShell';
import { Search } from 'lucide-react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AnalysisIndexPage() {
  const [query, setQuery] = useState('');
  const router = useRouter();

  const POPULAR = ['AAPL','NVDA','MSFT','TSLA','AMZN','META','GOOGL','SPY','QQQ','BRK.B'];

  return (
    <AppShell title="Analysis">
      <div className="max-w-2xl mx-auto py-12">
        <h2 className="text-lg font-semibold text-text mb-2">Stock Analysis</h2>
        <p className="text-sm text-muted mb-6">Enter a ticker symbol to run the full scoring + alpha engine analysis.</p>
        <form onSubmit={(e) => { e.preventDefault(); if (query.trim()) router.push(`/analysis/${query.trim().toUpperCase()}`); }}
          className="flex gap-2 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
            <input value={query} onChange={e => setQuery(e.target.value)}
              placeholder="AAPL, NVDA, TSLA..." className="input pl-10 h-11 text-sm" />
          </div>
          <button type="submit" className="btn-primary h-11 px-6">Analyse</button>
        </form>
        <div>
          <p className="text-xs text-muted mb-3">Popular tickers</p>
          <div className="flex flex-wrap gap-2">
            {POPULAR.map(t => (
              <button key={t} onClick={() => router.push(`/analysis/${t}`)}
                className="px-3 py-1.5 rounded-lg border border-border text-xs font-mono text-muted hover:text-text hover:border-border-bright hover:bg-surface-2 transition-all">
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
