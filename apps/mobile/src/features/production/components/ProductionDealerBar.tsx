import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';

type Props = {
  label: string | null;
  onPress: () => void;
  onClear?: () => void;
};

/**
 * Floor dealer filter bar — press to open the dealer picker sheet.
 */
export function ProductionDealerBar({ label, onPress, onClear }: Props) {
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
        flexDirection: isRTL ? 'row-reverse' : 'row',
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
            ...(isRTL ? { right: 0 } : { left: 0 }),
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
          minHeight: 48,
          paddingHorizontal: theme.spacing.md,
          paddingVertical: theme.spacing.sm,
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          gap: theme.spacing.sm,
          paddingLeft: isRTL ? theme.spacing.md : active ? theme.spacing.md + 4 : theme.spacing.md,
          paddingRight: isRTL
            ? active
              ? theme.spacing.md + 4
              : theme.spacing.md
            : theme.spacing.md,
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

        <View style={{ flex: 1, gap: 2, alignItems: isRTL ? 'flex-end' : 'flex-start' }}>
          <AppText
            variant="caption"
            color="muted"
            style={{
              letterSpacing: locale === 'ar' ? 0 : 0.6,
              textTransform: locale === 'ar' ? 'none' : 'uppercase',
              fontSize: 11,
              lineHeight: 14,
            }}
          >
            {t('mobile.production.dealer')}
          </AppText>
          <AppText
            variant="label"
            weight={titleWeight}
            numberOfLines={1}
            style={{ color: active ? colors.brand : colors.textPrimary }}
          >
            {label ?? t('mobile.production.filterDealerAll')}
          </AppText>
        </View>

        {!active || !onClear ? (
          <Ionicons
            name={isRTL ? 'chevron-back' : 'chevron-forward'}
            size={18}
            color={colors.textMuted}
          />
        ) : null}
      </AnimatedPressable>

      {active && onClear ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('mobile.production.filterDealerClear')}
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
            {t('mobile.production.filterDealerClear')}
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}
