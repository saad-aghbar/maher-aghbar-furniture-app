import { ScrollView, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import Animated, { FadeInDown, FadeInRight } from 'react-native-reanimated';
import { AppText } from '@/components/AppText';
import { useLocale } from '@/i18n';
import { AnimatedPressable, CountUp, haptics, useReducedMotion } from '@/motion';
import { useTheme } from '@/theme';
import type { AdminHomePayload } from '../api';
import { primaryKpis, type MetricDef } from '../selectUrgentAlert';

type Props = {
  data: AdminHomePayload;
};

function KpiChip({
  metric,
  index,
  formatCurrency,
}: {
  metric: MetricDef;
  index: number;
  formatCurrency: (n: number) => string;
}) {
  const { t, isRTL } = useLocale();
  const { colors, theme } = useTheme();
  const router = useRouter();
  const reduce = useReducedMotion();

  const warn =
    metric.emphasize === 'error'
      ? colors.errorSoft
      : metric.emphasize === 'warning'
        ? colors.warningSoft
        : colors.surface;
  const accent =
    metric.emphasize === 'error'
      ? colors.error
      : metric.emphasize === 'warning'
        ? colors.warning
        : colors.brand;

  const Chip = reduce ? View : Animated.View;
  const chipProps = reduce
    ? {}
    : { entering: FadeInRight.delay(120 + index * 70).springify().damping(16) };

  return (
    <Chip {...chipProps}>
      <AnimatedPressable
        variant="card"
        accessibilityRole="button"
        accessibilityLabel={t(`mobile.adminHome.metrics.${metric.key}`)}
        onPress={() => {
          if (!metric.href) return;
          void haptics.selection();
          router.push(metric.href as Href);
        }}
        style={{
          width: 148,
          minHeight: 96,
          borderRadius: theme.radius.lg,
          backgroundColor: warn,
          borderWidth: 1,
          borderColor: colors.border,
          padding: theme.spacing.md,
          gap: theme.spacing.xs,
          marginEnd: isRTL ? 0 : theme.spacing.sm,
          marginStart: isRTL ? theme.spacing.sm : 0,
        }}
      >
        <AppText variant="caption" color="secondary" numberOfLines={1}>
          {t(`mobile.adminHome.metrics.${metric.key}`)}
        </AppText>
        <CountUp
          value={metric.value}
          format={metric.isMoney ? formatCurrency : undefined}
          variant="heading"
          color={accent}
        />
      </AnimatedPressable>
    </Chip>
  );
}

/**
 * Atelier pulse: attention line + horizontal KPI strip (furniture ERP, not logistics clone).
 */
export function AdminHomePulseStrip({ data }: Props) {
  const { t, formatCurrency, isRTL } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const reduce = useReducedMotion();
  const metrics = primaryKpis(data);
  const attention =
    data.delayedOrders + data.urgentTasksCount + data.lowStockItems + data.pendingReturns;

  const Wrapper = reduce ? View : Animated.View;
  const wrapperProps = reduce
    ? {}
    : { entering: FadeInDown.delay(60).springify().damping(17) };

  const heroBg = colorScheme === 'dark' ? colors.surface : '#2F2924';
  const onHero = colorScheme === 'dark' ? colors.textPrimary : '#F7F3EC';

  return (
    <Wrapper {...wrapperProps} style={{ gap: theme.spacing.md, marginBottom: theme.spacing.lg }}>
      <View
        style={{
          borderRadius: theme.radius.xl,
          backgroundColor: heroBg,
          padding: theme.spacing.lg,
          gap: theme.spacing.sm,
          overflow: 'hidden',
          ...theme.elevation.raised,
        }}
      >
        <AppText variant="caption" style={{ color: 'rgba(247,243,236,0.7)' }}>
          {t('mobile.adminHome.pulseEyebrow')}
        </AppText>
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'baseline',
            gap: theme.spacing.sm,
          }}
        >
          <CountUp value={attention} variant="largeTitle" color={onHero} />
          <AppText variant="body" style={{ color: 'rgba(247,243,236,0.75)', flex: 1 }}>
            {t('mobile.adminHome.pulseLabel')}
          </AppText>
        </View>
        <AppText variant="caption" style={{ color: 'rgba(247,243,236,0.55)' }}>
          {attention === 0
            ? t('mobile.adminHome.pulseClear')
            : t('mobile.adminHome.pulseHint')}
        </AppText>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          paddingVertical: 2,
          flexDirection: isRTL ? 'row-reverse' : 'row',
        }}
      >
        {metrics.map((m, i) => (
          <KpiChip key={m.key} metric={m} index={i} formatCurrency={formatCurrency} />
        ))}
        <KpiChip
          metric={{
            key: 'outstandingReceivables',
            value: Number(data.outstandingReceivables) || 0,
            isMoney: true,
            href: null,
          }}
          index={metrics.length}
          formatCurrency={formatCurrency}
        />
      </ScrollView>
    </Wrapper>
  );
}
