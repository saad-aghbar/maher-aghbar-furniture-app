/**
 * Dealer RFQ edit policy — server-authoritative.
 * Never trust client clocks or client-supplied lock/unlock flags.
 */

export const DEALER_EDIT_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;

/** Stages where fabric work has started (aligned with production stage seed). */
export const FABRIC_PRODUCTION_STAGE_CODES = [
  'UPHOLSTERY',
  'ASSEMBLY',
  'INSPECTION',
  'PACKAGING',
  'DELIVERY',
  // legacy / alternate codes still treated as fabric-in-progress
  'FABRIC',
  'FINISHING',
  'PACKING',
] as const;

export const FABRIC_PROGRESS_LOCK_PERCENT = 40;

export type DealerEditStatus =
  | 'DRAFT'
  | 'NEEDS_INFORMATION'
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'READY_FOR_QUOTATION'
  | 'QUOTED'
  | 'CLOSED'
  | string;

export type LockReason = {
  code: 'ORDER_LOCKED' | 'FABRIC_LOCKED';
  field?: string;
  message: string;
};

export type DealerEditPolicy = {
  serverNow: string;
  submittedAt: string | null;
  editWindowEndsAt: string | null;
  remainingMs: number;
  canEdit: boolean;
  fabricLocked: boolean;
  lockedFields: string[];
  lockReasons: LockReason[];
};

export type FabricLikeItem = {
  fabric?: string | null;
  color?: string | null;
  fabricType?: string | null;
  fabricColor?: string | null;
  fabricCode?: string | null;
};

export function resolveSubmissionAnchor(input: {
  status: DealerEditStatus;
  submittedAt?: Date | string | null;
  createdAt: Date | string;
}): Date {
  if (input.submittedAt) return new Date(input.submittedAt);
  // Drafts / needs-info: window is not applied the same way; anchor = createdAt for display.
  if (['DRAFT', 'NEEDS_INFORMATION'].includes(input.status)) {
    return new Date(input.createdAt);
  }
  // Legacy rows without submittedAt: fall back to createdAt (server field only).
  return new Date(input.createdAt);
}

export function isFabricInProduction(input: {
  currentStageCode?: string | null;
  progressPercent?: number | null;
}): boolean {
  const code = (input.currentStageCode ?? '').toUpperCase();
  if (code && (FABRIC_PRODUCTION_STAGE_CODES as readonly string[]).includes(code)) {
    return true;
  }
  const progress = Number(input.progressPercent ?? 0);
  return Number.isFinite(progress) && progress >= FABRIC_PROGRESS_LOCK_PERCENT;
}

export function computeDealerEditPolicy(input: {
  status: DealerEditStatus;
  submittedAt?: Date | string | null;
  createdAt: Date | string;
  /** Injected server clock — never from the client. */
  serverNow: Date;
  fabricInProduction: boolean;
  isDealer: boolean;
}): DealerEditPolicy {
  const serverNow = input.serverNow;
  const isOpenStatus = ['DRAFT', 'NEEDS_INFORMATION'].includes(input.status);
  const anchor = resolveSubmissionAnchor(input);
  const endsAt = new Date(anchor.getTime() + DEALER_EDIT_WINDOW_MS);
  const remainingMs = Math.max(0, endsAt.getTime() - serverNow.getTime());
  const withinWindow = remainingMs > 0;

  const lockReasons: LockReason[] = [];
  const lockedFields: string[] = [];

  let canEdit = true;
  if (input.isDealer) {
    // Customer/dealer: open statuses always editable; otherwise 3-day window from submission.
    if (!isOpenStatus && !withinWindow) {
      canEdit = false;
      lockedFields.push('*');
      lockReasons.push({
        code: 'ORDER_LOCKED',
        message: 'Order can only be edited within 3 days of submission.',
      });
    }
  }
  // Factory/admin (no customerId): always editable — the 3-day window is dealer-only.

  const fabricLocked = input.isDealer && input.fabricInProduction;
  if (fabricLocked) {
    lockedFields.push('fabric', 'color', 'fabricType', 'fabricColor', 'fabricCode');
    lockReasons.push({
      code: 'FABRIC_LOCKED',
      field: 'fabric',
      message: 'Fabric cannot be changed after fabric production has started.',
    });
  }

  return {
    serverNow: serverNow.toISOString(),
    submittedAt: input.submittedAt ? new Date(input.submittedAt).toISOString() : null,
    editWindowEndsAt: input.isDealer && !isOpenStatus ? endsAt.toISOString() : null,
    remainingMs: input.isDealer && !isOpenStatus ? remainingMs : isOpenStatus ? DEALER_EDIT_WINDOW_MS : 0,
    canEdit,
    fabricLocked,
    lockedFields: [...new Set(lockedFields)],
    lockReasons,
  };
}

function norm(v: unknown): string {
  return String(v ?? '')
    .trim()
    .toLowerCase();
}

/** True when incoming items attempt to change fabric-related values vs existing rows. */
export function detectsFabricMutation(
  existing: FabricLikeItem[],
  incoming: FabricLikeItem[] | undefined,
): boolean {
  if (!incoming) return false;
  const max = Math.max(existing.length, incoming.length);
  if (incoming.length !== existing.length && incoming.some((i) => hasFabricValue(i))) {
    // Length change with fabric payload is treated as a fabric edit attempt.
    return true;
  }
  for (let i = 0; i < max; i++) {
    const prev = existing[i] ?? {};
    const next = incoming[i] ?? {};
    const prevFabric = norm(prev.fabricType ?? prev.fabric);
    const prevColor = norm(prev.fabricColor ?? prev.color);
    const prevCode = norm(prev.fabricCode);
    const nextFabric = norm(next.fabric ?? next.fabricType);
    const nextColor = norm(next.color ?? next.fabricColor);
    const nextCode = norm(next.fabricCode);
    // Only compare when the client actually sent fabric-ish fields on that item.
    const sentFabric =
      next.fabric != null ||
      next.fabricType != null ||
      next.color != null ||
      next.fabricColor != null ||
      next.fabricCode != null;
    if (!sentFabric) continue;
    if (nextFabric !== prevFabric || nextColor !== prevColor || nextCode !== prevCode) {
      return true;
    }
  }
  return false;
}

function hasFabricValue(item: FabricLikeItem): boolean {
  return Boolean(
    norm(item.fabric) ||
      norm(item.fabricType) ||
      norm(item.color) ||
      norm(item.fabricColor) ||
      norm(item.fabricCode),
  );
}

/**
 * When fabric is locked, strip fabric fields from incoming items and restore
 * existing fabric values so notes/dimensions can still be updated.
 */
export function preserveFabricOnItems<T extends FabricLikeItem>(
  existing: FabricLikeItem[],
  incoming: T[],
): T[] {
  return incoming.map((item, index) => {
    const prev = existing[index];
    if (!prev) {
      return {
        ...item,
        fabric: undefined,
        color: undefined,
        fabricType: undefined,
        fabricColor: undefined,
        fabricCode: undefined,
      };
    }
    return {
      ...item,
      fabric: (prev.fabricType ?? prev.fabric ?? undefined) as T['fabric'],
      color: (prev.fabricColor ?? prev.color ?? undefined) as T['color'],
      fabricType: (prev.fabricType ?? undefined) as T['fabricType'],
      fabricColor: (prev.fabricColor ?? undefined) as T['fabricColor'],
      fabricCode: (prev.fabricCode ?? undefined) as T['fabricCode'],
    };
  });
}
