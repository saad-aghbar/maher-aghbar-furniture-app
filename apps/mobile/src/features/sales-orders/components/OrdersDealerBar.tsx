import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { DirectionalIcon } from '@/components/DirectionalIcon';
import {
  alignStart,
  extraStartPadding,
  localeRow,
  pinStart,
  useLocale,
} from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';

type Props = {
  label: string | null;
  onPress: () => void;
  onClear?: () => void;
};

/**
 * Floor dealer filter bar — same language as production; opens the dealer picker.
 */
export function OrdersDealerBar({ label, onPress, onClear }: Props) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme } = useTheme();
  const active = Boolean(label);
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  return (
    <View
      style={{
        borderRadius: theme.radius.xl,
        backgroundColor: active ? colors.brandSoft : colors.surface,
        borderWidth: 1,
        borderColor: active ? colors.brand : colors.borderStrong,
        overflow: 'hidden',
        flexDirection: localeRow(isRTL),
        alignItems: 'center',
        ...theme.elevation.card,
      }}
    >
      {active ? (
        <View
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            ...pinStart(isRTL),
            width: 3,
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
            ? t('mobile.orders.dealerRailShowing', { dealer: label! })
            : t('mobile.orders.filterDealerSearch')
        }
        accessibilityState={{ selected: active }}
        onPress={() => {
          void haptics.selection();
          onPress();
        }}
        style={{
          flex: 1,
          minHeight: 48,
          paddingHorizontal: theme.spacing.md,
          paddingVertical: theme.spacing.sm,
          flexDirection: localeRow(isRTL),
          alignItems: 'center',
          gap: theme.spacing.sm,
          ...(active ? extraStartPadding(isRTL, theme.spacing.md + 4) : null),
        }}
      >
        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: 16,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: active ? colors.surface : colors.surfaceSecondary,
            borderWidth: 1,
            borderColor: active ? colors.brand : colors.border,
          }}
        >
          <Ionicons
            name="storefront-outline"
            size={16}
            color={active ? colors.brand : colors.textSecondary}
          />
        </View>

        <View style={{ flex: 1, gap: 2, alignItems: alignStart(isRTL) }}>
          <AppText
            variant="caption"
            color="muted"
            align="start"
            style={{
              letterSpacing: locale === 'ar' ? 0 : 0.2,
              fontSize: 11,
              lineHeight: 14,
            }}
          >
            {t('mobile.orders.dealer')}
          </AppText>
          <AppText
            variant="label"
            weight={titleWeight}
            numberOfLines={1}
            align="start"
            style={{ color: active ? colors.brand : colors.textPrimary }}
          >
            {label ?? t('mobile.orders.dealerRailAll')}
          </AppText>
        </View>

        {!active || !onClear ? (
          <DirectionalIcon>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </DirectionalIcon>
        ) : null}
      </AnimatedPressable>

      {active && onClear ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('mobile.orders.filterDealerClear')}
          onPress={() => {
            void haptics.selection();
            onClear();
          }}
          hitSlop={8}
          style={{
            paddingHorizontal: theme.spacing.md,
            minHeight: 48,
            justifyContent: 'center',
          }}
        >
          <AppText variant="caption" weight="semibold" color="brand">
            {t('mobile.orders.filterDealerClear')}
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}
