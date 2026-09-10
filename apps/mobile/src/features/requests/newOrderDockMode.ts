import { stickyCtaBottomInset } from '@/components/layout/stickyCtaInset';
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

/**
 * Dock CTA row — matches `NewOrderFloatingDock` minHeight (padding + 44 touch).
 * Exclude tab-bar clearance; that lives in `stickyCtaBottomInset`.
 */
export const NEW_ORDER_DOCK_BODY_HEIGHT = 76;

/** `FloatingActionDock` paddingTop (`theme.spacing.sm`). */
export const NEW_ORDER_DOCK_TOP_PAD = 8;

/** Extra air under the last field so fabric / notes clear the dock. */
export const NEW_ORDER_DOCK_SCROLL_EXTRA = 48;

/**
 * Bottom inset so wizard content can scroll past the floating dock
 * (and the dealer tab it sits on). Apply to ScrollView `contentContainerStyle`
 * so tall steps (extra fabric rows) actually extend the scroll range.
 */
export function newOrderDockScrollPad(spacingMd: number, safeBottom = 0): number {
  return (
    stickyCtaBottomInset(safeBottom, spacingMd, DEALER_TAB_BAR_CLEARANCE) +
    NEW_ORDER_DOCK_TOP_PAD +
    NEW_ORDER_DOCK_BODY_HEIGHT +
    NEW_ORDER_DOCK_SCROLL_EXTRA
  );
}
