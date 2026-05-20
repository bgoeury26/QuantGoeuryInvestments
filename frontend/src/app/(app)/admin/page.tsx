'use client';
import AppShell from '@/components/layout/AppShell';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useState } from 'react';
import { CheckCircle2, XCircle, AlertCircle, Users, ShieldCheck, Clock, Ban } from 'lucide-react';
import { cn, timeAgo } from '@/lib/utils';

type UserStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';

interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: string;
  status: UserStatus;
  createdAt: string;
}

const statusConfig: Record<UserStatus, { label: string; icon: React.ReactNode; cls: string }> = {
  PENDING:   { label: 'Pending',   icon: <Clock       className="w-3.5 h-3.5" />, cls: 'text-warning  bg-warning/10  border-warning/30'  },
  APPROVED:  { label: 'Approved',  icon: <CheckCircle2 className="w-3.5 h-3.5" />, cls: 'text-success  bg-success/10  border-success/30'  },
  REJECTED:  { label: 'Rejected',  icon: <XCircle      className="w-3.5 h-3.5" />, cls: 'text-danger   bg-danger/10   border-danger/30'   },
  SUSPENDED: { label: 'Suspended', icon: <Ban          className="w-3.5 h-3.5" />, cls: 'text-muted    bg-muted/10    border-muted/30'    },
};

export default function AdminPage() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<UserStatus | 'ALL'>('ALL');

  const { data: users = [], isLoading } = useQuery<AdminUser[]>({
    queryKey: ['admin-users'],
    queryFn:  () => api.get('/admin/users').then(r => r.data),
  });

  const mutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: string }) =>
      api.post(`/admin/users/${id}/${action}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  });

  const filtered = filter === 'ALL' ? users : users.filter(u => u.status === filter);

  const counts = {
    ALL:       users.length,
    PENDING:   users.filter(u => u.status === 'PENDING').length,
    APPROVED:  users.filter(u => u.status === 'APPROVED').length,
    REJECTED:  users.filter(u => u.status === 'REJECTED').length,
    SUSPENDED: users.filter(u => u.status === 'SUSPENDED').length,
  };

  return (
    <AppShell title="Admin Panel">
      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {([
          { key: 'PENDING',  label: 'Awaiting approval', icon: <Clock       className="w-4 h-4 text-warning"  />, count: counts.PENDING  },
          { key: 'APPROVED', label: 'Active users',       icon: <CheckCircle2 className="w-4 h-4 text-success"  />, count: counts.APPROVED },
          { key: 'REJECTED', label: 'Rejected',           icon: <XCircle      className="w-4 h-4 text-danger"   />, count: counts.REJECTED },
          { key: 'ALL',      label: 'Total registered',   icon: <Users        className="w-4 h-4 text-primary"  />, count: counts.ALL      },
        ] as const).map(s => (
          <button key={s.key} onClick={() => setFilter(s.key)}
            className={cn('card p-4 text-left transition-all', filter === s.key ? 'border-primary/50 bg-primary/5' : 'hover:border-border-bright')}>
            <div className="flex items-center justify-between mb-1">
              {s.icon}
              <span className="text-xl font-bold text-text tabular-nums">{s.count}</span>
            </div>
            <p className="text-xs text-muted">{s.label}</p>
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold text-text">
              {filter === 'ALL' ? 'All Users' : `${statusConfig[filter as UserStatus]?.label} Users`}
            </h2>
          </div>
          {counts.PENDING > 0 && (
            <span className="flex items-center gap-1 text-xs text-warning">
              <AlertCircle className="w-3.5 h-3.5" />
              {counts.PENDING} pending approval
            </span>
          )}
        </div>

        {isLoading ? (
          <div className="p-6 space-y-3">
            {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-12 w-full" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <Users className="w-8 h-8 text-faint mx-auto mb-3" />
            <p className="text-sm text-muted">No users in this category</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map(user => {
              const cfg = statusConfig[user.status];
              const pending = mutation.isPending;
              return (
                <div key={user.id} className="flex items-center gap-4 px-5 py-3 hover:bg-surface-2 transition-colors">
                  {/* Avatar */}
                  <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                    {user.name[0]?.toUpperCase()}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-text truncate">{user.name}</p>
                      {user.role === 'ADMIN' && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-semibold">ADMIN</span>
                      )}
                    </div>
                    <p className="text-xs text-muted truncate">{user.email} &middot; joined {timeAgo(user.createdAt)}</p>
                  </div>

                  {/* Status badge */}
                  <span className={cn('flex items-center gap-1 text-xs px-2 py-1 rounded-lg border font-medium shrink-0', cfg.cls)}>
                    {cfg.icon} {cfg.label}
                  </span>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {user.status === 'PENDING' && (
                      <>
                        <button
                          onClick={() => mutation.mutate({ id: user.id, action: 'approve' })}
                          disabled={pending}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-success/10 text-success hover:bg-success/20 border border-success/30 transition-colors disabled:opacity-50">
                          Approve
                        </button>
                        <button
                          onClick={() => mutation.mutate({ id: user.id, action: 'reject' })}
                          disabled={pending}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-danger/10 text-danger hover:bg-danger/20 border border-danger/30 transition-colors disabled:opacity-50">
                          Reject
                        </button>
                      </>
                    )}
                    {user.status === 'APPROVED' && (
                      <button
                        onClick={() => mutation.mutate({ id: user.id, action: 'suspend' })}
                        disabled={pending}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-warning/10 text-warning hover:bg-warning/20 border border-warning/30 transition-colors disabled:opacity-50">
                        Suspend
                      </button>
                    )}
                    {(user.status === 'REJECTED' || user.status === 'SUSPENDED') && (
                      <button
                        onClick={() => mutation.mutate({ id: user.id, action: 'approve' })}
                        disabled={pending}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-success/10 text-success hover:bg-success/20 border border-success/30 transition-colors disabled:opacity-50">
                        Re-approve
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
