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

  if (delivery === 'DELIVERED') return 'delivered';
  if (delivery === 'OUT_FOR_DELIVERY') return 'shipped';
  if (so === 'READY_FOR_DELIVERY' || delivery === 'READY' || delivery === 'PLANNED') return 'ready';

  const pos = input.productionOrders ?? [];
  if (!pos.length) return 'production';

  const rank: Record<OrderLifecycleStep, number> = {
    production: 0,
    inspection: 1,
    packaging: 2,
    ready: 3,
    shipped: 4,
    delivered: 5,
  };
  const stepFor = (po: PoSnippet): OrderLifecycleStep => {
    const status = po.status?.toUpperCase() ?? '';
    const code = po.currentStageCode?.toUpperCase() ?? '';
    if (status === 'COMPLETED') return 'ready';
    if (code === 'PACKAGING' || status === 'READY_FOR_PACKAGING') return 'packaging';
    if (code === 'INSPECTION' || status === 'QUALITY_CHECK') return 'inspection';
    return 'production';
  };
  return pos.map(stepFor).reduce((least, step) => (rank[step] < rank[least] ? step : least));
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
