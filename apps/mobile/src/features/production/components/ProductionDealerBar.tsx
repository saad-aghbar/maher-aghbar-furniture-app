import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';

type Props = {
  label: string | null;
  onPress: () => void;
  onClear?: () => void;
};

/**
 * Floor dealer filter trigger — press to open the dealer picker sheet.
 */
export function ProductionDealerBar({ label, onPress, onClear }: Props) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const active = Boolean(label);
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  return (
    <View
      style={{
        height: 48,
        borderRadius: theme.radius.xl,
        backgroundColor: active ? colors.brandSoft : colors.surfaceSecondary,
        borderWidth: 1.5,
        borderColor: active ? colors.brand : colors.borderStrong,
        overflow: 'hidden',
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        ...orderBoardShadow(colorScheme),
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
            opacity: 0.85,
          }}
        />
      ) : null}

      <AnimatedPressable
        variant="button"
        accessibilityRole="button"
        accessibilityLabel={
          active
            ? t('mobile.production.dealerFilterActive', { dealer: label! })
            : t('mobile.production.filterDealer')
        }
        accessibilityState={{ selected: active }}
        onPress={() => {
          void haptics.selection();
          onPress();
        }}
        style={{
          flex: 1,
          minWidth: 0,
          height: 48,
          paddingHorizontal: theme.spacing.md,
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          gap: theme.spacing.sm,
          ...(isRTL
            ? { paddingRight: active ? theme.spacing.md + 4 : theme.spacing.md }
            : { paddingLeft: active ? theme.spacing.md + 4 : theme.spacing.md }),
        }}
      >
        <View
          style={{
            width: 28,
            height: 28,
            borderRadius: 14,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: active ? colors.brand : colors.border,
          }}
        >
          <Ionicons
            name="storefront-outline"
            size={15}
            color={active ? colors.brand : colors.textSecondary}
          />
        </View>

        <AppText
          variant="caption"
          weight={titleWeight}
          numberOfLines={1}
          style={{
            flex: 1,
            minWidth: 0,
            fontSize: 13,
            lineHeight: 16,
            color: active ? colors.brand : colors.textPrimary,
            textAlign: isRTL ? 'right' : 'left',
          }}
        >
          {label ?? t('mobile.production.filterDealerAll')}
        </AppText>

        {!active || !onClear ? (
          <Ionicons
            name={isRTL ? 'chevron-back' : 'chevron-forward'}
            size={16}
            color={active ? colors.brand : colors.textMuted}
          />
        ) : null}
      </AnimatedPressable>

      {active && onClear ? (
        <AnimatedPressable
          variant="button"
          accessibilityRole="button"
          accessibilityLabel={t('mobile.production.filterDealerClear')}
          onPress={() => {
            void haptics.selection();
            onClear();
          }}
          style={{
            width: 40,
            height: 48,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="close" size={18} color={colors.brand} />
        </AnimatedPressable>
      ) : null}
    </View>
  );
}
