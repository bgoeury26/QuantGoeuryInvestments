import React from 'react';

function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

function scoreBarColor(score: number): string {
  if (score >= 7) return 'bg-success';
  if (score >= 5) return 'bg-warning';
  return 'bg-danger';
}

function scoreColor(score: number): string {
  if (score >= 7) return 'text-success';
  if (score >= 5) return 'text-warning';
  return 'text-danger';
}

export default function ScoreBar({
  score,
  max = 10,
  showLabel = true,
}: {
  score: number;
  max?: number;
  showLabel?: boolean;
}) {
  const pct = Math.min((score / max) * 100, 100);
  return (
    <div className="w-full">
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 bg-surface-2 rounded-full overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all', scoreBarColor(score))}
            style={{ width: `${pct}%` }}
          />
        </div>
        {showLabel && (
          <span
            className={cn(
              'text-xs font-semibold w-8 text-right tabular-nums',
              scoreColor(score),
            )}
          >
            {score.toFixed(1)}
          </span>
        )}
      </div>
    </div>
  );
}
