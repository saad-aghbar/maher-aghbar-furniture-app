'use client';

import { apiFetch } from '@/lib/api-client';
import { useMutation } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useMemo } from 'react';

export interface Category {
  id: string;
  code: string;
  nameAr: string;
  nameEn: string;
  nameHe?: string | null;
}

export interface ProductRow {
  id: string;
  sku: string;
  nameAr: string;
  nameEn: string;
  nameHe?: string | null;
  isActive: boolean;
  basePrice?: string | number | null;
  manufacturingCost?: string | number | null;
  productionCost?: string | number | null;
  imageUrl?: string | null;
  categoryId?: string | null;
  category?: Category | null;
  unit?: string | null;
  updatedAt?: string;
}

export type NameTranslation = { nameAr: string; nameEn: string; nameHe: string };

/** Mobile-only `catalog/translate-name`: propose the other two names from one typed name. */
export function useTranslateName() {
  return useMutation({
    mutationFn: (args: { text: string; sourceLocale: 'ar' | 'en' | 'he'; kind?: 'name' | 'prose' }) =>
      apiFetch<NameTranslation>('/api/v1/catalog/translate-name', { method: 'POST', body: JSON.stringify(args) }),
  });
}

export function useCatalogCopy() {
  const locale = useLocale();
  const t = useTranslations('catalog');
  const tCommon = useTranslations('common');
  return useMemo(() => {
    const money = (value: string | number | null | undefined, currency = 'ILS') => {
      const n = Number(value);
      if (!Number.isFinite(n)) return '—';
      try {
        return new Intl.NumberFormat(locale === 'ar' ? 'ar-JO' : locale === 'he' ? 'he-IL' : 'en-JO', { style: 'currency', currency, maximumFractionDigits: 2, minimumFractionDigits: Number.isInteger(n) ? 0 : 2 }).format(n);
      } catch {
        return `${n.toFixed(2)} ${currency}`;
      }
    };
    const margin = (sell: string | number | null | undefined, cost: string | number | null | undefined) => {
      const s = Number(sell);
      const c = Number(cost);
      if (!Number.isFinite(s) || !Number.isFinite(c) || s <= 0) return null;
      return Math.round(((s - c) / s) * 100);
    };
    return { locale, t, tCommon, money, margin };
  }, [locale, t, tCommon]);
}
