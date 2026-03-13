import { useEffect, useState } from 'react';
import type { DealsPipeline, DealsPipelineStage, Deal, DealActivityLogEntry } from '../types/deals';
import {
  listPipelines,
  listStages,
  subscribeDeals,
  subscribeTrashedDeals,
  ensureDefaultPipeline,
  listDealActivity
} from '../lib/firebase/deals';

export function usePipelines(companyId: string | null) {
  const [pipelines, setPipelines] = useState<DealsPipeline[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId) {
      setPipelines([]);
      setLoading(false);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        let items = await listPipelines(companyId);
        if (items.length === 0) {
          const created = await ensureDefaultPipeline(companyId);
          if (created) {
            items = [created];
          }
        }
        if (!cancelled) {
          if (import.meta.env.DEV) {
            console.log('[Deals] pipelines loaded:', { companyId, count: items.length });
          }
          setPipelines(items);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  return { pipelines, loading, error };
}

export function usePipelineStages(companyId: string | null, pipelineId: string | null) {
  const [stages, setStages] = useState<DealsPipelineStage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId || !pipelineId) {
      setStages([]);
      setLoading(false);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const items = await listStages(companyId, pipelineId);
        if (!cancelled) {
          if (import.meta.env.DEV) {
            console.log('[Deals] stages loaded:', { companyId, pipelineId, count: items.length });
          }
          setStages(items);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [companyId, pipelineId]);

  return { stages, loading, error };
}

export function useDeals(companyId: string | null, pipelineId: string | null) {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId || !pipelineId) {
      setDeals([]);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    const unsub = subscribeDeals(
      companyId,
      pipelineId,
      (items) => {
        setDeals(items);
        setLoading(false);
        setError(null);
      },
      (err) => {
        if (import.meta.env.DEV) {
          console.warn('[Deals] subscribeDeals error:', err);
        }
        setError(err instanceof Error ? err.message : String(err));
        setLoading(false);
      }
    );
    return () => unsub();
  }, [companyId, pipelineId]);

  return { deals, loading, error };
}

export function useTrashedDeals(companyId: string | null) {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId) {
      setDeals([]);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    const unsub = subscribeTrashedDeals(
      companyId,
      (items) => {
        setDeals(items);
        setLoading(false);
        setError(null);
      },
      (err) => {
        setError(err instanceof Error ? err.message : String(err));
        setLoading(false);
      }
    );
    return () => unsub();
  }, [companyId]);

  return { deals, loading, error };
}

export function useDealDetails(companyId: string | null, dealId: string | null) {
  const [activity, setActivity] = useState<DealActivityLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId || !dealId) {
      setActivity([]);
      setLoading(false);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const items = await listDealActivity(companyId, dealId);
        if (!cancelled) {
          setActivity(items);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [companyId, dealId]);

  return { activity, loading, error };
}

