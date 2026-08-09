import { View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { AppText } from '@/components/AppText';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { useLocale } from '@/i18n';
import { CountUp, ListItemEnter } from '@/motion';
import { useTheme } from '@/theme';

type BalanceHeroCardProps = {
  balance: number;
  dueInDays: number | null;
  showNewOrder: boolean;
};

export function BalanceHeroCard({ balance, dueInDays, showNewOrder }: BalanceHeroCardProps) {
  const { t, formatCurrency } = useLocale();
  const { colors, theme } = useTheme();
  const router = useRouter();
  const paidUp = balance <= 0;
  const heroBg = paidUp ? colors.surface : colors.brandActive;
  const heroFg = paidUp ? colors.textPrimary : '#FFFFFF';

  return (
    <ListItemEnter index={0}>
      <View
        style={{
          backgroundColor: heroBg,
          borderRadius: theme.radius.lg,
          borderWidth: paidUp ? 1 : 0,
          borderColor: colors.border,
          padding: theme.spacing.xl,
          gap: theme.spacing.md,
          marginBottom: theme.spacing.lg,
          ...theme.elevation.card,
        }}
      >
        <AppText variant="label" weight="medium" style={{ color: heroFg, opacity: 0.85 }}>
          {t('mobile.dealerHome.outstandingBalance')}
        </AppText>
        <CountUp
          value={balance}
          variant="largeTitle"
          color={heroFg}
          format={(n) => formatCurrency(n)}
          accessibilityLabel={formatCurrency(balance)}
        />
        {paidUp ? (
          <AppText variant="bodySecondary" color="secondary">
            {t('mobile.dealerHome.paidUp')}
          </AppText>
        ) : dueInDays != null ? (
          <AppText variant="bodySecondary" style={{ color: heroFg, opacity: 0.85 }}>
            {dueInDays >= 0
              ? t('mobile.dealerHome.dueInDays', { n: dueInDays })
              : t('mobile.dealerHome.overdueDays', { n: Math.abs(dueInDays) })}
          </AppText>
        ) : null}
        {showNewOrder ? (
          <PrimaryButton
            label={t('mobile.dealerHome.newOrder')}
            onPress={() => router.push('/(app)/(customer)/(tabs)/new-order' as Href)}
            style={{
              marginTop: theme.spacing.sm,
              ...(paidUp
                ? null
                : {
                    backgroundColor: colors.brand,
                  }),
            }}
          />
        ) : null}
      </View>
    </ListItemEnter>
  );
}
