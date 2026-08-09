import { View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { AppText } from '@/components/AppText';
import { SurfaceCard } from '@/components/surfaces/SurfaceCard';
import { useLocale } from '@/i18n';
import { CountUp, ListItemEnter } from '@/motion';
import { useTheme } from '@/theme';
import type { MetricDef } from '../selectUrgentAlert';

type MetricDensity = 'primary' | 'secondary';

type MetricCardProps = {
  metric: MetricDef;
  index: number;
  density?: MetricDensity;
};

export function MetricCard({ metric, index, density = 'primary' }: MetricCardProps) {
  const { t, formatNumber, formatCurrency } = useLocale();
  const { colors, theme } = useTheme();
  const router = useRouter();
  const label = t(`mobile.adminHome.metrics.${metric.key}`);
  const isPrimary = density === 'primary';

  const accentBorder =
    metric.emphasize === 'error'
      ? colors.error
      : metric.emphasize === 'warning'
        ? colors.warning
        : undefined;
  const accentBg =
    metric.emphasize === 'error'
      ? colors.errorSoft
      : metric.emphasize === 'warning'
        ? colors.warningSoft
        : undefined;
  const valueColor =
    metric.emphasize === 'error'
      ? colors.error
      : metric.emphasize === 'warning'
        ? colors.warning
        : undefined;

  return (
    <ListItemEnter index={index + 1} style={{ flex: 1, minWidth: '45%' }}>
      <SurfaceCard
        onPress={metric.href ? () => router.push(metric.href as Href) : undefined}
        accessibilityLabel={`${label}: ${metric.value}`}
        style={{
          flex: 1,
          minHeight: isPrimary ? theme.sizes.touch.min * 2.2 : theme.sizes.touch.min * 1.7,
          borderColor: accentBorder ?? undefined,
          backgroundColor: accentBg ?? undefined,
        }}
      >
        <View style={{ gap: theme.spacing.sm }}>
          <AppText variant="caption" color="secondary" numberOfLines={2}>
            {label}
          </AppText>
          <CountUp
            value={metric.value}
            variant={isPrimary ? 'largeTitle' : 'heading'}
            color={valueColor}
            format={
              metric.isMoney
                ? (n) => formatCurrency(n)
                : (n) => formatNumber(n, { maximumFractionDigits: 0 })
            }
          />
        </View>
      </SurfaceCard>
    </ListItemEnter>
  );
}

type MetricGridProps = {
  metrics: MetricDef[];
  density?: MetricDensity;
};

export function MetricGrid({ metrics, density = 'primary' }: MetricGridProps) {
  const { theme } = useTheme();
  const { isRTL } = useLocale();

  const rows: MetricDef[][] = [];
  for (let i = 0; i < metrics.length; i += 2) {
    rows.push(metrics.slice(i, i + 2));
  }

  return (
    <View
      style={{
        gap: theme.spacing.md,
        marginBottom: density === 'primary' ? theme.spacing.md : theme.spacing.xl,
      }}
    >
      {rows.map((row, rowIndex) => (
        <View
          key={row.map((m) => m.key).join('-')}
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            gap: theme.spacing.md,
          }}
        >
          {row.map((metric, colIndex) => (
            <MetricCard
              key={metric.key}
              metric={metric}
              index={rowIndex * 2 + colIndex}
              density={density}
            />
          ))}
          {row.length === 1 ? <View style={{ flex: 1 }} /> : null}
        </View>
      ))}
    </View>
  );
}
