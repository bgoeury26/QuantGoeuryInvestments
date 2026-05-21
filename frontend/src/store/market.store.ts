import { create } from 'zustand';
import api from '../lib/api';

interface MarketState {
  watchlist: string[];
  addToWatchlist: (symbol: string) => void;
  removeFromWatchlist: (symbol: string) => void;
  refreshOpportunities: () => Promise<void>;
}

export const useMarketStore = create<MarketState>((set) => ({
  watchlist: ['AAPL', 'NVDA', 'MSFT', 'TSLA', 'AMZN'],

  addToWatchlist: (symbol) =>
    set((s) => ({
      watchlist: s.watchlist.includes(symbol)
        ? s.watchlist
        : [...s.watchlist, symbol],
    })),

  removeFromWatchlist: (symbol) =>
    set((s) => ({ watchlist: s.watchlist.filter((s2) => s2 !== symbol) })),

  refreshOpportunities: async () => {
    try {
      await api.get('/opportunities/top');
    } catch (_) {}
  },
}));
