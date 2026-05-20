import { create } from 'zustand';

export interface Opportunity {
  symbol: string;
  name: string;
  finalScore: number;
  rankingScore: number;
  anomalyScore: number;
  confidenceFactor: number;
  signalType: string;
  earlyFlag: boolean;
  keyDrivers: string[];
  priceChange: number;
  priceChangePct: number;
  volume: number;
}

interface MarketState {
  watchlist: string[];
  selectedSymbol: string | null;
  setSelectedSymbol: (symbol: string | null) => void;
  addToWatchlist: (symbol: string) => void;
  removeFromWatchlist: (symbol: string) => void;
}

export const useMarketStore = create<MarketState>((set) => ({
  watchlist: [],
  selectedSymbol: null,
  setSelectedSymbol: (symbol) => set({ selectedSymbol: symbol }),
  addToWatchlist: (symbol) => set((s) => ({ watchlist: [...new Set([...s.watchlist, symbol])] })),
  removeFromWatchlist: (symbol) => set((s) => ({ watchlist: s.watchlist.filter((w) => w !== symbol) })),
}));
