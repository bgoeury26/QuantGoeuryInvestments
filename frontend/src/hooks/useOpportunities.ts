'use client';
import { useEffect, useState, useCallback } from 'react';
import { opportunitiesApi, alphaApi, RankedOpportunity, EarlyOpportunity } from '@/lib/api';

export function useTopOpportunities(limit = 10) {
  const [data, setData]       = useState<RankedOpportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  const fetch = useCallback(async () => {
    try {
      setLoading(true);
      const res = await opportunitiesApi.top(limit);
      setData(res.data);
      setError(null);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Failed to load opportunities');
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => { fetch(); }, [fetch]);
  return { data, loading, error, refetch: fetch };
}

export function useEarlyOpportunities() {
  const [data, setData]       = useState<EarlyOpportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    alphaApi.earlyOpps()
      .then(r => { setData(r.data); setLoading(false); })
      .catch(e => { setError(e?.response?.data?.message ?? 'Error'); setLoading(false); });
  }, []);

  return { data, loading, error };
}
