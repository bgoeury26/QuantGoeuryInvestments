'use client';

import React, { useState } from 'react';
import { Bell, Search } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function TopBar({ title }: { title: string }) {
  const [query, setQuery] = useState('');
  const router = useRouter();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/analysis/${query.trim().toUpperCase()}`);
      setQuery('');
    }
  };

  return (
    <header className="h-14 border-b border-border bg-surface/80 backdrop-blur-sm flex items-center justify-between px-6 sticky top-0 z-30">
      <h1 className="text-sm font-semibold text-text">{title}</h1>
      <div className="flex items-center gap-3">
        <form onSubmit={handleSearch} className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search ticker..."
            className="input pl-8 h-8 w-48 text-xs"
          />
        </form>
        <button className="relative p-2 rounded-lg text-muted hover:text-text hover:bg-surface-2 transition-all">
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-primary" />
        </button>
      </div>
    </header>
  );
}
