import { View } from 'react-native';
import { AppText } from '@/components/AppText';
import { SurfaceCard } from '@/components/surfaces/SurfaceCard';
import { useLocale } from '@/i18n';
import { CountUp, ListItemEnter } from '@/motion';
import { useTheme } from '@/theme';
import type { MetricDef } from '../selectDealerHome';

type MetricStripProps = {
  metrics: MetricDef[];
};

export function MetricStrip({ metrics }: MetricStripProps) {
  const { t, formatNumber, isRTL } = useLocale();
  const { theme } = useTheme();

  return (
    <View
      style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        gap: theme.spacing.sm,
        marginBottom: theme.spacing.xl,
      }}
    >
      {metrics.map((metric, index) => (
        <ListItemEnter key={metric.key} index={index + 1} style={{ flex: 1 }}>
          <SurfaceCard style={{ flex: 1, minHeight: theme.sizes.touch.min * 1.6 }}>
            <View style={{ gap: theme.spacing.xs }}>
              <AppText variant="caption" color="secondary" numberOfLines={2}>
                {t(`mobile.dealerHome.metrics.${metric.key}`)}
              </AppText>
              <CountUp
                value={metric.value}
                format={(n) => formatNumber(n, { maximumFractionDigits: 0 })}
              />
            </View>
          </SurfaceCard>
        </ListItemEnter>
      ))}
    </View>
  );
}
