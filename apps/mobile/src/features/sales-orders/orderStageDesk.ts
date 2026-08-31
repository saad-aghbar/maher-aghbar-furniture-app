/**
 * Stage-specific Orders detail body helpers — shared identity stays on OrderDetailScreen.
 * Boards switch copy / primary CTAs by journey bucket.
 */

import type { AdminOrderLifecycle } from '../adminOrderLifecycle';

export type OrderStageDeskCopy = {
  phaseHintKey: string;
  primaryHint?: string;
};

export function orderStageDeskCopy(
  lifecycle: AdminOrderLifecycle | null | undefined,
): OrderStageDeskCopy {
  switch (lifecycle) {
    case 'preparing':
      return {
        phaseHintKey: 'mobile.orders.journey.preparing.hint',
        primaryHint: 'mobile.orders.journey.confirmPlan',
      };
    case 'ready_to_start':
      return {
        phaseHintKey: 'mobile.orders.journey.ready_to_start.hint',
        primaryHint: 'mobile.orders.journey.editPlan',
      };
    case 'in_production':
      return {
        phaseHintKey: 'mobile.orders.journey.in_production.hint',
        primaryHint: 'mobile.orders.cta.openProduction',
      };
    case 'ready_to_ship':
      return {
        phaseHintKey: 'mobile.orders.journey.ready_to_ship.hint',
        primaryHint: 'mobile.orders.cta.viewDelivery',
      };
    case 'shipped':
      return {
        phaseHintKey: 'mobile.orders.journey.shipped.hint',
      };
    case 'delivered':
      return {
        phaseHintKey: 'mobile.orders.journey.delivered.hint',
      };
    default:
      return { phaseHintKey: 'mobile.orders.journey.preparing.hint' };
  }
}
