import { View } from 'react-native';
import { AppText } from '@/components/AppText';
import { useLocale } from '@/i18n';
import { dealerTokens, useTheme } from '@/theme';

type Props = {
  label: string;
  amountLabel: string;
  hint?: string;
};

export function DealerBalanceCard({ label, amountLabel, hint }: Props) {
  const { isRTL, locale } = useLocale();
  const { colors, theme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const wash = dealerTokens(colors);

  return (
    <View
      style={{
        padding: theme.spacing.lg,
        borderRadius: theme.radius.xl,
        backgroundColor: wash.commerceSurface,
        borderWidth: 1,
        borderColor: colors.border,
        gap: theme.spacing.sm,
        alignItems: isRTL ? 'flex-end' : 'flex-start',
      }}
    >
      <AppText variant="caption" color="muted" style={{ textAlign: isRTL ? 'right' : 'left' }}>
        {label}
      </AppText>
      <AppText
        variant="display"
        weight={titleWeight}
        style={{ color: colors.textPrimary, textAlign: isRTL ? 'right' : 'left' }}
      >
        {amountLabel}
      </AppText>
      {hint ? (
        <AppText variant="caption" color="secondary" style={{ textAlign: isRTL ? 'right' : 'left' }}>
          {hint}
        </AppText>
      ) : null}
    </View>
  );
}
