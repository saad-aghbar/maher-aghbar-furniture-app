'use client';

import type { BoardTone } from '@maher/ui';

export type FabricEvent = { id: string; kind: string; note?: string | null; createdAt: string; supplierId?: string | null };
export type FabricLot = { id: string; qrCode?: string | null; quantity: number; remainingQty: number | null; locationId?: string | null; locationLabel?: string | null; status: string; unitCost?: number | null };
export type FabricJob = {
  id: string;
  salesOrderId: string;
  salesOrderNumber: string;
  productionOrderId?: string | null;
  productionOrderNumber?: string | null;
  itemLetter?: string | null;
  dealerName?: string | null;
  productName?: string | null;
  productImageUrl?: string | null;
  imageUrl?: string | null;
  inventoryItemId?: string | null;
  sku?: string | null;
  requestedLabel?: string | null;
  qrCode?: string | null;
  requiredQty?: number | null;
  arrivedQty?: number | null;
  unit?: string | null;
  supplier?: { id: string; name: string; phone?: string | null } | null;
  purchaseOrderId?: string | null;
  purchaseOrderNumber?: string | null;
  whatsappSentAt?: string | null;
  state?: string;
  expectedAvailableAt?: string | null;
  events?: FabricEvent[];
  lots?: FabricLot[];
  costOnFile?: boolean;
  resolvedUnitCost?: number | null;
  readiness?: { status?: string; derivedStatus?: string; ready?: boolean } | string;
};

export type SupplierState = 'SUPPLIER_CONFIRMED' | 'UNAVAILABLE' | 'PARTIALLY_AVAILABLE' | 'READY_FOR_PICKUP' | 'DELAYED';
export const SUPPLIER_STATES: SupplierState[] = ['SUPPLIER_CONFIRMED', 'READY_FOR_PICKUP', 'PARTIALLY_AVAILABLE', 'DELAYED', 'UNAVAILABLE'];

/** Live status: what the floor sees (arrived / issued / partial) beats the stored supplier state. */
export function fabricEffectiveState(job: Pick<FabricJob, 'state' | 'readiness'>): string {
  const r = job.readiness;
  const derived = r && typeof r === 'object' ? r.derivedStatus ?? r.status : typeof r === 'string' ? r : null;
  return (derived ?? job.state ?? '').toUpperCase();
}

export function fabricTone(state?: string | null): BoardTone {
  const s = (state ?? '').toUpperCase();
  if (/RECEIVED|ARRIVED|ISSUED|READY_FOR_PRODUCTION|IN_HOLDING|ALLOCATED|TAKEN|COMPLETE|^READY$/.test(s)) return 'success';
  if (/UNAVAILABLE|OVERRIDE|ATTENTION|FAILED/.test(s)) return 'error';
  if (/PARTIAL|DELAYED|WAIT|PICKUP/.test(s)) return 'warning';
  if (/REQUESTED|SENT|CONFIRMED|NEEDS/.test(s)) return 'info';
  return 'neutral';
}

export function fabricEventTone(kind: string): BoardTone {
  const k = kind.toUpperCase();
  if (/RECEIVED|READY|CONFIRMED/.test(k)) return 'success';
  if (/UNAVAILABLE|OVERRIDE|FAILED/.test(k)) return 'error';
  if (/PARTIAL|WAIT|DELAY|REDIRECT|CHANGED|DISPOSITION/.test(k)) return 'warning';
  return 'info';
}
