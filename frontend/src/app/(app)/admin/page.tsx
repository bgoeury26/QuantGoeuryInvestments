'use client';
import AppShell from '@/components/layout/AppShell';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { CheckCircle2, XCircle, Clock, ShieldCheck, Users, AlertTriangle, RefreshCw } from 'lucide-react';
import { cn, timeAgo } from '@/lib/utils';
import { useAuthStore } from '@/store/auth.store';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  PENDING:   { label: 'Pending',   color: 'text-warning bg-warning/10 border-warning/20',  icon: Clock },
  APPROVED:  { label: 'Approved',  color: 'text-success bg-success/10 border-success/20',  icon: CheckCircle2 },
  REJECTED:  { label: 'Rejected',  color: 'text-danger  bg-danger/10  border-danger/20',   icon: XCircle },
  SUSPENDED: { label: 'Suspended', color: 'text-muted   bg-surface-3  border-border',       icon: AlertTriangle },
};

export default function AdminPage() {
  const { user } = useAuthStore();
  const router = useRouter();
  const qc = useQueryClient();

  // Only admins can access this page
  useEffect(() => {
    if (user && user.role !== 'ADMIN') router.replace('/dashboard');
  }, [user, router]);

  const { data: users, isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => api.get('/admin/users').then(r => r.data),
    refetchInterval: 30000,
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => api.post(`/admin/users/${id}/approve`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => api.post(`/admin/users/${id}/reject`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  });

  const suspendMutation = useMutation({
    mutationFn: (id: string) => api.post(`/admin/users/${id}/suspend`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  });

  const pending  = users?.filter((u: any) => u.status === 'PENDING')  ?? [];
  const approved = users?.filter((u: any) => u.status === 'APPROVED') ?? [];
  const others   = users?.filter((u: any) => u.status !== 'PENDING' && u.status !== 'APPROVED') ?? [];

  const UserRow = ({ u }: { u: any }) => {
    const cfg = STATUS_CONFIG[u.status] ?? STATUS_CONFIG.PENDING;
    const Icon = cfg.icon;
    const isPending = u.status === 'PENDING';
    const isApproved = u.status === 'APPROVED';
    const isAdmin = u.role === 'ADMIN';

    return (
      <div className={cn(
        'flex items-center justify-between p-3.5 rounded-xl border transition-colors',
        isPending ? 'border-warning/30 bg-warning/5' : 'border-border bg-surface hover:bg-surface-2'
      )}>
        <div className="flex items-center gap-3">
          <div className={cn('w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0',
            isAdmin ? 'bg-primary/20 text-primary' : 'bg-surface-3 text-muted')}>
            {u.name?.[0]?.toUpperCase() ?? '?'}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-text">{u.name}</p>
              {isAdmin && <span className="text-[10px] font-bold uppercase tracking-wider text-primary bg-primary/10 border border-primary/20 px-1.5 py-0.5 rounded">Admin</span>}
            </div>
            <p className="text-xs text-muted">{u.email} · joined {timeAgo(u.createdAt)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn('flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded border', cfg.color)}>
            <Icon className="w-3 h-3" />{cfg.label}
          </span>
          {isPending && (
            <>
              <button onClick={() => approveMutation.mutate(u.id)}
                disabled={approveMutation.isPending}
                className="h-7 px-3 rounded-lg text-xs font-medium bg-success/10 text-success border border-success/20 hover:bg-success/20 transition-colors flex items-center gap-1">
                {approveMutation.isPending ? <RefreshCw className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                Approve
              </button>
              <button onClick={() => rejectMutation.mutate(u.id)}
                disabled={rejectMutation.isPending}
                className="h-7 px-3 rounded-lg text-xs font-medium bg-danger/10 text-danger border border-danger/20 hover:bg-danger/20 transition-colors flex items-center gap-1">
                <XCircle className="w-3 h-3" /> Reject
              </button>
            </>
          )}
          {isApproved && !isAdmin && (
            <button onClick={() => suspendMutation.mutate(u.id)}
              disabled={suspendMutation.isPending}
              className="h-7 px-3 rounded-lg text-xs font-medium bg-surface-3 text-muted border border-border hover:text-danger hover:border-danger/30 transition-colors">
              Suspend
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <AppShell title="Admin Panel">
      {/* Header stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: 'Pending Approval', value: pending.length,  icon: Clock,        color: 'text-warning', bg: 'bg-warning/10' },
          { label: 'Approved Users',   value: approved.length, icon: CheckCircle2, color: 'text-success', bg: 'bg-success/10' },
          { label: 'Total Users',      value: users?.length ?? 0, icon: Users,     color: 'text-primary', bg: 'bg-primary/10' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="card p-4 flex items-center gap-3">
            <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center shrink-0', bg)}>
              <Icon className={cn('w-4 h-4', color)} />
            </div>
            <div>
              <p className="text-xl font-bold text-text tabular-nums">{value}</p>
              <p className="text-xs text-muted">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Pending section */}
      {pending.length > 0 && (
        <div className="mb-5">
          <h2 className="text-sm font-semibold text-warning flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4" /> Awaiting Approval ({pending.length})
          </h2>
          <div className="space-y-2">
            {pending.map((u: any) => <UserRow key={u.id} u={u} />)}
          </div>
        </div>
      )}

      {/* All users */}
      <div>
        <h2 className="text-sm font-semibold text-text flex items-center gap-2 mb-3">
          <ShieldCheck className="w-4 h-4 text-primary" /> All Users
        </h2>
        {isLoading ? (
          <div className="space-y-2">
            {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-16 w-full rounded-xl" />)}
          </div>
        ) : (
          <div className="space-y-2">
            {[...approved, ...others].map((u: any) => <UserRow key={u.id} u={u} />)}
          </div>
        )}
      </div>
    </AppShell>
  );
}
