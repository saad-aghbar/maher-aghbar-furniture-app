import { Children, Fragment, type ReactNode } from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';

type GroupProps = {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  children: ReactNode;
};

/** Parchment group: header band + in-board check rows (permissions + notification topics). */
export function FloorCheckGroup({ title, actionLabel, onAction, children }: GroupProps) {
  const { isRTL, locale } = useLocale();
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
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          width: 3,
          backgroundColor: colors.brand,
          opacity: 0.55,
          ...(isRTL ? { right: 0 } : { left: 0 }),
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
          ...(isRTL ? { paddingRight: theme.spacing.md + 4 } : { paddingLeft: theme.spacing.md + 4 }),
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          backgroundColor: colors.surfaceSecondary,
        }}
      >
        <AppText variant="caption" weight={titleWeight} color="brand" style={{ flex: 1 }}>
          {title}
        </AppText>
        {actionLabel && onAction ? (
          <AnimatedPressable
            variant="button"
            onPress={() => {
              void haptics.selection();
              onAction();
            }}
            style={{
              paddingHorizontal: theme.spacing.sm,
              paddingVertical: 4,
              borderRadius: theme.radius.full,
              backgroundColor: colors.brandSoft,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <AppText variant="caption" color="brand" weight={titleWeight}>
              {actionLabel}
            </AppText>
          </AnimatedPressable>
        ) : actionLabel ? (
          <AppText variant="caption" color="muted">
            {actionLabel}
          </AppText>
        ) : null}
      </View>
      <View>
        {Children.toArray(children).map((child, index) => (
          <Fragment key={index}>
            {index > 0 ? (
              <View style={{ height: 1, backgroundColor: colors.border }} />
            ) : null}
            {child}
          </Fragment>
        ))}
      </View>
    </View>
  );
}

type RowProps = {
  label: string;
  hint?: string;
  checked: boolean;
  onToggle?: () => void;
  disabled?: boolean;
  children?: ReactNode;
};

export function FloorCheckRow({
  label,
  hint,
  checked,
  onToggle,
  disabled = false,
  children,
}: RowProps) {
  const { isRTL, locale } = useLocale();
  const { colors, theme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const editable = Boolean(onToggle) && !disabled;

  return (
    <AnimatedPressable
      variant="button"
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled: !editable }}
      accessibilityLabel={label}
      disabled={!editable}
      onPress={() => {
        if (!editable) return;
        void haptics.selection();
        onToggle?.();
      }}
      style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'flex-start',
        gap: theme.spacing.md,
        paddingHorizontal: theme.spacing.md,
        paddingVertical: theme.spacing.md,
        ...(isRTL ? { paddingRight: theme.spacing.md + 4 } : { paddingLeft: theme.spacing.md + 4 }),
        backgroundColor: checked ? colors.brandSoft : 'transparent',
        opacity: editable ? 1 : 0.92,
      }}
    >
      <View
        style={{
          width: 22,
          height: 22,
          marginTop: 1,
          borderRadius: 11,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 1.5,
          borderColor: checked ? colors.brand : colors.borderStrong,
          backgroundColor: checked ? colors.brand : colors.surface,
        }}
      >
        {checked ? <Ionicons name="checkmark" size={13} color={colors.onBrand} /> : null}
      </View>
      <View style={{ flex: 1, gap: 2, alignItems: isRTL ? 'flex-end' : 'flex-start' }}>
        <AppText variant="label" weight={checked ? titleWeight : 'medium'}>
          {label}
        </AppText>
        {hint ? (
          <AppText variant="caption" color="muted">
            {hint}
          </AppText>
        ) : null}
        {children}
      </View>
    </AnimatedPressable>
  );
}
