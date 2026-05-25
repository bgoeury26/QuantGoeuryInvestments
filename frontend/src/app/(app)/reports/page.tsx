'use client';
import AppShell from '@/components/layout/AppShell';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { FileText, Download, Plus } from 'lucide-react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { timeAgo } from '@/lib/utils';

export default function ReportsPage() {
  const [generating, setGenerating] = useState<string | null>(null);
  const [symbol, setSymbol] = useState('');
  const router = useRouter();

  const { data: reports, isLoading, refetch } = useQuery({
    queryKey: ['reports'],
    queryFn: () => api.get('/reports').then(r => r.data),
  });

  const generateReport = async () => {
    if (!symbol.trim()) return;
    setGenerating(symbol.toUpperCase());
    try {
      await api.post('/reports/generate', { symbol: symbol.toUpperCase() });
      refetch();
    } finally {
      setGenerating(null);
      setSymbol('');
    }
  };

  const downloadPdf = async (reportId: string) => {
    const { data } = await api.get(`/reports/${reportId}/download`, { responseType: 'blob' });
    const url = window.URL.createObjectURL(new Blob([data]));
    const a = document.createElement('a');
    a.href = url; a.download = `report-${reportId}.pdf`; a.click();
  };

  return (
    <AppShell title="Reports">
      <div className="flex items-center gap-3 mb-6">
        <input value={symbol} onChange={e => setSymbol(e.target.value)}
          placeholder="Enter ticker (e.g. AAPL)" className="input w-56 h-9 text-sm" />
        <button onClick={generateReport} disabled={!!generating || !symbol.trim()}
          className="btn-primary h-9 flex items-center gap-2">
          {generating ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Plus className="w-4 h-4" />}
          Generate Report
        </button>
      </div>

      <div className="card p-5">
        <h2 className="text-sm font-semibold text-text mb-4">Generated Reports</h2>
        {isLoading ? <p className="text-xs text-muted">Loading...</p>
         : reports?.length === 0 ? (
           <div className="text-center py-12">
             <FileText className="w-8 h-8 text-faint mx-auto mb-3" />
             <p className="text-sm text-muted">No reports yet. Generate your first report above.</p>
           </div>
         ) : (
          <div className="space-y-2">
            {reports?.map((r: {id: string; symbol: string; title: string; createdAt: string; pdfPath: string | null}) => (
              <div key={r.id} className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-surface-2 transition-colors">
                <div className="flex items-center gap-3">
                  <FileText className="w-4 h-4 text-primary" />
                  <div>
                    <p className="text-sm font-medium text-text">{r.title}</p>
                    <p className="text-xs text-muted">{r.symbol} • {timeAgo(r.createdAt)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => router.push(`/analysis/${r.symbol}`)} className="btn-ghost h-8 text-xs">View</button>
                  {r.pdfPath && (
                    <button onClick={() => downloadPdf(r.id)} className="btn-ghost h-8 flex items-center gap-1.5 text-xs">
                      <Download className="w-3.5 h-3.5" /> PDF
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
