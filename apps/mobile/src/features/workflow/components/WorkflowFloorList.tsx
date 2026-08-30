import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';

type BoardProps = {
  title: string;
  count?: number;
  children: ReactNode;
};

/** SUPPLIERS-style floor board: header band + compact pill rows. */
export function WorkflowFloorBoard({ title, count, children }: BoardProps) {
  const { locale, isRTL } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

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
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: theme.spacing.sm,
          paddingHorizontal: theme.spacing.md,
          paddingVertical: theme.spacing.sm + 2,
          backgroundColor: colors.surfaceSecondary,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        }}
      >
        <AppText
          variant="caption"
          weight={titleWeight}
          style={{
            textTransform: locale === 'ar' ? 'none' : 'uppercase',
            letterSpacing: locale === 'ar' ? 0 : 0.7,
            fontSize: 11,
            color: colors.brand,
            textAlign: isRTL ? 'right' : 'left',
          }}
        >
          {title}
        </AppText>
        {count != null ? (
          <AppText variant="caption" color="muted" dir="ltr">
            {String(count)}
          </AppText>
        ) : null}
      </View>
      <View
        style={{
          padding: theme.spacing.sm,
          gap: theme.spacing.sm,
        }}
      >
        {children}
      </View>
    </View>
  );
}

type RowProps = {
  label: string;
  meta?: string | null;
  icon?: keyof typeof Ionicons.glyphMap;
  /** Prefer over icon — e.g. stage index in the circle. */
  badge?: string;
  active?: boolean;
  onPress?: () => void;
  trailing?: ReactNode;
  showChevron?: boolean;
};

/** Quiet trash to remove a stage from this workflow graph (not the library). */
export function WorkflowStageRowActions({
  onDelete,
  disabled,
}: {
  onDelete: () => void;
  disabled?: boolean;
}) {
  const { colors } = useTheme();

  return (
    <AnimatedPressable
      variant="button"
      accessibilityRole="button"
      accessibilityLabel="Remove from workflow"
      disabled={disabled}
      onPress={() => {
        void haptics.selection();
        onDelete();
      }}
      hitSlop={8}
      style={{
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled ? 0.45 : 0.85,
      }}
    >
      <Ionicons name="trash-outline" size={16} color={colors.textSecondary} />
    </AnimatedPressable>
  );
}

export function WorkflowFloorRow({
  label,
  meta,
  icon = 'git-network-outline',
  badge,
  active = false,
  onPress,
  trailing,
  showChevron = true,
}: RowProps) {
  const { locale, isRTL } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  const main = (
    <View
      style={{
        flex: 1,
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        gap: theme.spacing.md,
        minWidth: 0,
        ...(isRTL
          ? { paddingRight: theme.spacing.md + 4 }
          : { paddingLeft: theme.spacing.md + 4 }),
        paddingVertical: theme.spacing.md,
      }}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: active ? colors.surface : colors.brandSoft,
          borderWidth: 1,
          borderColor: active ? colors.brand : colors.border,
        }}
      >
        {badge ? (
          <AppText
            variant="caption"
            weight="semibold"
            style={{ color: active ? colors.brand : colors.textSecondary, fontSize: 13 }}
          >
            {badge}
          </AppText>
        ) : (
          <Ionicons
            name={icon}
            size={18}
            color={active ? colors.brand : colors.textSecondary}
          />
        )}
      </View>
      <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
        <AppText
          variant="label"
          weight={active ? titleWeight : 'medium'}
          numberOfLines={1}
          style={{
            color: active ? colors.brand : colors.textPrimary,
            textAlign: isRTL ? 'right' : 'left',
          }}
        >
          {label}
        </AppText>
        {meta ? (
          <AppText
            variant="caption"
            color="muted"
            numberOfLines={1}
            style={{ textAlign: isRTL ? 'right' : 'left', fontSize: 11 }}
          >
            {meta}
          </AppText>
        ) : null}
      </View>
      {!trailing && showChevron ? (
        <Ionicons
          name={isRTL ? 'chevron-back' : 'chevron-forward'}
          size={16}
          color={colors.textMuted}
        />
      ) : null}
    </View>
  );

  return (
    <View
      style={{
        borderRadius: theme.radius.xl,
        borderWidth: active ? 1.5 : 1,
        borderColor: active ? colors.brand : colors.borderStrong,
        backgroundColor: active ? colors.brandSoft : colors.surfaceSecondary,
        overflow: 'hidden',
        ...orderBoardShadow(colorScheme),
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        paddingRight: trailing ? theme.spacing.sm : theme.spacing.md,
        paddingLeft: trailing ? 0 : undefined,
      }}
    >
      {active ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 8,
            bottom: 8,
            ...(isRTL ? { right: 0 } : { left: 0 }),
            width: 3,
            borderRadius: 2,
            backgroundColor: colors.brand,
          }}
        />
      ) : null}
      {onPress ? (
        <AnimatedPressable
          variant="button"
          accessibilityRole="button"
          onPress={onPress}
          style={{ flex: 1, minWidth: 0 }}
        >
          {main}
        </AnimatedPressable>
      ) : (
        main
      )}
      {trailing ? <View style={{ paddingVertical: theme.spacing.sm }}>{trailing}</View> : null}
    </View>
  );
}

type CompactPickProps = {
  label: string;
  meta?: string | null;
  active?: boolean;
  locked?: boolean;
  onPress: () => void;
};

/** Slim text-only pill for sheet pickers (stage name / runs-after / leads-into). */
export function WorkflowCompactPickRow({
  label,
  meta,
  active = false,
  locked = false,
  onPress,
}: CompactPickProps) {
  const { locale, isRTL } = useLocale();
  const { colors, theme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  return (
    <AnimatedPressable
      variant="button"
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={{
        borderRadius: theme.radius.xl,
        borderWidth: active ? 1.5 : 1,
        borderColor: active ? colors.brand : colors.borderStrong,
        backgroundColor: active ? colors.brandSoft : colors.surfaceSecondary,
        overflow: 'hidden',
        paddingVertical: theme.spacing.sm + 2,
        paddingHorizontal: theme.spacing.md,
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        gap: theme.spacing.sm,
      }}
    >
      {active ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 6,
            bottom: 6,
            ...(isRTL ? { right: 0 } : { left: 0 }),
            width: 3,
            borderRadius: 2,
            backgroundColor: colors.brand,
          }}
        />
      ) : null}
      <View style={{ flex: 1, gap: 2, minWidth: 0, paddingHorizontal: 2 }}>
        <AppText
          variant="label"
          weight={active ? titleWeight : 'medium'}
          numberOfLines={1}
          style={{
            color: active ? colors.brand : colors.textPrimary,
            textAlign: isRTL ? 'right' : 'left',
          }}
        >
          {locked ? `🔒 ${label}` : label}
        </AppText>
        {meta ? (
          <AppText
            variant="caption"
            color="muted"
            numberOfLines={1}
            style={{ textAlign: isRTL ? 'right' : 'left', fontSize: 11 }}
          >
            {meta}
          </AppText>
        ) : null}
      </View>
      {active ? (
        <Ionicons name="checkmark" size={16} color={colors.brand} />
      ) : locked ? (
        <Ionicons name="lock-closed" size={14} color={colors.textSecondary} />
      ) : null}
    </AnimatedPressable>
  );
}
