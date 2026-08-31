/**
 * Seed Orders desk chip when navigating from RFQ → Open Sales Order,
 * so back-to-list lands on Preparing.
 */

import type { AdminLifecycleChipKey } from './components/AdminLifecycleChips';

let pendingChip: AdminLifecycleChipKey | null = null;

export function seedOrdersDeskChip(chip: AdminLifecycleChipKey): void {
  pendingChip = chip;
}

export function consumeOrdersDeskChip(): AdminLifecycleChipKey | null {
  const next = pendingChip;
  pendingChip = null;
  return next;
}
