'use client';
import { useEffect, useState } from 'react';
import { scoringApi, macroApi, alphaApi, RankedOpportunity, MacroDashboard, EarlyOpportunity } from '@/lib/api';

export function useDashboard() {
  const [topOpps, setTopOpps]     = useState<RankedOpportunity[]>([]);
  const [earlyOpps, setEarlyOpps] = useState<EarlyOpportunity[]>([]);
  const [macro, setMacro]         = useState<MacroDashboard | null>(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [opps, early, mac] = await Promise.allSettled([
        scoringApi.topOpportunities(10),
        alphaApi.earlyOpps(),
        macroApi.dashboard(),
      ]);
      if (opps.status  === 'fulfilled') setTopOpps(opps.value.data);
      if (early.status === 'fulfilled') setEarlyOpps(early.value.data);
      if (mac.status   === 'fulfilled') setMacro(mac.value.data);
      setLastUpdated(new Date());
      setError(null);
    } catch (e: any) {
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
    // Auto-refresh every 5 minutes
    const interval = setInterval(loadAll, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  return { topOpps, earlyOpps, macro, loading, error, lastUpdated, refresh: loadAll };
}
