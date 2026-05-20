'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth.store';
import {
  LayoutDashboard, Search, Activity, Zap, BarChart2,
  Settings, LogOut, TrendingUp, ShieldCheck, FileText
} from 'lucide-react';

const NAV = [
  { href: '/dashboard',     icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/analysis',      icon: Search,           label: 'Analysis' },
  { href: '/flows',         icon: Activity,         label: 'Flows' },
  { href: '/opportunities', icon: Zap,              label: 'Opportunities' },
  { href: '/reports',       icon: FileText,         label: 'Reports' },
];

const BOTTOM_NAV = [
  { href: '/settings', icon: Settings, label: 'Settings' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuthStore();

  return (
    <aside className="fixed left-0 top-0 h-screen w-56 bg-surface border-r border-border flex flex-col z-40">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 py-4 border-b border-border">
        <div className="w-7 h-7 bg-primary rounded-md flex items-center justify-center shrink-0">
          <TrendingUp className="w-3.5 h-3.5 text-white" />
        </div>
        <div>
          <p className="text-xs font-semibold text-text leading-tight">QuantGoeury</p>
          <p className="text-[10px] text-muted leading-tight">Investments</p>
        </div>
      </div>

      {/* Main Nav */}
      <nav className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto">
        <p className="section-title px-3">Platform</p>
        {NAV.map(({ href, icon: Icon, label }) => (
          <Link key={href} href={href}
            className={cn(pathname.startsWith(href) ? 'nav-item-active' : 'nav-item')}>
            <Icon className="w-4 h-4 shrink-0" />
            {label}
          </Link>
        ))}

        {user?.role === 'ADMIN' && (
          <>
            <p className="section-title px-3 mt-4">Admin</p>
            <Link href="/admin"
              className={cn(pathname.startsWith('/admin') ? 'nav-item-active' : 'nav-item')}>
              <ShieldCheck className="w-4 h-4 shrink-0" />
              Admin Panel
            </Link>
          </>
        )}

        <div className="mt-4 pt-4 border-t border-border space-y-0.5">
          {BOTTOM_NAV.map(({ href, icon: Icon, label }) => (
            <Link key={href} href={href}
              className={cn(pathname.startsWith(href) ? 'nav-item-active' : 'nav-item')}>
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </Link>
          ))}
          <button onClick={logout} className="nav-item w-full text-left text-danger hover:text-danger hover:bg-danger/10">
            <LogOut className="w-4 h-4 shrink-0" />
            Sign out
          </button>
        </div>
      </nav>

      {/* User */}
      {user && (
        <div className="px-3 py-3 border-t border-border">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-xs font-semibold text-primary">
              {user.name[0].toUpperCase()}
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-medium text-text truncate">{user.name}</p>
              <p className="text-[10px] text-muted truncate">{user.email}</p>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
