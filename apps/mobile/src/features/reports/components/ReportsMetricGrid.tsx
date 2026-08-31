import { View } from 'react-native';
import { AppText } from '@/components/AppText';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';
import type { DashboardSnapshotMetric } from '../selectReports';

const WARNING_KEYS = new Set(['delayed', 'outstandingInvoices', 'receivables', 'lowStock']);

function isHot(metric: DashboardSnapshotMetric): boolean {
  if (!WARNING_KEYS.has(metric.key)) return false;
  const n = Number(String(metric.value).replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) && n > 0;
}

type Props = {
  metrics: DashboardSnapshotMetric[];
};

/** Two-up inset metric tiles inside a report floor board. */
export function ReportsMetricGrid({ metrics }: Props) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  return (
    <View
      style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        flexWrap: 'wrap',
        gap: theme.spacing.sm,
      }}
    >
      {metrics.map((metric) => {
        const hot = isHot(metric);
        const success = metric.key === 'revenue';
        return (
          <View
            key={metric.key}
            style={{
              width: '48%',
              flexGrow: 1,
              minWidth: 140,
              borderRadius: theme.radius.lg,
              borderWidth: 1,
              borderColor: hot ? colors.warning : colors.border,
              backgroundColor: hot
                ? colors.warningSoft
                : success
                  ? colors.successSoft
                  : colors.surfaceSecondary,
              padding: theme.spacing.md,
              gap: 4,
            }}
          >
            <AppText
              variant="caption"
              color="muted"
              style={{
                textAlign: isRTL ? 'right' : 'left',
                fontSize: 10,
                lineHeight: 13,
                letterSpacing: locale === 'ar' ? 0 : 0.45,
                textTransform: locale === 'ar' ? 'none' : 'uppercase',
              }}
            >
              {t(metric.labelKey)}
            </AppText>
            <AppText
              weight={titleWeight}
              dir="ltr"
              numberOfLines={1}
              style={{
                textAlign: isRTL ? 'right' : 'left',
                color: hot ? colors.warning : colors.textPrimary,
                fontSize: 18,
                lineHeight: 22,
                letterSpacing: -0.3,
              }}
            >
              {metric.value}
            </AppText>
          </View>
        );
      })}
    </View>
  );
}
