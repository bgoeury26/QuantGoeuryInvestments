import React from 'react';

function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

const SIGNAL_LABELS: Record<string, string> = {
  ACCUMULATION: 'Accumulation',
  MOMENTUM_IGNITION: 'Momentum',
  SENTIMENT_PUMP: 'Sentiment',
  SMART_MONEY_ENTRY: 'Smart Money',
  RISK_WARNING: 'Risk ⚠',
  UNKNOWN: 'Signal',
};

const SIGNAL_CLASSES: Record<string, string> = {
  ACCUMULATION: 'badge-primary',
  MOMENTUM_IGNITION: 'badge-warning',
  SENTIMENT_PUMP: 'badge-purple',
  SMART_MONEY_ENTRY: 'badge-success',
  RISK_WARNING: 'badge-danger',
  UNKNOWN: 'badge-muted',
};

export default function SignalBadge({
  signal,
  earlyFlag,
}: {
  signal?: string;
  earlyFlag?: boolean;
}) {
  const key = signal ?? 'UNKNOWN';
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className={cn('badge', SIGNAL_CLASSES[key] ?? 'badge-muted')}>
        {SIGNAL_LABELS[key] ?? key}
      </span>
      {earlyFlag && (
        <span className="badge bg-cyan/15 text-cyan animate-pulse-slow">
          Early Signal
        </span>
      )}
    </div>
  );
}
