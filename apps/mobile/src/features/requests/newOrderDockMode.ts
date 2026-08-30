import { DEALER_TAB_BAR_CLEARANCE } from '@/navigation/tabBarClearance';
import type { NewOrderStep } from './newOrderSteps';
import { isFinalWizardStep } from './newOrderStageMath';

export type NewOrderDockMode = 'continue' | 'submit' | 'hidden';

export function newOrderDockMode(opts: {
  step: NewOrderStep | number;
  submitted: boolean;
}): NewOrderDockMode {
  if (opts.submitted) return 'hidden';
  if (isFinalWizardStep(opts.step)) return 'submit';
  return 'continue';
}

/** i18n key for the primary dock CTA. */
export function newOrderDockPrimaryKey(
  mode: NewOrderDockMode,
): 'mobile.newOrder.continue' | 'mobile.newOrder.submit' | null {
  if (mode === 'continue') return 'mobile.newOrder.continue';
  if (mode === 'submit') return 'mobile.newOrder.submit';
  return null;
}

export function newOrderDockShowsSaveDraft(mode: NewOrderDockMode): boolean {
  return mode === 'submit';
}

/** Approximate dock body height (excluding tab-bar clearance) for scroll padding. */
export const NEW_ORDER_DOCK_BODY_HEIGHT = 72;

/** Extra air under the last field so the page can scroll past the dock. */
export const NEW_ORDER_DOCK_SCROLL_EXTRA = 40;

/**
 * Bottom inset so wizard content is laid out above the floating dock
 * (and the dealer tab/FAB it sits on). Apply to the screen shell, not only
 * ScrollView content padding — content-only pad leaves short step-1 forms
 * drawn under Back/Continue.
 */
export function newOrderDockScrollPad(spacingMd: number): number {
  return (
    DEALER_TAB_BAR_CLEARANCE +
    NEW_ORDER_DOCK_BODY_HEIGHT +
    NEW_ORDER_DOCK_SCROLL_EXTRA +
    spacingMd
  );
}
