import { View } from 'react-native';
import { AppText } from '@/components/AppText';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';

type Props = {
  label: string;
  value: string;
  muted?: boolean;
  hero?: boolean;
};

/** Label on the reading-start edge, money on the opposite edge. */
export function CostMoneyLine({ label, value, muted, hero }: Props) {
  const { isRTL, locale } = useLocale();
  const { colors, theme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  return (
    <View
      style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        gap: theme.spacing.sm,
      }}
    >
      <AppText
        variant={hero ? 'caption' : 'body'}
        color={muted ? 'muted' : undefined}
        style={{ flexShrink: 1 }}
      >
        {label}
      </AppText>
      <AppText
        variant={hero ? 'title' : 'body'}
        weight={titleWeight}
        dir="ltr"
        style={{ color: muted ? colors.textSecondary : colors.textPrimary }}
      >
        {value}
      </AppText>
    </View>
  );
}
