/**
 * Shared helpers to open the production workflow map from progress bars.
 * Workers never get a flow route.
 */
import type { Href } from 'expo-router';

function withPo(base: string, productionOrderId?: string): Href {
  return (
    productionOrderId
      ? `${base}?po=${encodeURIComponent(productionOrderId)}`
      : base
  ) as Href;
}

export function adminOrderFlowHref(orderId: string, productionOrderId?: string): Href {
  return withPo(`/(app)/(admin)/orders/${orderId}/flow`, productionOrderId);
}

export function dealerOrderFlowHref(orderId: string, productionOrderId?: string): Href {
  return withPo(`/(app)/(customer)/orders/${orderId}/flow`, productionOrderId);
}

export function adminProductionFlowHref(productionOrderId: string): Href {
  return `/(app)/(admin)/production/${productionOrderId}/flow` as Href;
}

export function adminProductionPlanHref(
  productionOrderId: string,
  taskId?: string | null,
): Href {
  const base = `/(app)/(admin)/production/${productionOrderId}/plan`;
  return (taskId ? `${base}?task=${encodeURIComponent(taskId)}` : base) as Href;
}
