import { cn, signalBadgeClass } from '@/lib/utils';

const SIGNAL_LABELS: Record<string, string> = {
  ACCUMULATION: 'Accumulation',
  MOMENTUM_IGNITION: 'Momentum',
  SENTIMENT_PUMP: 'Sentiment',
  SMART_MONEY_ENTRY: 'Smart Money',
  RISK_WARNING: 'Risk Warning',
  NEUTRAL: 'Neutral',
};

export default function SignalBadge({ signal, earlyFlag }: { signal: string; earlyFlag?: boolean }) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className={cn('badge', signalBadgeClass(signal))}>{SIGNAL_LABELS[signal] ?? signal}</span>
      {earlyFlag && <span className="badge bg-cyan/15 text-cyan animate-pulse-slow">⚡ Early Signal</span>}
    </div>
  );
}
