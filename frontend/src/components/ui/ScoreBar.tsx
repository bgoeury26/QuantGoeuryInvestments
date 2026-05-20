import { cn, scoreBarColor, scoreColor } from '@/lib/utils';

interface ScoreBarProps {
  score: number;
  max?: number;
  label?: string;
  showValue?: boolean;
  size?: 'sm' | 'md';
}

export default function ScoreBar({ score, max = 10, label, showValue = true, size = 'sm' }: ScoreBarProps) {
  const pct = Math.min(100, (score / max) * 100);
  const color = scoreBarColor(score);
  const textColor = scoreColor(score);
  return (
    <div className="w-full">
      {(label || showValue) && (
        <div className="flex items-center justify-between mb-1">
          {label && <span className="text-xs text-muted">{label}</span>}
          {showValue && <span className={cn('text-xs font-mono font-semibold', textColor)}>{score.toFixed(1)}</span>}
        </div>
      )}
      <div className={cn('w-full rounded-full bg-faint/30', size === 'sm' ? 'h-1.5' : 'h-2')}>
        <div
          className={cn('h-full rounded-full transition-all duration-500', color)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
