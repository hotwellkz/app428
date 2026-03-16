import { useState, useEffect, useCallback } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface EstimateLineItem {
  section: string;
  name: string;
  unit: string;
  quantity: number;
  price: number;
  total: number;
}

const COLLECTIONS: Array<{
  section: string;
  collection: string;
  getItems: (data: Record<string, unknown>) => EstimateLineItem[];
  getWorkItem?: (data: Record<string, unknown>) => EstimateLineItem | null;
}> = [
  {
    section: 'Фундамент',
    collection: 'foundationEstimates',
    getItems: (d) => (d.items as Array<{ name?: string; unit?: string; quantity?: number; price?: number; total?: number }> || []).map((it) => ({
      section: 'Фундамент',
      name: it.name ?? '',
      unit: it.unit ?? '',
      quantity: Number(it.quantity) || 0,
      price: Number(it.price) || 0,
      total: (Number(it.total) ?? Number(it.quantity) * Number(it.price)) || 0,
    })),
    getWorkItem: (d) => {
      const v = Number(d.foundationWorkCost) || 0;
      return v ? { section: 'Фундамент', name: 'Работы по фундаменту', unit: 'комплекс', quantity: 1, price: v, total: v } : null;
    },
  },
  {
    section: 'Стены СИП',
    collection: 'sipWallsEstimates',
    getItems: (d) => (d.items as Array<{ name?: string; unit?: string; quantity?: number; price?: number; total?: number }> || []).map((it) => ({
      section: 'Стены СИП',
      name: it.name ?? '',
      unit: it.unit ?? '',
      quantity: Number(it.quantity) || 0,
      price: Number(it.price) || 0,
      total: (Number(it.total) ?? Number(it.quantity) * Number(it.price)) || 0,
    })),
    getWorkItem: (d) => {
      const v = Number(d.installationCost) || 0;
      return v ? { section: 'Стены СИП', name: 'Монтаж стен из СИП', unit: 'комплекс', quantity: 1, price: v, total: v } : null;
    },
  },
  {
    section: 'Перекрытие',
    collection: 'floorEstimates',
    getItems: (d) => (d.items as Array<{ name?: string; unit?: string; quantity?: number; price?: number; total?: number }> || []).map((it) => ({
      section: 'Перекрытие',
      name: it.name ?? '',
      unit: it.unit ?? '',
      quantity: Number(it.quantity) || 0,
      price: Number(it.price) || 0,
      total: (Number(it.total) ?? Number(it.quantity) * Number(it.price)) || 0,
    })),
    getWorkItem: (d) => {
      const v = Number(d.installationCost) || 0;
      return v ? { section: 'Перекрытие', name: 'Монтаж перекрытия', unit: 'комплекс', quantity: 1, price: v, total: v } : null;
    },
  },
  {
    section: 'Крыша',
    collection: 'roofEstimates',
    getItems: (d) => (d.items as Array<{ name?: string; unit?: string; quantity?: number; price?: number; total?: number }> || []).map((it) => ({
      section: 'Крыша',
      name: it.name ?? '',
      unit: it.unit ?? '',
      quantity: Number(it.quantity) || 0,
      price: Number(it.price) || 0,
      total: (Number(it.total) ?? Number(it.quantity) * Number(it.price)) || 0,
    })),
    getWorkItem: (d) => {
      const v = Number(d.roofWorkCost) || 0;
      return v ? { section: 'Крыша', name: 'Монтаж кровли', unit: 'комплекс', quantity: 1, price: v, total: v } : null;
    },
  },
  {
    section: 'Перегородки',
    collection: 'partitionEstimates',
    getItems: (d) => (d.items as Array<{ name?: string; unit?: string; quantity?: number; price?: number; total?: number }> || []).map((it) => ({
      section: 'Перегородки',
      name: it.name ?? '',
      unit: it.unit ?? '',
      quantity: Number(it.quantity) || 0,
      price: Number(it.price) || 0,
      total: (Number(it.total) ?? Number(it.quantity) * Number(it.price)) || 0,
    })),
    getWorkItem: (d) => {
      const v = Number(d.installationCost) || 0;
      return v ? { section: 'Перегородки', name: 'Монтаж перегородок', unit: 'комплекс', quantity: 1, price: v, total: v } : null;
    },
  },
  {
    section: 'Расходные материалы',
    collection: 'consumablesEstimates',
    getItems: (d) => (d.items as Array<{ name?: string; unit?: string; quantity?: number; price?: number; total?: number }> || []).map((it) => ({
      section: 'Расходные материалы',
      name: it.name ?? '',
      unit: it.unit ?? '',
      quantity: Number(it.quantity) || 0,
      price: Number(it.price) || 0,
      total: (Number(it.total) ?? Number(it.quantity) * Number(it.price)) || 0,
    })),
  },
  {
    section: 'Доп. работы',
    collection: 'additionalWorksEstimates',
    getItems: (d) => {
      const items = (d.items as Array<{ name?: string; total?: number }> || []);
      return items
        .map((it) => {
          const total = Number(it.total) || 0;
          return {
            section: 'Доп. работы',
            name: (it.name as string)?.trim() || 'Позиция',
            unit: '',
            quantity: total ? 1 : 0,
            price: total,
            total,
          };
        })
        .filter((it) => it.name && it.total > 0);
    },
  },
];

export function useEstimateLineItems(clientId: string): {
  lineItems: EstimateLineItem[];
  loading: boolean;
  refetch: () => Promise<void>;
} {
  const [lineItems, setLineItems] = useState<EstimateLineItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!clientId) {
      setLineItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const result: EstimateLineItem[] = [];
    for (const { section, collection: col, getItems, getWorkItem } of COLLECTIONS) {
      try {
        const ref = doc(db, col, clientId);
        const snap = await getDoc(ref);
        if (!snap.exists()) continue;
        const data = snap.data() as Record<string, unknown>;
        const items = getItems(data).filter((it) => it.name && (it.total > 0 || it.quantity > 0));
        result.push(...items);
        const work = getWorkItem?.(data);
        if (work && work.total > 0) result.push(work);
      } catch {
        // skip failed section
      }
    }
    setLineItems(result);
    setLoading(false);
  }, [clientId]);

  useEffect(() => {
    load();
  }, [load]);

  return { lineItems, loading, refetch: load };
}
