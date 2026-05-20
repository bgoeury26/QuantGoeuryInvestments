'use client';
import { useEffect, useState, useCallback } from 'react';
import {
  stocksApi, scoringApi, alphaApi, sentimentApi, flowsApi, aiApi,
  StockDetail, StockQuote, OHLCVPoint, ScoreResult, AlphaSignal,
  SentimentData, Technicals, Fundamentals, AnalystRatings, AIAnalysis, AnomalyResult,
} from '@/lib/api';

export function useStockQuote(symbol: string) {
  const [data, setData]       = useState<StockQuote | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!symbol) return;
    try {
      setLoading(true);
      const res = await stocksApi.quote(symbol.toUpperCase());
      setData(res.data);
      setError(null);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Failed to load quote');
    } finally {
      setLoading(false);
    }
  }, [symbol]);

  useEffect(() => { fetch(); }, [fetch]);
  return { data, loading, error, refetch: fetch };
}

export function useStockChart(symbol: string, range = '1M') {
  const [data, setData]       = useState<OHLCVPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    if (!symbol) return;
    setLoading(true);
    stocksApi.chart(symbol.toUpperCase(), range)
      .then(r => { setData(r.data); setLoading(false); })
      .catch(e => { setError(e?.response?.data?.message ?? 'Error'); setLoading(false); });
  }, [symbol, range]);

  return { data, loading, error };
}

export function useStockScore(symbol: string) {
  const [data, setData]       = useState<ScoreResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  const compute = useCallback(async () => {
    setLoading(true);
    try {
      const res = await scoringApi.computeScore(symbol.toUpperCase());
      setData(res.data);
      setError(null);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Error');
    } finally {
      setLoading(false);
    }
  }, [symbol]);

  useEffect(() => {
    if (!symbol) return;
    scoringApi.getScore(symbol.toUpperCase())
      .then(r => { setData(r.data); setLoading(false); })
      .catch(() => { compute(); });
  }, [symbol, compute]);

  return { data, loading, error, recompute: compute };
}

export function useStockSignals(symbol: string) {
  const [data, setData]       = useState<AlphaSignal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    if (!symbol) return;
    alphaApi.getSignals(symbol.toUpperCase())
      .then(r => { setData(r.data); setLoading(false); })
      .catch(e => { setError(e?.response?.data?.message ?? 'Error'); setLoading(false); });
  }, [symbol]);

  return { data, loading, error };
}

export function useAnomalyScore(symbol: string) {
  const [data, setData]       = useState<AnomalyResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!symbol) return;
    alphaApi.anomalyScore(symbol.toUpperCase())
      .then(r => { setData(r.data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [symbol]);

  return { data, loading };
}

export function useSentiment(symbol: string) {
  const [data, setData]       = useState<SentimentData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!symbol) return;
    sentimentApi.get(symbol.toUpperCase())
      .then(r => { setData(r.data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [symbol]);

  return { data, loading };
}

export function useFlows(symbol: string) {
  const [institutional, setInstitutional] = useState<any[]>([]);
  const [insider, setInsider]             = useState<any[]>([]);
  const [loading, setLoading]             = useState(true);

  useEffect(() => {
    if (!symbol) return;
    Promise.allSettled([
      flowsApi.institutional(symbol.toUpperCase()),
      flowsApi.insider(symbol.toUpperCase()),
    ]).then(([inst, ins]) => {
      if (inst.status === 'fulfilled') setInstitutional(inst.value.data);
      if (ins.status  === 'fulfilled') setInsider(ins.value.data);
      setLoading(false);
    });
  }, [symbol]);

  return { institutional, insider, loading };
}

export function useAIAnalysis(symbol: string) {
  const [data, setData]       = useState<AIAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const analyze = useCallback(async () => {
    if (!symbol) return;
    setLoading(true);
    try {
      const res = await aiApi.analyze(symbol.toUpperCase());
      setData(res.data);
      setError(null);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'AI analysis failed');
    } finally {
      setLoading(false);
    }
  }, [symbol]);

  return { data, loading, error, analyze };
}
