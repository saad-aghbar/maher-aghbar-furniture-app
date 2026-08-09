/**
 * Shared helpers to open the production workflow map from progress bars.
 * Workers never get a flow route.
 */
import type { Href } from 'expo-router';

export function adminOrderFlowHref(orderId: string): Href {
  return `/(app)/(admin)/orders/${orderId}/flow` as Href;
}

export function dealerOrderFlowHref(orderId: string): Href {
  return `/(app)/(customer)/orders/${orderId}/flow` as Href;
}

export function adminProductionFlowHref(productionOrderId: string): Href {
  return `/(app)/(admin)/production/${productionOrderId}/flow` as Href;
}
