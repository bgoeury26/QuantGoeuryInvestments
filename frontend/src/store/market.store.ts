'use client';
import { create } from 'zustand';
import api from '@/lib/api';

export interface MarketSnapshot {
  symbol:        string;
  price:         number;
  change:        number;
  changePct:     number;
  volume:        number;
  marketCap?:    number;
  updatedAt:     string;
}

export interface MacroDashboard {
  fedRate:      number;
  inflation:    number;
  gdpGrowth:    number;
  unemployment: number;
  yieldCurve:   number;
  vix:          number;
  dxy:          number;
  updatedAt?:   number;
}

interface MarketState {
  watchlist:      MarketSnapshot[];
  macro:          MacroDashboard | null;
  isLoading:      boolean;
  fetchWatchlist: (symbols: string[]) => Promise<void>;
  fetchMacro:     () => Promise<void>;
}

export const useMarketStore = create<MarketState>((set) => ({
  watchlist:  [],
  macro:      null,
  isLoading:  false,

  fetchWatchlist: async (symbols) => {
    set({ isLoading: true });
    try {
      const results = await Promise.allSettled(
        symbols.map(s => api.get(`/stocks/${s}/quote`).then(r => ({ ...r.data, symbol: s })))
      );
      const data = results
        .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled')
        .map(r => r.value);
      set({ watchlist: data, isLoading: false });
    } catch { set({ isLoading: false }); }
  },

  fetchMacro: async () => {
    try {
      const { data } = await api.get('/macro/dashboard');
      set({ macro: data });
    } catch {}
  },
}));
