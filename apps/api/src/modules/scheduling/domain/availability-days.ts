/**
 * Dealer availability days: selectable = Available to request only.
 * HIGH_LOAD is admin richness and is never dealer-selectable.
 */

export const ADMIN_AVAILABILITY_STATUSES = ['available', 'high_load', 'closed', 'unavailable'] as const;
export type AdminAvailabilityStatus = (typeof ADMIN_AVAILABILITY_STATUSES)[number];

export const DEALER_AVAILABILITY_STATUSES = ['available', 'unavailable'] as const;
export type DealerAvailabilityStatus = (typeof DEALER_AVAILABILITY_STATUSES)[number];

export const AVAILABILITY_REASONS = [
  'CLOSED_DAY',
  'TOO_EARLY',
  'DEALER_LEAD_TIME',
  'HIGH_LOAD',
  'MATERIAL_RISK',
  'INSUFFICIENT_CAPACITY',
] as const;
export type AvailabilityReason = (typeof AVAILABILITY_REASONS)[number];

/** Planned load at or above 100% of normal capacity is high load for dealer availability. */
export const HIGH_LOAD_PERCENT = 100;

export type AdminAvailabilityDay = {
  date: string;
  status: AdminAvailabilityStatus;
  reason: AvailabilityReason | null;
  loadPercent: number;
};

export type DealerAvailabilityDay = {
  date: string;
  status: DealerAvailabilityStatus;
  selectable: boolean;
  reason: AvailabilityReason | null;
};

export function classifyAdminAvailabilityDay(input: {
  ymd: string;
  isWorking: boolean;
  earliestYmd: string | null;
  loadPercent: number;
  remainingMinutes: number;
  requiredMinutes: number;
  materialReadyYmd?: string | null;
}): AdminAvailabilityDay {
  const loadPercent = Number.isFinite(input.loadPercent) ? Math.max(0, input.loadPercent) : 0;

  if (!input.isWorking) {
    return { date: input.ymd, status: 'closed', reason: 'CLOSED_DAY', loadPercent };
  }
  if (input.earliestYmd && input.ymd < input.earliestYmd) {
    return { date: input.ymd, status: 'unavailable', reason: 'TOO_EARLY', loadPercent };
  }
  if (input.materialReadyYmd && input.ymd < input.materialReadyYmd) {
    return { date: input.ymd, status: 'unavailable', reason: 'MATERIAL_RISK', loadPercent };
  }
  if (loadPercent >= HIGH_LOAD_PERCENT) {
    return { date: input.ymd, status: 'high_load', reason: 'HIGH_LOAD', loadPercent };
  }
  if (input.requiredMinutes > 0 && input.remainingMinutes < input.requiredMinutes) {
    return { date: input.ymd, status: 'unavailable', reason: 'INSUFFICIENT_CAPACITY', loadPercent };
  }
  return { date: input.ymd, status: 'available', reason: null, loadPercent };
}

export function toDealerAvailabilityDay(admin: AdminAvailabilityDay): DealerAvailabilityDay {
  const selectable = admin.status === 'available';
  return {
    date: admin.date,
    status: selectable ? 'available' : 'unavailable',
    selectable,
    reason: selectable ? null : admin.reason,
  };
}

export function dealerMaySelectDay(admin: AdminAvailabilityDay): boolean {
  return admin.status === 'available';
}
