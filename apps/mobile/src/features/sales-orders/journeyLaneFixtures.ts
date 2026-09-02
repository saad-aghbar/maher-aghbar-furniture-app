/**
 * Deterministic Order Journey fixtures for lane cards + classifier tests.
 * Names are stable — do not rename without updating specs.
 */

import type { SalesOrderListItem } from './api';
import { classifyAdminOrderJourney } from './adminOrderJourney';
import { toAdminOrderCard } from './selectOrderCard';

const dealer = {
  id: 'cust-nile',
  code: 'NILE',
  nameEn: 'Nile Interiors',
  nameAr: 'Nile Interiors',
  nameHe: 'Nile Interiors',
};

function base(partial: Partial<SalesOrderListItem> & { id: string; number: string }): SalesOrderListItem {
  return {
    status: 'CONFIRMED',
    priority: 'NORMAL',
    title: 'Lobby Sofa',
    imageUrl: null,
    progressPercent: 0,
    progressLabel: null,
    requiredDeliveryDate: '2026-09-20T00:00:00.000Z',
    createdAt: '2026-08-01T10:00:00.000Z',
    customer: dealer,
    manufacturingCost: 1200,
    sellerPrice: 1800,
    profit: 600,
    lineCount: 1,
    productionOrders: [],
    releasedToFactory: false,
    executionStarted: false,
    ...partial,
  } as SalesOrderListItem;
}

/** Preparing — specification / setup incomplete */
export const FIXTURE_PREPARING_SPEC_INCOMPLETE = base({
  id: 'so-prep-spec',
  number: 'SO-PREP-SPEC',
  productionSetupRequired: true,
  productionSetupStatus: 'DRAFT',
  productionReadinessSummary: {
    canStart: false,
    needsSetup: true,
    materialsReady: true,
    actionHint: 'Finish specification',
    assignment: { required: 0, assigned: 0, missingCount: 0 },
  },
  journeyBucket: 'preparing',
});

/** Preparing — materials incomplete */
export const FIXTURE_PREPARING_MATERIALS_INCOMPLETE = base({
  id: 'so-prep-mats',
  number: 'SO-PREP-MATS',
  productionSetupRequired: false,
  productionSetupStatus: 'RELEASED',
  productionOrders: [{ id: 'po-mats', number: 'PO-MATS', status: 'DRAFT' }],
  productionReadinessSummary: {
    canStart: false,
    needsSetup: false,
    materialsReady: false,
    actionHint: 'Complete materials plan',
    assignment: { required: 3, assigned: 3, missingCount: 0 },
    primaryProductionOrderId: 'po-mats',
  },
  journeyBucket: 'preparing',
});

/** Preparing — workers incomplete */
export const FIXTURE_PREPARING_WORKERS_INCOMPLETE = base({
  id: 'so-prep-workers',
  number: 'SO-PREP-WORKERS',
  productionSetupStatus: 'RELEASED',
  productionOrders: [{ id: 'po-w', number: 'PO-W', status: 'DRAFT' }],
  workerAssignmentRequired: true,
  productionReadinessSummary: {
    canStart: false,
    needsSetup: false,
    materialsReady: true,
    assignment: { required: 4, assigned: 1, missingCount: 3 },
    actionHint: 'Assign remaining workers',
    primaryProductionOrderId: 'po-w',
  },
  journeyBucket: 'preparing',
});

/** Preparing — dates incomplete */
export const FIXTURE_PREPARING_DATES_INCOMPLETE = base({
  id: 'so-prep-dates',
  number: 'SO-PREP-DATES',
  productionOrders: [{ id: 'po-d', number: 'PO-D', status: 'DRAFT' }],
  productionReadinessSummary: {
    canStart: false,
    needsSetup: false,
    materialsReady: true,
    assignment: { required: 3, assigned: 3, missingCount: 0 },
    actionHint: 'Set planned dates',
    primaryProductionOrderId: 'po-d',
  },
  journeyBucket: 'preparing',
});

/** Preparing — warning only (overdue soft attention, still Preparing) */
export const FIXTURE_PREPARING_WARNING_ONLY = base({
  id: 'so-prep-warn',
  number: 'SO-PREP-WARN',
  requiredDeliveryDate: '2026-07-01T00:00:00.000Z',
  productionOrders: [{ id: 'po-warn', number: 'PO-WARN', status: 'DRAFT' }],
  productionReadinessSummary: {
    canStart: false,
    needsSetup: false,
    materialsReady: true,
    assignment: { required: 2, assigned: 2, missingCount: 0 },
    primaryProductionOrderId: 'po-warn',
  },
  journeyBucket: 'preparing',
});

/** Ready to start — released, no actual start */
export const FIXTURE_READY_TO_START = base({
  id: 'so-ready',
  number: 'SO-READY',
  status: 'READY_FOR_PRODUCTION',
  releasedToFactory: true,
  executionStarted: false,
  productionOrders: [
    {
      id: 'po-ready',
      number: 'PO-READY',
      status: 'READY',
      releasedToFactoryAt: '2026-08-20T08:00:00.000Z',
      actualStartDate: null,
    },
  ],
  productionReadinessSummary: {
    canStart: true,
    needsSetup: false,
    materialsReady: true,
    assignment: { required: 3, assigned: 3, missingCount: 0 },
    primaryProductionOrderId: 'po-ready',
  },
  journeyBucket: 'ready_to_start',
});

/** In production — first real task started */
export const FIXTURE_IN_PRODUCTION = base({
  id: 'so-inprod',
  number: 'SO-INPROD',
  status: 'IN_PRODUCTION',
  progressPercent: 42,
  progressLabel: 'Carpentry',
  releasedToFactory: true,
  executionStarted: true,
  productionOrders: [
    {
      id: 'po-inprod',
      number: 'PO-INPROD',
      status: 'IN_PROGRESS',
      releasedToFactoryAt: '2026-08-18T08:00:00.000Z',
      actualStartDate: '2026-08-21T07:30:00.000Z',
      progressPercent: 42,
    },
  ],
  productionReadinessSummary: {
    canStart: true,
    needsSetup: false,
    materialsReady: true,
    primaryProductionOrderId: 'po-inprod',
  },
  journeyBucket: 'in_production',
});

/** Attention overlay on Preparing (setup incomplete + overdue) */
export const FIXTURE_ATTENTION = FIXTURE_PREPARING_WARNING_ONLY;

/** Ready for delivery */
export const FIXTURE_READY_FOR_DELIVERY = base({
  id: 'so-rfd',
  number: 'SO-RFD',
  status: 'READY_FOR_DELIVERY',
  deliveryStatus: 'READY',
  progressPercent: 100,
  progressLabel: 'Packaging',
  releasedToFactory: true,
  executionStarted: true,
  productionOrders: [
    {
      id: 'po-rfd',
      number: 'PO-RFD',
      status: 'READY_FOR_DELIVERY',
      releasedToFactoryAt: '2026-08-10T08:00:00.000Z',
      actualStartDate: '2026-08-11T07:00:00.000Z',
    },
  ],
  journeyBucket: 'ready_to_ship',
});

/** Shipped — truck departed */
export const FIXTURE_SHIPPED = base({
  id: 'so-ship',
  number: 'SO-SHIP',
  status: 'OUT_FOR_DELIVERY',
  deliveryStatus: 'OUT_FOR_DELIVERY',
  progressPercent: 100,
  releasedToFactory: true,
  executionStarted: true,
  journeyBucket: 'shipped',
});

/** Delivered — dealer confirmed */
export const FIXTURE_DELIVERED = base({
  id: 'so-del',
  number: 'SO-DEL',
  status: 'DELIVERED',
  deliveryStatus: 'DELIVERED',
  progressPercent: 100,
  releasedToFactory: true,
  executionStarted: true,
  journeyBucket: 'delivered',
});

export const JOURNEY_LANE_FIXTURES = {
  PREPARING_SPEC_INCOMPLETE: FIXTURE_PREPARING_SPEC_INCOMPLETE,
  PREPARING_MATERIALS_INCOMPLETE: FIXTURE_PREPARING_MATERIALS_INCOMPLETE,
  PREPARING_WORKERS_INCOMPLETE: FIXTURE_PREPARING_WORKERS_INCOMPLETE,
  PREPARING_DATES_INCOMPLETE: FIXTURE_PREPARING_DATES_INCOMPLETE,
  PREPARING_WARNING_ONLY: FIXTURE_PREPARING_WARNING_ONLY,
  READY_TO_START: FIXTURE_READY_TO_START,
  IN_PRODUCTION: FIXTURE_IN_PRODUCTION,
  ATTENTION: FIXTURE_ATTENTION,
  READY_FOR_DELIVERY: FIXTURE_READY_FOR_DELIVERY,
  SHIPPED: FIXTURE_SHIPPED,
  DELIVERED: FIXTURE_DELIVERED,
} as const;

export type JourneyLaneFixtureName = keyof typeof JOURNEY_LANE_FIXTURES;

export function cardFromFixture(name: JourneyLaneFixtureName) {
  return toAdminOrderCard(JOURNEY_LANE_FIXTURES[name], 'en');
}

export function journeyFromFixture(name: JourneyLaneFixtureName) {
  const item = JOURNEY_LANE_FIXTURES[name];
  return classifyAdminOrderJourney({
    status: item.status,
    deliveryStatus: item.deliveryStatus,
    requiredDeliveryDate: item.requiredDeliveryDate,
    productionSetupRequired: item.productionSetupRequired,
    productionSetupStatus: item.productionSetupStatus,
    productionOrderCount: item.productionOrders?.length ?? 0,
    releasedToFactory: item.releasedToFactory,
    executionStarted: item.executionStarted,
    productionReadinessSummary: item.productionReadinessSummary,
    progressPercent: item.progressPercent,
    currentStageLabel: item.progressLabel,
    now: new Date('2026-09-01T12:00:00.000Z'),
  });
}

/** Worker-day capacity fixtures (pure timeline — used by workerDayPlan tests). */
export const FIXTURE_WORKER_CONFLICT_DAY = {
  name: 'WORKER_CONFLICT_DAY',
  dayYmd: '2026-09-01',
  capacityMinutes: 8 * 60,
  busy: [
    {
      startMs: new Date(2026, 8, 1, 8, 0).getTime(),
      endMs: new Date(2026, 8, 1, 10, 0).getTime(),
      label: 'SO-1031 · Carpentry',
      salesOrderNumber: 'SO-1031',
      stage: 'Carpentry',
    },
    {
      startMs: new Date(2026, 8, 1, 10, 0).getTime(),
      endMs: new Date(2026, 8, 1, 12, 30).getTime(),
      label: 'SO-1044 · Frame prep',
      salesOrderNumber: 'SO-1044',
      stage: 'Frame prep',
    },
  ],
  proposed: {
    startMs: new Date(2026, 8, 1, 9, 0).getTime(),
    endMs: new Date(2026, 8, 1, 11, 0).getTime(),
  },
} as const;

export const FIXTURE_WORKER_120_PCT_DAY = {
  name: 'WORKER_120_PCT_DAY',
  dayYmd: '2026-09-01',
  /** 400 min normal shift; busy fills full 08–16 (480) → 120% */
  capacityMinutes: 400,
  busy: [
    {
      startMs: new Date(2026, 8, 1, 8, 0).getTime(),
      endMs: new Date(2026, 8, 1, 16, 0).getTime(),
      label: 'SO-OVER · Long run',
      salesOrderNumber: 'SO-OVER',
      stage: 'Assembly',
    },
  ],
  proposed: null,
} as const;

export const FIXTURE_WORKER_FREE_WINDOWS_DAY = {
  name: 'WORKER_FREE_WINDOWS_DAY',
  dayYmd: '2026-09-01',
  capacityMinutes: 8 * 60,
  busy: [
    {
      startMs: new Date(2026, 8, 1, 8, 0).getTime(),
      endMs: new Date(2026, 8, 1, 10, 0).getTime(),
      label: 'SO-1031 · Carpentry',
      salesOrderNumber: 'SO-1031',
      stage: 'Carpentry',
    },
    {
      startMs: new Date(2026, 8, 1, 10, 0).getTime(),
      endMs: new Date(2026, 8, 1, 12, 30).getTime(),
      label: 'SO-1044 · Frame prep',
      salesOrderNumber: 'SO-1044',
      stage: 'Frame prep',
    },
    {
      startMs: new Date(2026, 8, 1, 13, 30).getTime(),
      endMs: new Date(2026, 8, 1, 15, 0).getTime(),
      label: 'SO-1052 · Carpentry',
      salesOrderNumber: 'SO-1052',
      stage: 'Carpentry',
    },
  ],
  proposed: {
    startMs: new Date(2026, 8, 1, 12, 30).getTime(),
    endMs: new Date(2026, 8, 1, 13, 30).getTime(),
  },
} as const;
