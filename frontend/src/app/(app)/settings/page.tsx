'use client';
import AppShell from '@/components/layout/AppShell';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useState, useEffect } from 'react';
import {
  Eye, EyeOff, CheckCircle2, XCircle, Loader2, Save,
  Zap, Activity, Globe, Radio, BarChart2, TrendingUp, AlertCircle,
} from 'lucide-react';

interface ApiField {
  key:         string;
  label:       string;
  provider:    string;
  placeholder: string;
  icon:        React.ReactNode;
  color:       string;
  free:        boolean;
  link:        string;
  testable:    boolean;
}

const FIELDS: ApiField[] = [
  { key: 'fmp',          label: 'Financial Modeling Prep',  provider: 'fmp',     placeholder: 'fmp_xxxxxxxxxxxxxxxx', icon: <BarChart2  className="w-4 h-4" />, color: 'cyan',    free: true,  link: 'https://financialmodelingprep.com/developer/docs',  testable: true },
  { key: 'finnhub',      label: 'Finnhub',                  provider: 'finnhub', placeholder: 'ct_xxxxxxxxxxxxxxxx', icon: <TrendingUp className="w-4 h-4" />, color: 'primary', free: true,  link: 'https://finnhub.io/register',                       testable: true },
  { key: 'polygon',      label: 'Polygon.io',               provider: 'polygon', placeholder: 'xxxxxxxxxxxxxxxxxxxx', icon: <Activity   className="w-4 h-4" />, color: 'purple',  free: true,  link: 'https://polygon.io/dashboard/signup',               testable: false },
  { key: 'alphaVantage', label: 'Alpha Vantage',            provider: 'av',      placeholder: 'XXXXXXXXXXXXXXXX',    icon: <Zap        className="w-4 h-4" />, color: 'warning', free: true,  link: 'https://www.alphavantage.co/support/#api-key',      testable: false },
  { key: 'newsApi',      label: 'NewsAPI',                  provider: 'newsapi', placeholder: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', icon: <Globe  className="w-4 h-4" />, color: 'success', free: true,  link: 'https://newsapi.org/register',                     testable: true },
  { key: 'fred',         label: 'FRED (St. Louis Fed)',     provider: 'fred',    placeholder: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', icon: <BarChart2 className="w-4 h-4" />, color: 'gold',  free: true, link: 'https://fred.stlouisfed.org/docs/api/api_key.html',testable: true },
  { key: 'reddit',       label: 'Reddit Client ID',         provider: 'reddit',  placeholder: 'xxxxxxxxxxxxxxxxxxxx', icon: <Radio     className="w-4 h-4" />, color: 'warning', free: true,  link: 'https://www.reddit.com/prefs/apps',                 testable: false },
  { key: 'bluesky',      label: 'Bluesky Identifier',       provider: 'bluesky', placeholder: 'user.bsky.social',    icon: <Globe     className="w-4 h-4" />, color: 'primary', free: true,  link: 'https://bsky.app',                                  testable: false },
];

const COLOR_MAP: Record<string, string> = {
  cyan:    'text-[var(--color-cyan)]    bg-[rgba(79,152,163,0.12)]',
  primary: 'text-[var(--color-primary)] bg-[rgba(59,130,246,0.12)]',
  purple:  'text-[var(--color-purple)]  bg-[rgba(139,92,246,0.12)]',
  warning: 'text-[var(--color-warning)] bg-[rgba(245,158,11,0.12)]',
  success: 'text-[var(--color-success)] bg-[rgba(16,185,129,0.12)]',
  gold:    'text-[var(--color-gold)]    bg-[rgba(234,179,8,0.12)]',
  danger:  'text-[var(--color-danger)]  bg-[rgba(239,68,68,0.12)]',
};

type StatusMap = Record<string, 'idle' | 'testing' | 'ok' | 'error'>;

export default function SettingsPage() {
  const qc = useQueryClient();
  const [form, setForm]       = useState<Record<string, string>>({});
  const [show, setShow]       = useState<Record<string, boolean>>({});
  const [status, setStatus]   = useState<StatusMap>({});
  const [gdelt, setGdelt]     = useState(true);
  const [saved, setSaved]     = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn:  () => api.get('/settings').then(r => r.data),
  });

  useEffect(() => {
    if (data) {
      setForm(data);
      setGdelt(data.gdeltEnabled ?? true);
    }
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: (payload: any) => api.post('/settings', payload),
    onSuccess: () => {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      qc.invalidateQueries({ queryKey: ['settings'] });
    },
  });

  const testProvider = async (provider: string, fieldKey: string) => {
    setStatus(s => ({ ...s, [fieldKey]: 'testing' }));
    try {
      const { data: res } = await api.post(`/settings/test/${provider}`);
      setStatus(s => ({ ...s, [fieldKey]: res.ok ? 'ok' : 'error' }));
    } catch {
      setStatus(s => ({ ...s, [fieldKey]: 'error' }));
    }
  };

  const handleSave = () => {
    saveMutation.mutate({ ...form, gdeltEnabled: gdelt });
  };

  const StatusIcon = ({ s }: { s: string }) => {
    if (s === 'testing') return <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--color-muted)]" />;
    if (s === 'ok')      return <CheckCircle2 className="w-3.5 h-3.5 text-[var(--color-success)]" />;
    if (s === 'error')   return <XCircle className="w-3.5 h-3.5 text-[var(--color-danger)]" />;
    return null;
  };

  return (
    <AppShell title="Settings">
      <div className="max-w-3xl mx-auto space-y-4">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-[var(--color-text)]">API Configuration</h2>
            <p className="text-xs text-[var(--color-muted)] mt-0.5">Keys are encrypted with AES-256-CBC before storage. Never sent in plaintext.</p>
          </div>
          <button onClick={handleSave} disabled={saveMutation.isPending}
            className="btn-primary flex items-center gap-2 h-9 px-5">
            {saveMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            {saved ? 'Saved ✓' : 'Save All'}
          </button>
        </div>

        {/* Saved banner */}
        {saved && (
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[rgba(16,185,129,0.1)] border border-[rgba(16,185,129,0.2)] text-[var(--color-success)] text-xs animate-fade-in">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Configuration saved and encrypted successfully.
          </div>
        )}

        {/* API Fields */}
        {isLoading ? (
          <div className="space-y-3">{[...Array(6)].map((_,i) => <div key={i} className="skeleton h-20 w-full" />)}</div>
        ) : (
          <div className="space-y-2">
            {FIELDS.map(f => (
              <div key={f.key} className="card p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {/* Icon */}
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${COLOR_MAP[f.color]}`}>
                      {f.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-xs font-semibold text-[var(--color-text)]">{f.label}</span>
                        <span className="badge badge-success text-[10px] py-0">FREE</span>
                        <a href={f.link} target="_blank" rel="noopener noreferrer"
                          className="text-[10px] text-[var(--color-muted)] hover:text-[var(--color-cyan)] transition-colors">Get key ↗</a>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                          <input
                            type={show[f.key] ? 'text' : 'password'}
                            value={form[f.key] ?? ''}
                            onChange={e => setForm(v => ({ ...v, [f.key]: e.target.value }))}
                            placeholder={form[f.key] ? '(configured)' : f.placeholder}
                            className="input text-xs h-8 pr-9 font-mono"
                          />
                          <button
                            onClick={() => setShow(s => ({ ...s, [f.key]: !s[f.key] }))}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--color-muted)] hover:text-[var(--color-text)]">
                            {show[f.key] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                        {f.testable && (
                          <button
                            onClick={() => testProvider(f.provider, f.key)}
                            disabled={status[f.key] === 'testing'}
                            className="shrink-0 px-3 h-8 rounded-lg text-xs font-medium border border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-text)] hover:border-[var(--color-border-bright)] transition-all flex items-center gap-1.5">
                            <StatusIcon s={status[f.key] ?? 'idle'} />
                            Test
                          </button>
                        )}
                        <div className="w-4 flex items-center justify-center">
                          <StatusIcon s={status[f.key] ?? 'idle'} />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* GDELT Toggle */}
        <div className="card p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-[rgba(79,152,163,0.12)] text-[var(--color-cyan)]"><Globe className="w-4 h-4" /></div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-[var(--color-text)]">GDELT Project</span>
                  <span className="badge badge-cyan text-[10px] py-0">NO KEY NEEDED</span>
                </div>
                <p className="text-[10px] text-[var(--color-muted)] mt-0.5">Global news sentiment analysis. Free, no API key required.</p>
              </div>
            </div>
            <button
              onClick={() => setGdelt(!gdelt)}
              className={`relative w-10 h-5 rounded-full transition-colors duration-200 ${gdelt ? 'bg-[var(--color-cyan)]' : 'bg-[var(--color-surface-3)]'}`}>
              <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${gdelt ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
          </div>
        </div>

        {/* Info card */}
        <div className="flex items-start gap-3 px-4 py-3 rounded-lg bg-[rgba(59,130,246,0.06)] border border-[rgba(59,130,246,0.15)]">
          <AlertCircle className="w-4 h-4 text-[var(--color-primary)] mt-0.5 shrink-0" />
          <div className="text-[11px] text-[var(--color-muted)] space-y-0.5">
            <p className="font-medium text-[var(--color-text)]">Security &amp; Cost Notes</p>
            <p>All keys encrypted AES-256-CBC server-side. Never stored in plaintext. SEC EDGAR, GDELT, and Reddit require no keys.</p>
            <p>Target monthly cost: <strong className="text-[var(--color-cyan)]">FREE — &lt;€5</strong> with smart caching (FMP free tier: 250 req/day, Finnhub: 60 req/min).</p>
          </div>
        </div>

      </div>
    </AppShell>
  );
}
