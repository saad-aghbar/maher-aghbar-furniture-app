import type { AuthUser } from '@maher/types';
import { isStaffRoleKind, type AppSurface } from '@maher/permissions';
import type { TabDef, TabName } from './tabConfig';

/** Matches PersistentSurfaceTabBar ACTIVE_HEIGHT — compact Staff capsule min / height. */
export const STAFF_CAPSULE_MIN = 46;
/** Capsule must not approach half a 2-tab bar on a small phone. */
export const STAFF_CAPSULE_MAX = 148;
export const STAFF_SLOT_GUTTER = 8;
export const STAFF_LABEL_PAD_X = 14;
export const STAFF_ICON_SIZE = 22;
export const STAFF_ICON_LABEL_GAP = 8;
export const STAFF_LABEL_MAX = 120;
export const STAFF_PILL_DURATION_MS = 220;
/** SHELL_PAD (6) * 2 + ACTIVE_HEIGHT (46) — bar chrome must not change per screen. */
export const STAFF_SHELL_HEIGHT = 58;

export type SlotRect = { x: number; width: number };

/**
 * Custom Staff on the admin surface. Never a staff-type code.
 * Missing rolesDetailed keeps the Admin layout (safe).
 */
export function shouldUseStaffAdaptiveTabLayout(
  surface: AppSurface,
  user: AuthUser | null | undefined,
): boolean {
  if (surface !== 'admin' || !user) return false;
  return (user.rolesDetailed ?? []).some((detail) => isStaffRoleKind(detail.kind));
}

export function equalSlotLayouts(trackWidth: number, count: number): SlotRect[] {
  if (count <= 0 || trackWidth <= 0) return [];
  const width = trackWidth / count;
  return Array.from({ length: count }, (_, i) => ({ x: i * width, width }));
}

/** Content-aware capsule centered in an equal slot. Never slotWidth as the visible pill. */
export function staffCapsuleInSlot(slot: SlotRect, contentWidth: number): SlotRect {
  const maxInSlot = Math.max(STAFF_CAPSULE_MIN, slot.width - STAFF_SLOT_GUTTER * 2);
  const width = Math.min(
    STAFF_CAPSULE_MAX,
    maxInSlot,
    Math.max(STAFF_CAPSULE_MIN, contentWidth),
  );
  return {
    x: slot.x + Math.max(0, (slot.width - width) / 2),
    width,
  };
}

export function estimateStaffContentWidth(labelWidth: number, selected: boolean): number {
  if (!selected) return STAFF_ICON_SIZE;
  const text = Math.min(STAFF_LABEL_MAX, Math.max(0, labelWidth));
  return STAFF_LABEL_PAD_X * 2 + STAFF_ICON_SIZE + STAFF_ICON_LABEL_GAP + text;
}

export function staffVisualLayouts(
  slots: SlotRect[],
  contentWidths: readonly number[],
): SlotRect[] {
  return slots.map((slot, i) => staffCapsuleInSlot(slot, contentWidths[i] ?? STAFF_CAPSULE_MIN));
}

export function rectsOverlap(a: SlotRect, b: SlotRect): boolean {
  return a.x < b.x + b.width - 0.5 && b.x < a.x + a.width - 0.5;
}

export function capsuleFitsSlot(slot: SlotRect, capsule: SlotRect): boolean {
  return capsule.x >= slot.x - 0.5 && capsule.x + capsule.width <= slot.x + slot.width + 0.5;
}

/** If the selected destination disappeared, land on Home. */
export function staffFallbackTabName(
  tabs: readonly Pick<TabDef, 'name'>[],
  activeName: string | null | undefined,
): TabName {
  if (activeName && tabs.some((tab) => tab.name === activeName)) {
    return activeName as TabName;
  }
  if (tabs.some((tab) => tab.name === 'index')) return 'index';
  return tabs[0]?.name ?? 'index';
}
