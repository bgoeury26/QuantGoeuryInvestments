'use client';
import { create } from 'zustand';
import { StockQuote, OHLCVPoint, ScoreResult, AlphaSignal } from '@/lib/api';

interface StockState {
  // Current analysis symbol
  symbol: string;
  setSymbol: (s: string) => void;

  // Quote cache
  quotes: Record<string, StockQuote>;
  setQuote: (symbol: string, q: StockQuote) => void;

  // Chart cache
  charts: Record<string, OHLCVPoint[]>;
  setChart: (key: string, d: OHLCVPoint[]) => void;

  // Score cache
  scores: Record<string, ScoreResult>;
  setScore: (symbol: string, s: ScoreResult) => void;

  // Signal cache
  signals: Record<string, AlphaSignal[]>;
  setSignals: (symbol: string, s: AlphaSignal[]) => void;

  // Chart range
  chartRange: string;
  setChartRange: (r: string) => void;

  clearCache: () => void;
}

export const useStockStore = create<StockState>((set) => ({
  symbol: 'AAPL',
  setSymbol: (s) => set({ symbol: s.toUpperCase() }),

  quotes: {},
  setQuote: (symbol, q) => set(st => ({ quotes: { ...st.quotes, [symbol]: q } })),

  charts: {},
  setChart: (key, d) => set(st => ({ charts: { ...st.charts, [key]: d } })),

  scores: {},
  setScore: (symbol, s) => set(st => ({ scores: { ...st.scores, [symbol]: s } })),

  signals: {},
  setSignals: (symbol, s) => set(st => ({ signals: { ...st.signals, [symbol]: s } })),

  chartRange: '1M',
  setChartRange: (r) => set({ chartRange: r }),

  clearCache: () => set({ quotes: {}, charts: {}, scores: {}, signals: {} }),
}));
