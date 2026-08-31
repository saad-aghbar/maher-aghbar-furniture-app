import { View } from 'react-native';
import { AppText } from '@/components/AppText';
import { StatusBadge } from '@/components/badges/StatusBadge';
import { Divider } from '@/components/layout/Divider';
import { DealerEmptyPanel } from '@/features/dealers/components/DealerEmptyPanel';
import { formatCurrency, formatNumber } from '@/i18n/format';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';
import type { StatusCountRow } from '../selectReports';

type Props = {
  rows: StatusCountRow[];
};

/** Inset status ledger — badge + count, money on the opposite edge. */
export function ReportsStatusRows({ rows }: Props) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  if (rows.length === 0) {
    return <DealerEmptyPanel nested compact text={t('accounting.noData')} icon="stats-chart-outline" />;
  }

  return (
    <View
      style={{
        borderRadius: theme.radius.lg,
        backgroundColor: colors.surfaceSecondary,
        borderWidth: 1,
        borderColor: colors.border,
        overflow: 'hidden',
      }}
    >
      {rows.map((row, index) => {
        const countLabel = formatNumber(locale, row.count, { maximumFractionDigits: 0 });
        const moneyLabel =
          row.total != null ? formatCurrency(locale, row.total) : null;
        return (
          <View key={`${row.status}-${index}`}>
            {index > 0 ? <Divider compact plain style={{ marginVertical: 0 }} /> : null}
            <View
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: theme.spacing.md,
                paddingHorizontal: theme.spacing.md,
                paddingVertical: theme.spacing.sm + 2,
              }}
            >
              <View style={{ flex: 1, minWidth: 0 }}>
                <StatusBadge status={row.status} dot />
              </View>
              <View
                style={{
                  alignItems: isRTL ? 'flex-start' : 'flex-end',
                  gap: 2,
                }}
              >
                <AppText
                  weight={titleWeight}
                  dir="ltr"
                  style={{ color: colors.textPrimary, fontSize: 15 }}
                >
                  {countLabel}
                </AppText>
                {moneyLabel ? (
                  <AppText variant="caption" color="muted" dir="ltr">
                    {moneyLabel}
                  </AppText>
                ) : null}
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );
}
