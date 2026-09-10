import { BadRequestException } from '@nestjs/common';

export const RETURN_LIFECYCLE_STATES = [
  'REQUESTED',
  'NEED_INFO',
  'APPROVED',
  'IN_TRANSIT',
  'RECEIVED',
  'INSPECTING',
  'REWORKING',
  'REPLACING',
  'READY_TO_RETURN',
  'RETURNING',
  'RETURNED_TO_STOCK',
  'SCRAPPED',
  'COMPLETED',
  'REJECTED',
] as const;

export type ReturnLifecycleState = (typeof RETURN_LIFECYCLE_STATES)[number];

const ALLOWED: Record<ReturnLifecycleState, readonly ReturnLifecycleState[]> = {
  REQUESTED: ['NEED_INFO', 'APPROVED', 'REJECTED'],
  NEED_INFO: ['APPROVED', 'REJECTED', 'REQUESTED'],
  APPROVED: ['IN_TRANSIT', 'RECEIVED', 'REJECTED'],
  IN_TRANSIT: ['RECEIVED'],
  RECEIVED: ['INSPECTING', 'RETURNED_TO_STOCK', 'SCRAPPED', 'REWORKING', 'REPLACING'],
  INSPECTING: ['RETURNED_TO_STOCK', 'SCRAPPED', 'REWORKING', 'REPLACING'],
  REWORKING: ['READY_TO_RETURN', 'INSPECTING'],
  REPLACING: ['READY_TO_RETURN', 'INSPECTING'],
  READY_TO_RETURN: ['RETURNING'],
  RETURNING: ['COMPLETED'],
  RETURNED_TO_STOCK: ['COMPLETED'],
  SCRAPPED: ['COMPLETED'],
  COMPLETED: [],
  REJECTED: [],
};

export function canTransition(
  from: ReturnLifecycleState | string | null | undefined,
  to: ReturnLifecycleState,
): boolean {
  const current = normalizeLifecycle(from);
  if (current === to) return true;
  return (ALLOWED[current] ?? []).includes(to);
}

export function assertTransition(
  from: ReturnLifecycleState | string | null | undefined,
  to: ReturnLifecycleState,
): void {
  if (canTransition(from, to)) return;
  const current = normalizeLifecycle(from);
  throw Object.assign(new Error(`Cannot move a return from ${current} to ${to}.`), {
    code: 'RETURN_INVALID_TRANSITION',
    from: current,
    to,
  });
}

export function normalizeLifecycle(
  value: ReturnLifecycleState | string | null | undefined,
): ReturnLifecycleState {
  const raw = String(value ?? 'REQUESTED').trim().toUpperCase();
  return (RETURN_LIFECYCLE_STATES as readonly string[]).includes(raw)
    ? (raw as ReturnLifecycleState)
    : 'REQUESTED';
}

export function deriveLifecycleFromLegacy(input: {
  approvalStatus?: string | null;
  physicalStatus?: string | null;
  inventoryFate?: string | null;
}): ReturnLifecycleState {
  const approval = String(input.approvalStatus ?? 'PENDING').trim().toUpperCase();
  const physical = String(input.physicalStatus ?? 'NONE').trim().toUpperCase();
  const fate = String(input.inventoryFate ?? 'PENDING').trim().toUpperCase();

  if (approval === 'REJECTED') return 'REJECTED';
  if (physical === 'RESOLVED') return 'COMPLETED';
  if (fate === 'RETURN_TO_STOCK') return 'RETURNED_TO_STOCK';
  if (fate === 'DAMAGED' || fate === 'SCRAP') return 'SCRAPPED';
  if (fate === 'REWORK') return 'REWORKING';
  if (physical === 'INSPECTING') return 'INSPECTING';
  if (physical === 'RETURNED') return 'RECEIVED';
  if (physical === 'WAITING_RETURN') return 'APPROVED';
  if (approval === 'NEED_INFO') return 'NEED_INFO';
  if (approval === 'APPROVED') return 'APPROVED';
  return 'REQUESTED';
}

export function legacyFieldsFromLifecycle(state: ReturnLifecycleState): {
  approvalStatus: string;
  physicalStatus: string;
} {
  switch (state) {
    case 'REQUESTED':
      return { approvalStatus: 'PENDING', physicalStatus: 'NONE' };
    case 'NEED_INFO':
      return { approvalStatus: 'NEED_INFO', physicalStatus: 'NONE' };
    case 'APPROVED':
      return { approvalStatus: 'APPROVED', physicalStatus: 'WAITING_RETURN' };
    case 'IN_TRANSIT':
      return { approvalStatus: 'APPROVED', physicalStatus: 'WAITING_RETURN' };
    case 'RECEIVED':
      return { approvalStatus: 'APPROVED', physicalStatus: 'RETURNED' };
    case 'INSPECTING':
      return { approvalStatus: 'APPROVED', physicalStatus: 'INSPECTING' };
    case 'REWORKING':
    case 'REPLACING':
    case 'READY_TO_RETURN':
    case 'RETURNING':
      return { approvalStatus: 'APPROVED', physicalStatus: 'INSPECTING' };
    case 'RETURNED_TO_STOCK':
    case 'SCRAPPED':
    case 'COMPLETED':
      return { approvalStatus: 'APPROVED', physicalStatus: 'RESOLVED' };
    case 'REJECTED':
      return { approvalStatus: 'REJECTED', physicalStatus: 'NONE' };
  }
}

export function tryApplyLifecycle(
  current: ReturnLifecycleState | string | null | undefined,
  next: ReturnLifecycleState,
): { lifecycleState: ReturnLifecycleState; approvalStatus: string; physicalStatus: string } | null {
  if (!canTransition(current, next)) return null;
  const legacy = legacyFieldsFromLifecycle(next);
  return { lifecycleState: next, ...legacy };
}

export function applyLifecycle(
  current: ReturnLifecycleState | string | null | undefined,
  next: ReturnLifecycleState,
): { lifecycleState: ReturnLifecycleState; approvalStatus: string; physicalStatus: string } {
  assertTransition(current, next);
  const legacy = legacyFieldsFromLifecycle(next);
  return { lifecycleState: next, ...legacy };
}

/**
 * New approvals may only open REPAIR or REPLACEMENT.
 * CREDIT_NOTE / REFUND stay on the Prisma enum so the one existing row remains readable.
 */
export function approvedReturnResolution(
  raw?: string | null,
): 'REPAIR' | 'REPLACEMENT' {
  const value = String(raw ?? '').trim().toUpperCase();
  if (value === 'CREDIT_NOTE' || value === 'REFUND') {
    throw new BadRequestException({
      code: 'RETURN_FINANCE_ADJUSTMENT_DISABLED',
      message: 'Credit notes and refunds are not opened from returns.',
    });
  }
  return value === 'REPAIR' ? 'REPAIR' : 'REPLACEMENT';
}
