'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  BarChart2,
  Waves,
  Zap,
  FileText,
  Settings,
  TrendingUp,
  ShieldCheck,
  LogOut,
} from 'lucide-react';
import { useAuthStore } from '../../store/auth.store';

function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

const NAV_ITEMS = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/analysis', icon: BarChart2, label: 'Analysis' },
  { href: '/flows', icon: Waves, label: 'Flows' },
  { href: '/opportunities', icon: Zap, label: 'Opportunities' },
  { href: '/reports', icon: FileText, label: 'Reports' },
  { href: '/settings', icon: Settings, label: 'Settings' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuthStore();

  return (
    <aside className="w-56 shrink-0 border-r border-border bg-surface flex flex-col h-screen sticky top-0">
      {/* Logo */}
      <div className="px-4 py-4 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-primary rounded-lg flex items-center justify-center">
            <TrendingUp className="w-4 h-4 text-white" />
          </div>
          <span className="text-sm font-semibold text-text">QuantGoeury</span>
        </div>
      </div>

      {/* Main Nav */}
      <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map(({ href, icon: Icon, label }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              pathname.startsWith(href) ? 'nav-item-active' : 'nav-item',
            )}
          >
            <Icon className="w-4 h-4 shrink-0" />
            {label}
          </Link>
        ))}

        {user?.isAdmin && (
          <div className="mt-4 pt-4 border-t border-border space-y-0.5">
            <Link
              href="/admin"
              className={cn(
                pathname.startsWith('/admin') ? 'nav-item-active' : 'nav-item',
              )}
            >
              <ShieldCheck className="w-4 h-4 shrink-0" />
              Admin Panel
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-primary" />
            </Link>
          </div>
        )}
      </nav>

      {/* Logout */}
      <div className="px-3 py-3 border-t border-border">
        <div className="flex items-center gap-2 mb-2 px-2">
          <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-xs font-semibold text-primary">
            {user?.name?.[0]?.toUpperCase() ?? 'U'}
          </div>
          <div className="overflow-hidden">
            <p className="text-xs font-medium text-text truncate">{user?.name}</p>
            <p className="text-10px text-muted truncate">{user?.email}</p>
          </div>
        </div>
        <button onClick={logout} className="nav-item w-full text-left text-danger hover:text-danger hover:bg-danger/10">
          <LogOut className="w-4 h-4 shrink-0" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
