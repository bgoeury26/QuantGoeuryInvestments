import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: string | number;
  subValue?: string;
  icon?: LucideIcon;
  trend?: 'up' | 'down' | 'neutral';
  color?: 'default' | 'success' | 'danger' | 'warning' | 'primary';
}

export default function StatCard({ label, value, subValue, icon: Icon, trend, color = 'default' }: StatCardProps) {
  const trendColor = trend === 'up' ? 'text-success' : trend === 'down' ? 'text-danger' : 'text-muted';
  const iconBg = {
    default:  'bg-faint/20 text-muted',
    success:  'bg-success/15 text-success',
    danger:   'bg-danger/15 text-danger',
    warning:  'bg-warning/15 text-warning',
    primary:  'bg-primary/15 text-primary',
  }[color];

  return (
    <div className="stat-card">
      <div className="flex items-start justify-between">
        <p className="text-xs text-muted">{label}</p>
        {Icon && (
          <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center', iconBg)}>
            <Icon className="w-3.5 h-3.5" />
          </div>
        )}
      </div>
      <p className="text-xl font-semibold text-text tabular-nums mt-1">{value}</p>
      {subValue && <p className={cn('text-xs', trendColor)}>{subValue}</p>}
    </div>
  );
}
