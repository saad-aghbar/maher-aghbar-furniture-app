import type { ViewStyle } from 'react-native';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';

/** Soft board elevation — same token as dealers / invoices / purchasing. */
export function productionBoardShadow(colorScheme: 'light' | 'dark'): ViewStyle {
  return orderBoardShadow(colorScheme);
}

export function productionSectionLabelStyle(locale: string, brandColor: string) {
  const englishEyebrow = locale === 'en';
  return {
    color: brandColor,
    letterSpacing: englishEyebrow ? 0.5 : 0,
    textTransform: (englishEyebrow ? 'uppercase' : 'none') as 'none' | 'uppercase',
    fontSize: 11,
  };
}

/** Nested ledger / meta panel inside a floor board. */
export function productionInsetStyle(
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
