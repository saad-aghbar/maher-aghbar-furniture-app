import { useWindowDimensions } from 'react-native';
import { resolveWindowClass } from '@/adaptive/breakpoints';
import { useMaherLayout } from '@/adaptive/useMaherLayout';

/** Default BottomSheet cap on phone. Desk uses `SHEET_HEIGHT_DESK_RATIO`. */
export const SHEET_HEIGHT_PHONE_RATIO = 0.82;
export const SHEET_HEIGHT_DESK_RATIO = 0.86;

export function sheetIsDeskWidth(windowWidth: number): boolean {
  const windowClass = resolveWindowClass(windowWidth);
  return windowClass === 'expanded' || windowClass === 'wide';
}

/** Full picker / list sheet height — phone vs iPad desk. No 560pt cap. */
export function sheetPickerHeight(windowHeight: number, isDesk: boolean): number {
  const ratio = isDesk ? SHEET_HEIGHT_DESK_RATIO : SHEET_HEIGHT_PHONE_RATIO;
  return Math.round(windowHeight * ratio);
}

/** Primary scroll region inside a picker sheet (catalog, dealers, specs). */
export function sheetScrollListHeight(windowHeight: number, isDesk: boolean): number {
  if (isDesk) return Math.max(400, Math.round(windowHeight * 0.46));
  return Math.max(300, Math.round(windowHeight * 0.4));
}

/**
 * Nested list inside a taller sheet (warehouse box, filter dealer list).
 * Shorter than the primary catalog list so two boxes can share one sheet.
 */
export function sheetNestedListHeight(windowHeight: number, isDesk: boolean): number {
  if (isDesk) return Math.max(320, Math.round(windowHeight * 0.32));
  return Math.max(240, Math.round(windowHeight * 0.28));
}

export function useSheetListViewport() {
  const { height } = useWindowDimensions();
  const { isDesk } = useMaherLayout();
  return {
    windowHeight: height,
    isDesk,
    sheetHeight: sheetPickerHeight(height, isDesk),
    listHeight: sheetScrollListHeight(height, isDesk),
    nestedListHeight: sheetNestedListHeight(height, isDesk),
  };
}
