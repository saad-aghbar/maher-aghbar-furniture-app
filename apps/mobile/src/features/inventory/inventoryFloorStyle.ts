import type { ViewStyle } from 'react-native';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';

/** Soft board elevation — same token as dealers / production. */
export function inventoryBoardShadow(colorScheme: 'light' | 'dark'): ViewStyle {
  return orderBoardShadow(colorScheme);
}

export function inventorySectionLabelStyle(locale: string, brandColor: string) {
  return {
    color: brandColor,
    letterSpacing: locale === 'ar' ? 0 : 0.5,
    textTransform: (locale === 'ar' ? 'none' : 'uppercase') as 'none' | 'uppercase',
    fontSize: 11,
  };
}

/** Nested ledger / qty panel inside a floor board. */
export function inventoryInsetStyle(
  theme: { radius: { lg: number }; spacing: { md: number; sm: number } },
  colors: { surfaceSecondary: string; border: string },
): ViewStyle {
  return {
    borderRadius: theme.radius.lg,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  };
}
