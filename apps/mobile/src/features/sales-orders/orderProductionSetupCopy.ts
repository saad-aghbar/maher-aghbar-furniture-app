import type { OrderCostMaterial, OrderDetailViewModel } from './selectOrderDetail';

export type OrderProductionSetupFacts = {
  released: boolean;
  lineCount: number;
  linesReadyCount: number;
  materialsNeedReview: boolean;
  estimateIncomplete: boolean;
  remainingIssueCount: number;
  setupProgressPercent: number;
};

const RELEASED_STATUSES = new Set([
  'RELEASED',
  'READY_FOR_PRODUCTION',
  'IN_PRODUCTION',
  'WAITING_FOR_MATERIALS',
  'READY_FOR_DELIVERY',
  'DELIVERED',
  'COMPLETED',
]);

function normalizeStatus(status: string): string {
  return status.trim().toUpperCase().replace(/\s+/g, '_');
}

/** Floor work is already released — do not keep saying REQUIRED / “then release”. */
export function isReleasedToFactory(
  status: string,
  productionOrderCount: number,
): boolean {
  const key = normalizeStatus(status);
  if (key === 'DRAFT' || key === 'CANCELLED') return false;
  if (productionOrderCount > 0) return true;
  return RELEASED_STATUSES.has(key);
}

function materialCostMissing(materials: OrderCostMaterial[]): boolean {
  return materials.some((row) => (row.qty ?? 0) > 0 && row.cost == null);
}

export function remainingIssueCount(input: {
  linesReadyCount: number;
  lineCount: number;
  materialsNeedReview: boolean;
  estimateIncomplete: boolean;
}): number {
  let n = 0;
  if (input.lineCount > 0 && input.linesReadyCount < input.lineCount) n += 1;
  if (input.materialsNeedReview) n += 1;
  if (input.estimateIncomplete) n += 1;
  return n;
}

export function selectOrderProductionSetup(
  vm: OrderDetailViewModel,
): OrderProductionSetupFacts {
  const released = isReleasedToFactory(vm.status, vm.productionOrders.length);
  const lineCount = vm.items.length;
  const linesReadyCount = vm.items.filter((item) => Boolean(item.productName.trim())).length;
  const missingCosts = materialCostMissing(vm.costMaterials);
  const materialsNeedReview = vm.showCosts && (vm.costMaterials.length === 0 || missingCosts);
  const estimateIncomplete =
    vm.showCosts && (vm.manufacturingCost == null || missingCosts);
  return {
    released,
    lineCount,
    linesReadyCount,
    materialsNeedReview,
    estimateIncomplete,
    remainingIssueCount: remainingIssueCount({
      linesReadyCount,
      lineCount,
      materialsNeedReview,
      estimateIncomplete,
    }),
    setupProgressPercent: released ? 100 : lineCount > 0 ? 50 : 25,
  };
}

export function orderProductionSetupPlanCopy(
  released: boolean,
  t: (key: string) => string,
): { kicker: string; body: string } {
  if (released) {
    return {
      kicker: t('mobile.orderProductionSetup.planKicker'),
      body: t('mobile.orderProductionSetup.planReleasedBody'),
    };
  }
  return {
    kicker: t('mobile.orderProductionSetup.planRequiredKicker'),
    body: t('mobile.orderProductionSetup.planRequiredBody'),
  };
}
