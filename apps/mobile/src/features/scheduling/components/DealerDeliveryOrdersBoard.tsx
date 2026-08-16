import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { AnimatedPressable, haptics } from '@/motion';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';

export const DEALER_FLOOR_VISIBLE_ROWS = 3;
export const DEALER_FLOOR_ROW_ESTIMATE = 168;

type BoardProps = {
  title: string;
  count: number;
  caption?: string;
  headerAction?: ReactNode;
  expanded?: boolean;
  onToggleExpand?: () => void;
  children: ReactNode;
};

export function DealerBoardPill({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  const { colors, theme } = useTheme();

  return (
    <AnimatedPressable
      variant="button"
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => {
        void haptics.selection();
        onPress();
      }}
      style={{
        minHeight: 28,
        paddingHorizontal: 10,
        borderRadius: theme.radius.full,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.brandSoft,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: colors.brand,
      }}
    >
      <AppText variant="caption" weight="semibold" style={{ color: colors.brand, fontSize: 11 }}>
        {label}
      </AppText>
    </AnimatedPressable>
  );
}

export function DealerBoardEmpty({ title, description }: { title: string; description: string }) {
  const { theme } = useTheme();

  return (
    <View
      accessibilityRole="summary"
      style={{
        paddingVertical: theme.spacing.xl,
        paddingHorizontal: theme.spacing.md,
        gap: theme.spacing.xs,
      }}
    >
      <AppText variant="label" align="center">
        {title}
      </AppText>
      <AppText variant="caption" color="muted" align="center">
        {description}
      </AppText>
    </View>
  );
}

export function DealerDeliveryOrdersBoard({
  title,
  count,
  caption,
  headerAction,
  expanded,
  onToggleExpand,
  children,
}: BoardProps) {
  const { t, tPlural, isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const showExpand = Boolean(onToggleExpand && count > DEALER_FLOOR_VISIBLE_ROWS);

  return (
    <View
      style={{
        borderRadius: theme.radius.xl,
        borderWidth: 1,
        borderColor: colors.borderStrong,
        backgroundColor: colors.surface,
        overflow: 'hidden',
        ...orderBoardShadow(colorScheme),
      }}
    >
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          ...(isRTL ? { right: 0 } : { left: 0 }),
          width: 3,
          backgroundColor: colors.brand,
          opacity: 0.55,
        }}
      />
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: theme.spacing.sm,
          paddingHorizontal: theme.spacing.md,
          paddingVertical: theme.spacing.sm + 2,
          ...(isRTL
            ? { paddingRight: theme.spacing.md + 4 }
            : { paddingLeft: theme.spacing.md + 4 }),
          backgroundColor: colors.surfaceSecondary,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        }}
      >
        <AppText
          variant="caption"
          weight={titleWeight}
          numberOfLines={2}
          style={{
            flex: 1,
            textTransform: locale === 'ar' ? 'none' : 'uppercase',
            letterSpacing: locale === 'ar' ? 0 : 0.7,
            fontSize: 11,
            color: colors.brand,
            textAlign: isRTL ? 'right' : 'left',
          }}
        >
          {title}
        </AppText>
        {headerAction}
        <View
          style={{
            minWidth: 28,
            paddingHorizontal: 8,
            paddingVertical: 3,
            borderRadius: theme.radius.full,
            backgroundColor: colors.brandSoft,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: colors.brand,
            alignItems: 'center',
          }}
        >
          <AppText
            variant="caption"
            weight="semibold"
            dir="ltr"
            style={{ color: colors.brand, fontVariant: ['tabular-nums'], fontSize: 12 }}
          >
            {String(count)}
          </AppText>
        </View>
      </View>

      {caption ? (
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            gap: 8,
            paddingHorizontal: theme.spacing.md,
            paddingTop: theme.spacing.sm + 2,
            paddingBottom: theme.spacing.sm + 2,
            ...(isRTL
              ? { paddingRight: theme.spacing.md + 4 }
              : { paddingLeft: theme.spacing.md + 4 }),
            backgroundColor: colors.surface,
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: colors.border,
          }}
        >
          <Ionicons name="information-circle-outline" size={16} color={colors.textSecondary} />
          <AppText
            variant="caption"
            color="secondary"
            style={{ flex: 1, textAlign: isRTL ? 'right' : 'left' }}
          >
            {caption}
          </AppText>
        </View>
      ) : null}

      <View
        style={{
          backgroundColor: colors.surfaceSecondary,
          padding: theme.spacing.sm,
          ...(isRTL
            ? { paddingRight: theme.spacing.sm + 2 }
            : { paddingLeft: theme.spacing.sm + 2 }),
        }}
      >
        {children}
      </View>

      {showExpand ? (
        <AnimatedPressable
          variant="button"
          accessibilityRole="button"
          accessibilityLabel={
            expanded
              ? t('mobile.adminScheduling.showFewerOrders')
              : tPlural('mobile.adminScheduling.viewAllOrders', count)
          }
          onPress={() => {
            void haptics.selection();
            onToggleExpand?.();
          }}
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            paddingVertical: theme.spacing.sm,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: colors.border,
            backgroundColor: colors.surface,
          }}
        >
          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={14}
            color={colors.textMuted}
          />
          <AppText variant="caption" color="muted" style={{ fontSize: 11 }}>
            {expanded
              ? t('mobile.adminScheduling.showFewerOrders')
              : tPlural('mobile.adminScheduling.viewAllOrders', count)}
          </AppText>
        </AnimatedPressable>
      ) : null}
    </View>
  );
}

export function DealerCappedNestedScroll({
  itemCount,
  expanded,
  children,
}: {
  itemCount: number;
  expanded?: boolean;
  children: ReactNode;
}) {
  const { colors, theme } = useTheme();
  const gap = theme.spacing.sm;
  const scrollable = !expanded && itemCount > DEALER_FLOOR_VISIBLE_ROWS;
  const capHeight =
    DEALER_FLOOR_VISIBLE_ROWS * DEALER_FLOOR_ROW_ESTIMATE +
    Math.max(0, DEALER_FLOOR_VISIBLE_ROWS - 1) * gap;

  if (!scrollable) {
    return <View style={{ gap }}>{children}</View>;
  }

  return (
    <View
      style={{
        height: capHeight,
        overflow: 'hidden',
        borderRadius: theme.radius.lg,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: colors.border,
        backgroundColor: colors.surface,
      }}
    >
      <ScrollView
        nestedScrollEnabled
        showsVerticalScrollIndicator
        keyboardShouldPersistTaps="handled"
        style={{ flex: 1 }}
        contentContainerStyle={{ gap, padding: theme.spacing.sm, paddingBottom: theme.spacing.md }}
      >
        {children}
      </ScrollView>
    </View>
  );
}
