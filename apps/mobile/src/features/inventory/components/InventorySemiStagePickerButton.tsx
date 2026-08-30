import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';

type Props = {
  label: string;
  count?: number;
  onPress: () => void;
};

/**
 * Full-width board control — pick the stage that drives the Semi order list.
 */
export function InventorySemiStagePickerButton({ label, count, onPress }: Props) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const chevron = isRTL ? 'chevron-back' : 'chevron-forward';
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  return (
    <AnimatedPressable
      variant="card"
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => {
        void haptics.selection();
        onPress();
      }}
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
          backgroundColor: colors.info,
          opacity: 0.7,
        }}
      />
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          gap: theme.spacing.md,
          paddingVertical: theme.spacing.md,
          paddingHorizontal: theme.spacing.md,
          ...(isRTL
            ? { paddingRight: theme.spacing.md + 4 }
            : { paddingLeft: theme.spacing.md + 4 }),
        }}
      >
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.brandSoft,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Ionicons name="construct-outline" size={18} color={colors.brand} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <AppText
            variant="caption"
            weight={locale === 'ar' ? 'regular' : 'medium'}
            style={{
              color: colors.brand,
              fontSize: 11,
              letterSpacing: locale === 'ar' ? 0 : 0.6,
              textTransform: locale === 'ar' ? 'none' : 'uppercase',
            }}
          >
            {t('mobile.inventory.semiStageButtonEyebrow')}
          </AppText>
          <AppText variant="body" weight={titleWeight} numberOfLines={1}>
            {label}
          </AppText>
          {typeof count === 'number' ? (
            <AppText variant="caption" color="muted" dir="ltr">
              {t('mobile.inventory.semiStageOrderCount', { count })}
            </AppText>
          ) : null}
        </View>
        <Ionicons name={chevron} size={18} color={colors.textMuted} />
      </View>
    </AnimatedPressable>
  );
}
