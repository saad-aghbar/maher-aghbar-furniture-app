import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { AnimatedPressable, CountUp, haptics } from '@/motion';
import { useTheme } from '@/theme';

type Props = {
  count: number;
  onPress: () => void;
};

export function PurchasingBuyAlertCard({ count, onPress }: Props) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  if (count <= 0) return null;

  return (
    <AnimatedPressable
      variant="card"
      accessibilityRole="button"
      accessibilityLabel={t('mobile.purchasing.buyAlertA11y', { count: String(count) })}
      onPress={() => {
        void haptics.confirmLight();
        onPress();
      }}
      style={{
        borderRadius: theme.radius.xl,
        borderWidth: 1,
        borderColor: colors.warning,
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
          backgroundColor: colors.warning,
          opacity: 0.9,
          ...(isRTL ? { right: 0 } : { left: 0 }),
        }}
      />
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: theme.spacing.lg,
          paddingVertical: theme.spacing.md,
          ...(isRTL ? { paddingRight: theme.spacing.lg + 4 } : { paddingLeft: theme.spacing.lg + 4 }),
          backgroundColor: colors.warningSoft,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <AppText weight={titleWeight} style={{ textAlign: isRTL ? 'right' : 'left' }}>
          {t('mobile.purchasing.buyAlertTitle')}
        </AppText>
        <Ionicons name={isRTL ? 'arrow-back' : 'arrow-forward'} size={18} color={colors.warning} />
      </View>
      <View
        style={{
          padding: theme.spacing.lg,
          ...(isRTL ? { paddingRight: theme.spacing.lg + 4 } : { paddingLeft: theme.spacing.lg + 4 }),
        }}
      >
        <CountUp value={count} />
        <AppText color="muted" style={{ textAlign: isRTL ? 'right' : 'left' }}>
          {t('mobile.purchasing.buyAlertBody', { count: String(count) })}
        </AppText>
      </View>
    </AnimatedPressable>
  );
}
