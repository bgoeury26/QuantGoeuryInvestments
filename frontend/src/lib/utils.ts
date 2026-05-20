import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(n: number, decimals = 2): string {
  if (Math.abs(n) >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (Math.abs(n) >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (Math.abs(n) >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toFixed(decimals);
}

export function formatPct(n: number): string {
  const sign = n >= 0 ? '+' : '';
  return `${sign}${n.toFixed(2)}%`;
}

export function formatCurrency(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(n);
}

export function scoreColor(score: number): string {
  if (score >= 7.5) return 'text-success';
  if (score >= 5.5) return 'text-warning';
  return 'text-danger';
}

export function scoreBarColor(score: number): string {
  if (score >= 7.5) return 'bg-success';
  if (score >= 5.5) return 'bg-warning';
  return 'bg-danger';
}

export function signalBadgeClass(signal: string): string {
  switch (signal) {
    case 'ACCUMULATION': return 'badge-success';
    case 'MOMENTUM_IGNITION': return 'badge-primary';
    case 'SENTIMENT_PUMP': return 'badge-warning';
    case 'SMART_MONEY_ENTRY': return 'badge-purple';
    case 'RISK_WARNING': return 'badge-danger';
    default: return 'badge-muted';
  }
}

export function timeAgo(date: string | Date): string {
  const d = new Date(date);
  const now = new Date();
  const diff = (now.getTime() - d.getTime()) / 1000;
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}
