import { View } from 'react-native';
import { AppText } from '@/components/AppText';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';

type Props = {
  label: string;
  value: string;
  compact?: boolean;
};

/** Metric tile — matches dealer list inset boards. */
export function DealerMetricTile({ label, value, compact }: Props) {
  const { isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();

  return (
    <View
      style={{
        flex: 1,
        minWidth: compact ? 0 : undefined,
        borderRadius: theme.radius.lg,
        borderWidth: 1,
        borderColor: colors.borderStrong,
        backgroundColor: colors.surface,
        paddingVertical: theme.spacing.md,
        paddingHorizontal: theme.spacing.md,
        gap: 6,
        ...orderBoardShadow(colorScheme),
      }}
    >
      <AppText
        variant="caption"
        color="muted"
        numberOfLines={1}
        style={{
          textAlign: isRTL ? 'right' : 'left',
          fontSize: 10,
          letterSpacing: locale === 'ar' ? 0 : 0.45,
          textTransform: locale === 'ar' ? 'none' : 'uppercase',
        }}
      >
        {label}
      </AppText>
      <AppText
        weight="semibold"
        dir="ltr"
        numberOfLines={1}
        style={{
          textAlign: isRTL ? 'right' : 'left',
          color: colors.textPrimary,
          fontSize: compact ? 20 : 18,
          lineHeight: compact ? 24 : 22,
          letterSpacing: -0.3,
        }}
      >
        {value}
      </AppText>
    </View>
  );
}
