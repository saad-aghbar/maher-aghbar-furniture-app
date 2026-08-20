import type { OwnOrderSchedule, SchedulePromiseState } from '@/api/modules/scheduling';

export type ChangeDateCtaMode = 'update' | 'request' | 'locked' | 'hidden';

export type ChangeDateCta = {
  mode: ChangeDateCtaMode;
  /** i18n key for the CTA button label (empty when hidden). */
  labelKey: string;
};

/**
 * Maps the dealer date-change policy (`canUpdateDeliveryDate` /
 * `canRequestDateChange` / `dateChangeLocked`) to a single UI mode + label.
 * Pure — no side effects — so both the button and its sheet stay in sync.
 */
export function selectChangeDateCta(
  schedule: OwnOrderSchedule | null | undefined,
): ChangeDateCta {
  if (!schedule) return { mode: 'hidden', labelKey: '' };
  if (schedule.canUpdateDeliveryDate) {
    return { mode: 'update', labelKey: 'mobile.orderDetail.schedule.changeDate' };
  }
  if (schedule.canRequestDateChange) {
    return { mode: 'request', labelKey: 'mobile.orderDetail.schedule.requestDateChange' };
  }
  return { mode: 'locked', labelKey: 'mobile.orderDetail.schedule.dateLocked' };
}

export type OrderPromiseSummary = {
  promiseState: SchedulePromiseState | string;
  customerStatus?: string | null;
  committedDeliveryDate: string | null;
  requestedDeliveryDate: string | null;
  suggestedDeliveryDate: string | null;
  projectedDeliveryDate: string | null;
  plannedDeliveryDate: string | null;
  actualDeliveryDate: string | null;
  compactDates: boolean;
  /** No committed date yet — show the suggested date labeled as an estimate. */
  showEstimateOnly: boolean;
};

/** Dealer-facing promise summary view model for the order detail screen. */
export function selectOrderPromiseSummary(
  schedule: OwnOrderSchedule | null | undefined,
): OrderPromiseSummary | null {
  if (!schedule) return null;
  return {
    promiseState: schedule.customerStatus ?? schedule.promiseState,
    customerStatus: schedule.customerStatus ?? null,
    committedDeliveryDate: schedule.committedDeliveryDate,
    requestedDeliveryDate: schedule.requestedDeliveryDate,
    suggestedDeliveryDate: schedule.suggestedDeliveryDate,
    projectedDeliveryDate: schedule.projectedDeliveryDate ?? null,
    plannedDeliveryDate: schedule.plannedDeliveryDate ?? null,
    actualDeliveryDate: schedule.actualDeliveryDate ?? null,
    compactDates: Boolean(schedule.compactDates),
    showEstimateOnly: !schedule.committedDeliveryDate && Boolean(schedule.suggestedDeliveryDate),
  };
}
