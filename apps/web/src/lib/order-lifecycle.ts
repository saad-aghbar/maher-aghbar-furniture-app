/**
 * Customer-safe order lifecycle stepper — mirrors admin production-lifecycle semantics.
 */

export type OrderLifecycleStep =
  | 'production'
  | 'inspection'
  | 'packaging'
  | 'ready'
  | 'shipped'
  | 'delivered';

const STEPS: OrderLifecycleStep[] = [
  'production',
  'inspection',
  'packaging',
  'ready',
  'shipped',
  'delivered',
];

export function orderLifecycleSteps(): OrderLifecycleStep[] {
  return STEPS;
}

type PoSnippet = {
  status?: string;
  currentStageCode?: string | null;
  progressPercent?: number | null;
};

export function deriveOrderLifecycle(input: {
  salesOrderStatus: string;
  productionOrders?: PoSnippet[];
  deliveryStatus?: string | null;
}): OrderLifecycleStep {
  const so = input.salesOrderStatus.toUpperCase();
  const delivery = input.deliveryStatus?.toUpperCase() ?? null;

  if (delivery === 'DELIVERED' || so === 'DELIVERED' || so === 'COMPLETED') return 'delivered';
  if (delivery === 'OUT_FOR_DELIVERY') return 'shipped';
  if (so === 'READY_FOR_DELIVERY' || delivery === 'READY' || delivery === 'PLANNED') return 'ready';

  const po = input.productionOrders?.[0];
  const code = po?.currentStageCode?.toUpperCase() ?? null;
  if (code === 'PACKAGING') return 'packaging';
  if (code === 'INSPECTION') return 'inspection';
  if ((po?.progressPercent ?? 0) > 0 || so === 'IN_PRODUCTION') return 'production';

  return 'production';
}

export function stepLabelKey(step: OrderLifecycleStep): string {
  switch (step) {
    case 'production':
      return 'timelineProduction';
    case 'inspection':
      return 'timelineInspection';
    case 'packaging':
      return 'timelinePackaging';
    case 'ready':
      return 'readyForDelivery';
    case 'shipped':
      return 'shipped';
    case 'delivered':
      return 'tabs.delivered';
  }
}
