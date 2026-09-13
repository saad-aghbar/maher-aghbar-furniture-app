import type { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';

/** Floor board row heights used to pin nested lists inside the page ScrollView. */
export const FLOOR_ROW_ESTIMATE = {
  measurement: 84,
  seller: 92,
  bom: 152,
  workflow: 88,
  spec: 108,
} as const;

const FLOOR_LIST_VISIBLE_ROWS = 3;

/**
 * Nested ScrollViews ignore maxHeight inside a parent ScrollView on iOS.
 * Few items stay natural height; longer lists pin a fixed box and scroll in-place.
 */
export function CappedNestedScroll({
  itemCount,
  rowEstimate,
  gap,
  visibleRows = FLOOR_LIST_VISIBLE_ROWS,
  children,
}: {
  itemCount: number;
  rowEstimate: number;
  gap: number;
  visibleRows?: number;
  children: ReactNode;
}) {
  const scrollable = itemCount > visibleRows;
  const capHeight = visibleRows * rowEstimate + Math.max(0, visibleRows - 1) * gap;

  if (!scrollable) {
    return <View style={{ gap }}>{children}</View>;
  }

  return (
    <View style={{ height: capHeight, overflow: 'hidden' }}>
      <ScrollView
        nestedScrollEnabled
        showsVerticalScrollIndicator
        keyboardShouldPersistTaps="handled"
        style={{ flex: 1 }}
        contentContainerStyle={{ gap, paddingBottom: 2 }}
      >
        {children}
      </ScrollView>
    </View>
  );
}

/** Empty inset panel used on product / variant boards. */
export function CatalogFloorEmpty({
  icon = 'cube-outline',
  message,
  title,
  body,
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  message?: string;
  title?: string;
  body?: string;
}) {
  const { colors, theme } = useTheme();
  const heading = title ?? message;
  return (
    <View
      style={{
        borderRadius: theme.radius.xl,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surfaceSecondary,
        paddingVertical: theme.spacing.xl,
        paddingHorizontal: theme.spacing.lg,
        alignItems: 'center',
        gap: theme.spacing.sm,
      }}
    >
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 22,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <Ionicons name={icon} size={20} color={colors.textMuted} />
      </View>
      {heading ? (
        <AppText variant="body" weight="medium" style={{ textAlign: 'center' }}>
          {heading}
        </AppText>
      ) : null}
      {body ? (
        <AppText variant="caption" color="muted" style={{ textAlign: 'center' }}>
          {body}
        </AppText>
      ) : title && message ? (
        <AppText variant="caption" color="muted" style={{ textAlign: 'center' }}>
          {message}
        </AppText>
      ) : null}
    </View>
  );
}

/** Small brand uppercase count header above nested floor lists. */
export function CatalogFloorListHeader({
  title,
  count,
}: {
  title: string;
  count: number;
}) {
  const { colors } = useTheme();
  const { isRTL } = useLocale();
  return (
    <View
      style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <AppText
        variant="caption"
        style={{
          fontSize: 11,
          color: colors.brand,
        }}
      >
        {title}
      </AppText>
      <AppText variant="caption" color="muted" dir="ltr">
        {count}
      </AppText>
    </View>
  );
}
