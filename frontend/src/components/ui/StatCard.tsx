import React from 'react';
import type { LucideIcon } from 'lucide-react';

function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

const COLOR_MAP: Record<string, string> = {
  primary: 'bg-primary/10 text-primary',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  danger: 'bg-danger/10 text-danger',
  muted: 'bg-surface-2 text-muted',
};

export default function StatCard({
  label,
  value,
  subValue,
  icon: Icon,
  color = 'primary',
  trend,
}: {
  label: string;
  value: string | number;
  subValue?: string;
  icon?: LucideIcon;
  color?: string;
  trend?: 'up' | 'down';
}) {
  return (
    <div className="stat-card">
      <div className="flex items-start justify-between">
        <p className="text-xs text-muted">{label}</p>
        {Icon && (
          <div
            className={cn(
              'w-7 h-7 rounded-lg flex items-center justify-center',
              COLOR_MAP[color] ?? COLOR_MAP.primary,
            )}
          >
            <Icon className="w-4 h-4" />
          </div>
        )}
      </div>
      <p className="text-2xl font-bold text-text tabular-nums mt-2">{value}</p>
      {subValue && (
        <p
          className={cn(
            'text-xs mt-1',
            trend === 'up'
              ? 'text-success'
              : trend === 'down'
              ? 'text-danger'
              : 'text-muted',
          )}
        >
          {subValue}
        </p>
      )}
    </div>
  );
}
