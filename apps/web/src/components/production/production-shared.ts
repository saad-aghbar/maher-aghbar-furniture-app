'use client';

import type { BoardTone } from '@maher/ui';
import { useLocale, useTranslations } from 'next-intl';
import { useMemo } from 'react';

export type ProductionBucket = 'all' | 'needs_setup' | 'ready_to_start' | 'on_floor' | 'blocked' | 'inspection_packaging' | 'late' | 'completed';
export const PRODUCTION_BUCKETS: Exclude<ProductionBucket, 'all'>[] = ['needs_setup', 'ready_to_start', 'on_floor', 'blocked', 'inspection_packaging', 'late', 'completed'];
export type Priority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
export const PRIORITIES: Priority[] = ['LOW', 'NORMAL', 'HIGH', 'URGENT'];
export type Complexity = 'STANDARD' | 'MODIFIED' | 'CUSTOM';
export const COMPLEXITIES: Complexity[] = ['STANDARD', 'MODIFIED', 'CUSTOM'];

export interface ProductionCustomer {
  id: string;
  code?: string;
  name: string;
  nameAr?: string | null;
  nameEn?: string | null;
  nameHe?: string | null;
}

export interface ProductionRow {
  id: string;
  number: string;
  status: string;
  priority?: Priority | string;
  progressPercent: number;
  quantity?: number | string | null;
  productDescription?: string | null;
  requiredDeliveryDate?: string | null;
  plannedCompletionDate?: string | null;
  plannedStartDate?: string | null;
  actualCompletionDate?: string | null;
  committedDeliveryDate?: string | null;
  imageUrl?: string | null;
  isLate?: boolean;
  manufacturingComplexity?: Complexity | string | null;
  currentStageCode?: string | null;
  currentStage?: { code: string; nameEn: string; nameAr?: string | null; nameHe?: string | null } | null;
  customerId?: string | null;
  customer?: ProductionCustomer | null;
  product?: { id: string; sku?: string; nameEn?: string | null; nameAr?: string | null; nameHe?: string | null; imageUrl?: string | null } | null;
  salesOrder?: { id: string; number: string; externalOrderNumber?: string | null } | null;
  originType?: string | null;
  originLabel?: string | null;
  returnRequest?: { id: string; number: string } | null;
  assignedEmployee?: { id: string; firstName?: string | null; lastName?: string | null } | null;
  blockers?: Array<{ id: string; category: string; reason: string; resolvedAt?: string | null }>;
  openBlockersCount?: number;
}

export interface DaySummary {
  onDate: string;
  factoryTodayYmd: string;
  isToday: boolean;
  isFuture: boolean;
  planned: { orders: number; tasks: number; byDepartment: Array<{ code: string; nameEn: string; nameAr?: string | null; nameHe?: string | null; taskCount: number }> };
  actual: { orders: number; taskEvents: number };
  lateMissed: number;
  lateMissedTasks?: number;
  atRisk: number;
  board?: { needsSetup: number; readyToStart: number; onFloor: number; blocked: number; inspectionPackaging: number };
}

export interface AssignableWorker {
  id: string;
  firstName: string;
  lastName: string;
  activeTaskCount?: number;
  recommendBand?: string;
  recommendReason?: string | null;
}

export function productionTone(status: string): BoardTone {
  switch (status) {
    case 'COMPLETED':
      return 'success';
    case 'CANCELLED':
      return 'neutral';
    case 'ON_HOLD':
    case 'WAITING_FOR_MATERIALS':
      return 'error';
    case 'QUALITY_CHECK':
    case 'READY_FOR_PACKAGING':
    case 'READY_FOR_DELIVERY':
      return 'info';
    case 'IN_PROGRESS':
      return 'brand';
    case 'READY':
    case 'PLANNED':
      return 'warning';
    default:
      return 'neutral';
  }
}

export function bucketTone(bucket: ProductionBucket): BoardTone {
  switch (bucket) {
    case 'needs_setup':
      return 'neutral';
    case 'ready_to_start':
      return 'warning';
    case 'on_floor':
      return 'brand';
    case 'blocked':
      return 'error';
    case 'inspection_packaging':
      return 'info';
    case 'late':
      return 'error';
    case 'completed':
      return 'success';
    default:
      return 'brand';
  }
}

export function priorityTone(priority?: string | null): BoardTone {
  return priority === 'URGENT' ? 'error' : priority === 'HIGH' ? 'warning' : priority === 'LOW' ? 'neutral' : 'brand';
}

export function complexityTone(c?: string | null): BoardTone {
  return c === 'CUSTOM' ? 'warning' : c === 'MODIFIED' ? 'info' : 'neutral';
}

export function useProductionCopy() {
  const locale = useLocale();
  const tm = useTranslations('mobile.production');
  const tp = useTranslations('production');
  const tCommon = useTranslations('common');
  const tStatus = useTranslations('statuses');
  return useMemo(() => {
    const bucket = (b: ProductionBucket) => {
      switch (b) {
        case 'all':
          return tCommon('all');
        case 'needs_setup':
          return tm('needsSetup');
        case 'ready_to_start':
          return tm('readyToStart');
        case 'on_floor':
          return tm('onFloor');
        case 'blocked':
          return tm('blocked');
        case 'inspection_packaging':
          return tm('inspectionPackaging');
        case 'late':
          return tm('lateOrders');
        case 'completed':
          return tm('completed');
      }
    };
    const priority = (p?: string | null) => (p ? tm(`priority.${p}` as never) : '—');
    const complexity = (c?: string | null) => (c === 'CUSTOM' || c === 'MODIFIED' || c === 'STANDARD' ? tm(`kindFilter.${c}` as never) : '—');
    const status = (s: string) => {
      try {
        return tStatus(s as never);
      } catch {
        return s.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (ch) => ch.toUpperCase());
      }
    };
    const date = (value?: string | null, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }) => {
      if (!value) return '—';
      const d = new Date(value);
      return Number.isNaN(d.getTime()) ? '—' : new Intl.DateTimeFormat(locale, opts).format(d);
    };
    const daysUntil = (value?: string | null) => {
      if (!value) return null;
      const d = new Date(value);
      if (Number.isNaN(d.getTime())) return null;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      d.setHours(0, 0, 0, 0);
      return Math.round((d.getTime() - today.getTime()) / 86_400_000);
    };
    const worker = (w?: { firstName?: string | null; lastName?: string | null } | null) => [w?.firstName, w?.lastName].filter(Boolean).join(' ') || '—';
    return { locale, tm, tp, tCommon, bucket, priority, complexity, status, date, daysUntil, worker };
  }, [locale, tm, tp, tCommon, tStatus]);
}
