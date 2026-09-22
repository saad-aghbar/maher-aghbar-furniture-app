'use client';

import { API_URL } from '@/lib/api-client';
import type { BoardTone } from '@maher/ui';
import { useLocale, useTranslations } from 'next-intl';
import { useMemo } from 'react';
import type { ReturnRow } from './return-types';

/** Fields the API returns on a return row that the older type left out. */
export interface ReturnRowTimestamps {
  createdAt?: string | null;
  updatedAt?: string | null;
  sentToFactoryAt?: string | null;
  collectedAt?: string | null;
  receivedAt?: string | null;
  inspectedAt?: string | null;
  chargeSentAt?: string | null;
  chargeConfirmedAt?: string | null;
  chargeRejectedAt?: string | null;
  receivedCondition?: string | null;
  receivedNotes?: string | null;
  receivedLocation?: { id: string; code: string; name?: string | null } | null;
}

export type ReturnDetail = ReturnRow & ReturnRowTimestamps;

export type ReturnAttentionKey = 'pendingReview' | 'needInfo' | 'waitingReturn' | 'awaitingInspection';

/** Which sentence the floor needs to read first for this return. */
export function attentionKey(row: ReturnRow): ReturnAttentionKey | null {
  const approval = (row.approvalStatus ?? 'PENDING').toUpperCase();
  const physical = (row.physicalStatus ?? 'NONE').toUpperCase();
  if (approval === 'PENDING') return 'pendingReview';
  if (approval === 'NEED_INFO') return 'needInfo';
  if (approval === 'APPROVED' && physical === 'WAITING_RETURN') return 'waitingReturn';
  if ((physical === 'RETURNED' || physical === 'INSPECTING') && (!row.inventoryFate || row.inventoryFate === 'PENDING')) {
    return 'awaitingInspection';
  }
  return null;
}

export function mediaSrc(url: string | null | undefined): string | null {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  return `${API_URL}${url}`;
}

export function approvalTone(status: string | null | undefined): BoardTone {
  switch ((status ?? 'PENDING').toUpperCase()) {
    case 'APPROVED':
      return 'success';
    case 'REJECTED':
      return 'error';
    case 'NEED_INFO':
      return 'warning';
    default:
      return 'info';
  }
}

export function lifecycleTone(state: string | null | undefined): BoardTone {
  switch ((state ?? '').toUpperCase()) {
    case 'REQUESTED':
    case 'NEED_INFO':
      return 'warning';
    case 'APPROVED':
    case 'IN_TRANSIT':
      return 'info';
    case 'RECEIVED':
    case 'INSPECTING':
    case 'REWORKING':
    case 'REPLACING':
      return 'brand';
    case 'READY_TO_RETURN':
    case 'RETURNING':
    case 'RETURNED_TO_STOCK':
    case 'COMPLETED':
      return 'success';
    case 'SCRAPPED':
    case 'REJECTED':
      return 'error';
    default:
      return 'neutral';
  }
}

export function pieceTone(state: string | null | undefined): BoardTone {
  switch ((state ?? '').toUpperCase()) {
    case 'AWAITING_RECEIPT':
      return 'warning';
    case 'RECEIVED':
    case 'DECIDED':
    case 'IN_PROGRESS':
      return 'brand';
    case 'READY_TO_RETURN':
    case 'RETURNING':
    case 'RETURNED':
      return 'success';
    case 'RECOVERED':
      return 'info';
    case 'CANCELLED':
      return 'error';
    default:
      return 'neutral';
  }
}

export function chargeTone(status: string | null | undefined): BoardTone {
  switch ((status ?? 'NOT_REQUIRED').toUpperCase()) {
    case 'DRAFT':
      return 'neutral';
    case 'AWAITING_DEALER':
      return 'warning';
    case 'CONFIRMED':
    case 'INVOICED':
      return 'success';
    case 'REJECTED':
      return 'error';
    default:
      return 'neutral';
  }
}

export function useReturnCopy() {
  const locale = useLocale();
  const t = useTranslations('lifecycle');
  const tc = useTranslations('catalog');
  const tStatus = useTranslations('statuses');
  return useMemo(() => {
    // next-intl returns the dotted key path (and logs) for missing messages instead of throwing.
    const safe = (fn: () => string, fallback: string) => {
      try {
        const out = fn();
        return /^[a-z]+\.[A-Za-z_.]+$/.test(out) && out.endsWith(fallback) ? fallback : out;
      } catch {
        return fallback;
      }
    };
    return {
      locale,
      reason: (reason: string) => safe(() => tc(`returnReason.${reason}` as 'returnReason.OTHER'), reason),
      physical: (status: string | null | undefined) => {
        const key = (status ?? 'NONE').toUpperCase();
        return safe(() => t(`returnPhysical.${key}` as 'returnPhysical.NONE'), key);
      },
      attention: (row: ReturnRow) => {
        const key = attentionKey(row);
        return key ? t(`returnAttention.${key}`) : null;
      },
      status: (code: string | null | undefined) => {
        const key = (code ?? '').toUpperCase();
        return key ? safe(() => tStatus(key as 'PENDING'), key.replaceAll('_', ' ').toLowerCase()) : '—';
      },
      chargeStatus: (status: string | null | undefined) => {
        const key = (status ?? 'NOT_REQUIRED').toUpperCase();
        return safe(() => t(`returnDetail.chargeStatuses.${key}` as 'returnDetail.chargeStatuses.DRAFT'), key);
      },
      money: (value: number | string | null | undefined) => {
        const n = Number(value);
        if (!Number.isFinite(n)) return '—';
        return new Intl.NumberFormat(locale, { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 }).format(n);
      },
      date: (iso: string | null | undefined) => {
        if (!iso) return null;
        const d = new Date(iso);
        if (Number.isNaN(d.getTime())) return null;
        return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(d);
      },
    };
  }, [locale, t, tc, tStatus]);
}
