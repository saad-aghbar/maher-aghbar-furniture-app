import type { Locale } from '@maher/types';
import { localizedName } from '@maher/i18n';
import type { ReturnInventoryFate, ReturnReason, ReturnRequest } from './api';

/**
 * Dealer-facing human lifecycle (Piece 11).
 * Maps approvalStatus + physicalStatus (+ inventoryFate) — never scrap/cost internals.
 */
export type ReturnLifecyclePhase =
  | 'REPORTED'
  | 'UNDER_REVIEW'
  | 'APPROVED'
  | 'WAITING_RETURN'
  | 'BEING_RESOLVED'
  | 'RESOLVED';

export type DealerReturnDesk = 'all' | 'open' | 'progress' | 'resolved';

export type DealerReturnRailTone = 'brand' | 'warning' | 'success' | 'error';

export type ReturnCardModel = {
  id: string;
  number: string;
  productDesc: string;
  variantLabel: string | null;
  quantityLabel: string;
  reason: string;
  reasonLabelKey: string;
  description: string | null;
  approvalStatus: string;
  physicalStatus: string;
  inventoryFate: string | null;
  needInfoNote: string | null;
  createdAt: string | null;
  /** Human lifecycle phase for dealer UI. */
  lifecyclePhase: ReturnLifecyclePhase;
  lifecycleLabelKey: string;
  dealerName: string;
  salesOrderId: string | null;
  salesOrderNumber: string | null;
  dealerOrderNumber: string | null;
  productImageUrl: string | null;
  reasonPhotoUrl: string | null;
  issuePhotoUrl: string | null;
  reasonPhotoUrls: string[];
  issuePhotoUrls: string[];
  isPending: boolean;
  needsInfo: boolean;
  pieceTotal: number;
  pieceReady: number;
  pieceInProgress: number;
};

export const RETURN_FATE_OPTIONS: Exclude<ReturnInventoryFate, 'PENDING' | 'RETURN_TO_STOCK'>[] = [
  'REWORK',
  'DAMAGED',
  'SCRAP',
];

const FATE_LABEL_KEYS: Record<Exclude<ReturnInventoryFate, 'PENDING'>, string> = {
  RETURN_TO_STOCK: 'inventory.fateReturnToStock',
  REWORK: 'inventory.fateRework',
  DAMAGED: 'inventory.fateDamaged',
  SCRAP: 'inventory.fateScrap',
};

export function returnFateLabelKey(fate: string): string {
  if (fate in FATE_LABEL_KEYS) {
    return FATE_LABEL_KEYS[fate as Exclude<ReturnInventoryFate, 'PENDING'>];
  }
  return `inventory.fate${fate}`;
}

function asLocale(locale: string): Locale {
  return locale === 'ar' || locale === 'he' || locale === 'en' ? locale : 'en';
}

const KNOWN_REASONS = new Set<string>([
  'MANUFACTURING_DEFECT',
  'INCORRECT_MEASUREMENT',
  'INCORRECT_MATERIAL',
  'INCORRECT_COLOR',
  'DELIVERY_DAMAGE',
  'CUSTOMER_REQUEST',
  'OTHER',
]);

/** i18n key for a return reason — prefer catalog.returnReason.*. */
export function returnReasonLabelKey(reason: string): string {
  if (KNOWN_REASONS.has(reason)) return `catalog.returnReason.${reason}`;
  return `mobile.returns.reasons.${reason}`;
}

export function returnLifecycleLabelKey(phase: ReturnLifecyclePhase): string {
  return `mobile.returns.lifecycle.${phase}`;
}

/**
 * Map API approval + physical (+ fate) → dealer human lifecycle.
 *
 * Reported → Under review → Approved → Waiting for return → Being resolved → Resolved
 */
export function mapReturnLifecyclePhase(input: {
  approvalStatus?: string | null;
  physicalStatus?: string | null;
  inventoryFate?: string | null;
}): ReturnLifecyclePhase {
  const approval = (input.approvalStatus ?? 'PENDING').trim().toUpperCase();
  const physical = (input.physicalStatus ?? 'NONE').trim().toUpperCase();
  const fate = (input.inventoryFate ?? '').trim().toUpperCase();
  const fateDone = Boolean(fate) && fate !== 'PENDING';

  if (approval === 'REJECTED') return 'RESOLVED';
  if (physical === 'RESOLVED' || fateDone) return 'RESOLVED';

  if (approval === 'NEED_INFO') return 'UNDER_REVIEW';

  if (approval === 'APPROVED') {
    if (physical === 'RETURNED' || physical === 'INSPECTING') return 'BEING_RESOLVED';
    if (physical === 'WAITING_RETURN') return 'WAITING_RETURN';
    return 'APPROVED';
  }

  // PENDING (and unknown) — just reported / awaiting first review
  if (approval === 'PENDING') return 'REPORTED';

  return 'REPORTED';
}

/** StatusBadge color key — reuse familiar variants without exposing scrap/fate enums. */
export function returnLifecycleBadgeStatus(phase: ReturnLifecyclePhase): string {
  switch (phase) {
    case 'REPORTED':
      return 'PENDING';
    case 'UNDER_REVIEW':
      return 'NEED_INFO';
    case 'APPROVED':
      return 'APPROVED';
    case 'WAITING_RETURN':
      return 'WAITING_RETURN';
    case 'BEING_RESOLVED':
      return 'IN_PROGRESS';
    case 'RESOLVED':
      return 'RESOLVED';
    default:
      return 'PENDING';
  }
}

/** Presentation-only next-action copy key for returns boards/detail. */
export function returnNextActionKey(
  phase: ReturnLifecyclePhase,
  opts?: { dealerFacing?: boolean; needsInfo?: boolean },
): string {
  if (opts?.dealerFacing) {
    if (opts.needsInfo || phase === 'UNDER_REVIEW') {
      return 'mobile.returns.nextActionDealerInfo';
    }
    if (phase === 'RESOLVED') return 'mobile.returns.nextActionDone';
    return 'mobile.returns.nextActionDealerTrack';
  }
  switch (phase) {
    case 'REPORTED':
      return 'mobile.returns.nextActionReview';
    case 'UNDER_REVIEW':
      return 'mobile.returns.nextActionNeedInfo';
    case 'APPROVED':
    case 'WAITING_RETURN':
      return 'mobile.returns.nextActionWaitingReturn';
    case 'BEING_RESOLVED':
      return 'mobile.returns.nextActionResolve';
    case 'RESOLVED':
      return 'mobile.returns.nextActionDone';
    default:
      return 'mobile.returns.nextActionReview';
  }
}

/** Physical state i18n key (lifecycle.returnPhysical.*) — never scrap internals. */
export function returnPhysicalLabelKey(physicalStatus: string): string {
  const key = String(physicalStatus ?? 'NONE').trim().toUpperCase() || 'NONE';
  return `lifecycle.returnPhysical.${key}`;
}

function photoList(
  urls: string[] | null | undefined,
  fallback: string | null | undefined,
): string[] {
  const fromArray = (urls ?? []).map((u) => u.trim()).filter(Boolean);
  if (fromArray.length) return fromArray;
  const one = fallback?.trim();
  return one ? [one] : [];
}

export function selectReturnCard(row: ReturnRequest, locale: string): ReturnCardModel {
  const typed = asLocale(locale);
  const qty = Number(row.quantity);
  const approvalStatus = row.approvalStatus || 'PENDING';
  const physicalStatus = (row.physicalStatus || 'NONE').toUpperCase();
  const inventoryFate = row.inventoryFate?.trim() || null;
  const needInfoNote = row.needInfoNote?.trim() || null;
  const lifecyclePhase = mapReturnLifecyclePhase({
    approvalStatus,
    physicalStatus,
    inventoryFate,
  });
  const reasonPhotoUrls = photoList(row.reasonPhotoUrls, row.reasonPhotoUrl);
  const issuePhotoUrls = photoList(row.issuePhotoUrls, row.issuePhotoUrl);
  return {
    id: row.id,
    number: row.number,
    productDesc: row.productDesc?.trim() || '—',
    variantLabel: row.variantLabel?.trim() || null,
    quantityLabel: Number.isFinite(qty) ? String(qty) : String(row.quantity ?? '—'),
    reason: row.reason,
    reasonLabelKey: returnReasonLabelKey(row.reason),
    description: row.description?.trim() || null,
    approvalStatus,
    physicalStatus,
    inventoryFate,
    needInfoNote,
    createdAt: row.createdAt ?? null,
    lifecyclePhase,
    lifecycleLabelKey: returnLifecycleLabelKey(lifecyclePhase),
    dealerName: localizedName(
      typed,
      {
        name: row.customer?.name,
        nameEn: row.customer?.nameEn,
        nameAr: row.customer?.nameAr,
        nameHe: row.customer?.nameHe,
      },
      '—',
    ),
    salesOrderId: row.salesOrder?.id ?? null,
    salesOrderNumber: row.salesOrder?.number?.trim() || null,
    dealerOrderNumber: row.salesOrder?.externalOrderNumber?.trim() || null,
    productImageUrl: row.productImageUrl ?? null,
    reasonPhotoUrl: reasonPhotoUrls[0] ?? null,
    issuePhotoUrl: issuePhotoUrls[0] ?? null,
    reasonPhotoUrls,
    issuePhotoUrls,
    isPending: approvalStatus === 'PENDING' || approvalStatus === 'NEED_INFO',
    needsInfo: approvalStatus === 'NEED_INFO',
    pieceTotal: Number(row.pieceSummary?.total ?? 0),
    pieceReady: Number(row.pieceSummary?.readyToReturn ?? 0),
    pieceInProgress: Number(row.pieceSummary?.inProgress ?? 0),
  };
}

/** Whether a return matches the list chip (approval-based; dealer chips use human labels). */
export function returnMatchesStatusChip(
  row: { approvalStatus?: string | null; physicalStatus?: string | null; inventoryFate?: string | null },
  chip: string,
): boolean {
  if (chip === 'ALL') return true;
  const phase = mapReturnLifecyclePhase(row);
  const approval = (row.approvalStatus || 'PENDING').toUpperCase();

  // Admin chips stay approval-shaped; dealer UI reuses keys with human labels.
  if (chip === 'PENDING') {
    return phase === 'REPORTED' || phase === 'UNDER_REVIEW' || approval === 'PENDING' || approval === 'NEED_INFO';
  }
  if (chip === 'APPROVED') {
    return (
      phase === 'APPROVED' ||
      phase === 'WAITING_RETURN' ||
      phase === 'BEING_RESOLVED'
    );
  }
  if (chip === 'REJECTED') {
    return phase === 'RESOLVED' || approval === 'REJECTED';
  }
  // Physical lifecycle deep-links from management Home
  if (chip === 'WAITING_RETURN') {
    return phase === 'WAITING_RETURN' || (row.physicalStatus || '').toUpperCase() === 'WAITING_RETURN';
  }
  if (chip === 'RETURNED') {
    return (
      phase === 'BEING_RESOLVED' ||
      (row.physicalStatus || '').toUpperCase() === 'RETURNED'
    );
  }
  return approval === chip;
}

const FLOOR_STARTED = new Set([
  'IN_PROGRESS',
  'ON_HOLD',
  'QUALITY_CHECK',
  'READY_FOR_PACKAGING',
  'READY_FOR_DELIVERY',
  'COMPLETED',
]);

export function dealerReturnDesk(phase: ReturnLifecyclePhase): Exclude<DealerReturnDesk, 'all'> {
  if (phase === 'REPORTED' || phase === 'UNDER_REVIEW') return 'open';
  if (phase === 'RESOLVED') return 'resolved';
  return 'progress';
}

export function dealerReturnRailTone(
  phase: ReturnLifecyclePhase,
  approvalStatus?: string | null,
): DealerReturnRailTone {
  if (phase === 'RESOLVED') {
    return (approvalStatus ?? '').toUpperCase() === 'REJECTED' ? 'error' : 'success';
  }
  if (phase === 'REPORTED' || phase === 'UNDER_REVIEW' || phase === 'WAITING_RETURN') {
    return 'warning';
  }
  return 'brand';
}

export function returnListDay(createdAt?: string | null): string {
  return (createdAt ?? '').slice(0, 10);
}

export function selectDealerReturnHub(
  rows: Array<{
    approvalStatus?: string | null;
    physicalStatus?: string | null;
    inventoryFate?: string | null;
  }>,
): { open: number; inProgress: number; resolved: number } {
  let open = 0;
  let inProgress = 0;
  let resolved = 0;
  for (const row of rows) {
    const desk = dealerReturnDesk(mapReturnLifecyclePhase(row));
    if (desk === 'open') open += 1;
    else if (desk === 'progress') inProgress += 1;
    else resolved += 1;
  }
  return { open, inProgress, resolved };
}

export function filterDealerReturnCards(
  cards: ReturnCardModel[],
  opts: { q?: string; dateFrom?: string; dateTo?: string },
): ReturnCardModel[] {
  const q = (opts.q ?? '').trim().toLowerCase();
  const { dateFrom, dateTo } = opts;
  return cards.filter((card) => {
    const day = returnListDay(card.createdAt);
    if (dateFrom && day && day < dateFrom) return false;
    if (dateTo && day && day > dateTo) return false;
    if (q) {
      const hay = [
        card.number,
        card.productDesc,
        card.salesOrderNumber,
        card.dealerOrderNumber,
        card.reason,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

/** Unreleased return work opens the plan desk; released work opens production detail. */
export function returnWorkOrderHref(wo: {
  id: string;
  status?: string | null;
  releasedToFactoryAt?: string | null;
}): string {
  const status = String(wo.status ?? '').toUpperCase();
  const released = Boolean(wo.releasedToFactoryAt) || FLOOR_STARTED.has(status);
  if (!released) return `/(app)/(admin)/production/${wo.id}/plan`;
  return `/(app)/(admin)/production/${wo.id}`;
}

export type { ReturnReason };
