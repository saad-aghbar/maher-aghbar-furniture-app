import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';

type Props = {
  primaryLabel?: string;
  onPrimary?: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
  loading?: boolean;
  disabled?: boolean;
  /** Keep the secondary (cancel) action tappable while the primary is busy. */
  cancelWhileLoading?: boolean;
};

/**
 * Floor sheet actions — pill primary with soft brand lift, outlined cancel.
 */
export function InventorySheetFooter({
  primaryLabel,
  onPrimary,
  secondaryLabel,
  onSecondary,
  loading,
  disabled,
  cancelWhileLoading,
}: Props) {
  const { t, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const busy = Boolean(loading);
  const blocked = Boolean(disabled || loading);
  const cancelBlocked = Boolean(busy && !cancelWhileLoading);
  const cancelLabel = secondaryLabel ?? t('mobile.inventory.cancel');
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const dark = colorScheme === 'dark';
  const showPrimary = Boolean(primaryLabel && onPrimary);
  const showSecondary = Boolean(onSecondary);

  return (
    <View
      style={{
        gap: theme.spacing.sm,
        paddingTop: theme.spacing.md,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: colors.border,
      }}
    >
      {showPrimary ? (
        <AnimatedPressable
          variant="button"
          accessibilityRole="button"
          accessibilityLabel={primaryLabel!}
          accessibilityState={{ disabled: blocked, busy }}
          disabled={blocked}
          onPress={() => {
            void haptics.confirmLight();
            onPrimary?.();
          }}
          style={{
            minHeight: theme.sizes.touch.min,
            borderRadius: theme.radius.full,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: theme.spacing.lg,
            backgroundColor: blocked ? colors.disabledFill : colors.brand,
            ...(blocked
              ? null
              : dark
                ? {
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 6 },
                    shadowOpacity: 0.35,
                    shadowRadius: 10,
                    elevation: 5,
                  }
                : {
                    shadowColor: colors.brand,
                    shadowOffset: { width: 0, height: 6 },
                    shadowOpacity: 0.28,
                    shadowRadius: 12,
                    elevation: 4,
                  }),
          }}
        >
          {busy ? (
            <ActivityIndicator color={colors.onBrand} />
          ) : (
            <AppText
              variant="label"
              weight={titleWeight}
              style={{ color: blocked ? colors.disabled : colors.onBrand }}
              align="center"
            >
              {primaryLabel}
            </AppText>
          )}
        </AnimatedPressable>
      ) : null}

      {showSecondary ? (
        <AnimatedPressable
          variant="button"
          accessibilityRole="button"
          accessibilityLabel={cancelLabel}
          disabled={cancelBlocked}
          onPress={() => {
            void haptics.selection();
            onSecondary?.();
          }}
          style={{
            minHeight: theme.sizes.touch.min,
            borderRadius: theme.radius.full,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: theme.spacing.lg,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.borderStrong,
            opacity: cancelBlocked ? 0.6 : 1,
            ...orderBoardShadow(colorScheme),
          }}
        >
          <AppText
            variant="label"
            weight={titleWeight}
            style={{ color: colors.brand }}
            align="center"
          >
            {cancelLabel}
          </AppText>
        </AnimatedPressable>
      ) : null}
    </View>
  );
}
