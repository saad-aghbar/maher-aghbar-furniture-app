import { View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { can } from '@maher/permissions';
import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { AnimatedPressable, haptics } from '@/motion';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';

/** Orders-hub entry to dealer quotations — not a tab. */
export function DealerQuotationsEntry() {
  const { user } = useAuth();
  const { t, locale, isRTL } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const router = useRouter();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  if (!can(user, 'quotation.read')) return null;

  return (
    <AnimatedPressable
      variant="card"
      accessibilityRole="button"
      accessibilityLabel={t('mobile.dealerQuotations.openQuotes')}
      onPress={() => {
        void haptics.selection();
        router.push('/(app)/(customer)/quotations' as Href);
      }}
      style={{
        borderRadius: theme.radius.xl,
        backgroundColor: colors.surface,
        padding: theme.spacing.md,
        ...orderBoardShadow(colorScheme),
      }}
    >
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: theme.spacing.md,
        }}
      >
        <View style={{ flex: 1, gap: 2, alignItems: isRTL ? 'flex-end' : 'flex-start' }}>
          <AppText
            variant="caption"
            weight={locale === 'ar' ? 'regular' : 'medium'}
            style={{
              letterSpacing: locale === 'ar' ? 0 : 1.2,
              textTransform: locale === 'ar' ? 'none' : 'uppercase',
              color: colors.brand,
            }}
          >
            {t('mobile.dealerQuotations.eyebrow')}
          </AppText>
          <AppText variant="title" weight={titleWeight}>
            {t('mobile.dealerQuotations.openQuotes')}
          </AppText>
          <AppText variant="caption" color="muted">
            {t('mobile.dealerAccount.placeQuotationsHint')}
          </AppText>
        </View>
        <Ionicons
          name={isRTL ? 'chevron-back' : 'chevron-forward'}
          size={20}
          color={colors.textMuted}
        />
      </View>
    </AnimatedPressable>
  );
}
