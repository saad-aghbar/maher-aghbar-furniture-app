import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';
import type { OrderProductionSetup } from '../../api';
import {
  OrderBoardCard,
  OrderSectionHeader,
} from '../../components/OrderBoardCard';

type Props = {
  setup: OrderProductionSetup;
};

const JOURNEY_STEPS = [
  'accepted',
  'configure',
  'factoryReady',
  'release',
] as const;

export function FactoryReadinessSummary({ setup }: Props) {
  const { t, isRTL } = useLocale();
  const { colors, theme } = useTheme();
  const ready = setup.progress.readyLines;
  const total = setup.progress.totalLines;
  const mat = setup.materialReadiness;
  const validationOk = setup.validation.ok;
  const issueCount = setup.validation.issues.length;
  const status = String(setup.status).toUpperCase();
  const released = status === 'RELEASED';
  const factoryReady = status === 'READY_FOR_RELEASE' || released;
  const configuring =
    setup.progress.percent > 0 ||
    status === 'SETUP_IN_PROGRESS' ||
    factoryReady;

  const estimateIncomplete = setup.lines.some(
    (l) =>
      l.estimatedCostSummary?.estimateIncomplete ||
      l.estimatedCostSummary?.incomplete ||
      l.estimatedCostSummary?.someCostsUnavailable,
  );
  const shortageCount = setup.lines.filter(
    (l) => String(l.materialStatus).toUpperCase() === 'SHORTAGE',
  ).length;
  const anyEstimate =
    setup.lines.some((l) => l.estimatedCostSummary?.totalEstimated != null) ||
    estimateIncomplete;

  const journeyDone: Record<(typeof JOURNEY_STEPS)[number], boolean> = {
    accepted: true,
    configure: configuring,
    factoryReady,
    release: released,
  };

  const rows: Array<{
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    value: string;
    tone: string;
  }> = [
    {
      icon: 'checkmark-circle-outline',
      label: t('mobile.productionSetup.readiness.linesReady'),
      value: `${ready}/${total}`,
      tone: ready === total && total > 0 ? colors.success : colors.warning,
    },
    {
      icon: 'cube-outline',
      label: t('mobile.productionSetup.readiness.materials'),
      value: t(
        `mobile.productionSetup.materialStatus.${String(mat.status).toUpperCase()}`,
      ),
      tone: mat.anyShortage || mat.anyNeedsReview ? colors.warning : colors.brand,
    },
    {
      icon: 'cash-outline',
      label: t('mobile.productionSetup.readiness.estimatedMaterials'),
      value: estimateIncomplete
        ? t('mobile.productionSetup.cost.incomplete')
        : anyEstimate
          ? t('mobile.productionSetup.cost.estimated')
          : t('mobile.productionSetup.cost.unavailable'),
      tone: estimateIncomplete ? colors.warning : colors.brand,
    },
    {
      icon: 'alert-circle-outline',
      label: t('mobile.productionSetup.readiness.shortageCount'),
      value: String(shortageCount),
      tone: shortageCount > 0 ? colors.warning : colors.success,
    },
    {
      icon: validationOk ? 'shield-checkmark-outline' : 'alert-circle-outline',
      label: t('mobile.productionSetup.readiness.validation'),
      value: validationOk
        ? t('mobile.productionSetup.readiness.validationOk')
        : t('mobile.productionSetup.readiness.validationIssues', {
            n: issueCount,
          }),
      tone: validationOk ? colors.success : colors.warning,
    },
  ];

  return (
    <OrderBoardCard accent={colors.brand}>
      <OrderSectionHeader
        icon="construct-outline"
        label={t('mobile.productionSetup.readiness.title')}
        accent={colors.brand}
      />
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          flexWrap: 'wrap',
          gap: theme.spacing.xs,
          marginBottom: theme.spacing.sm,
        }}
      >
        {JOURNEY_STEPS.map((key) => {
          const done = journeyDone[key];
          return (
            <View
              key={key}
              style={{
                paddingHorizontal: theme.spacing.sm,
                paddingVertical: 4,
                borderRadius: theme.radius.md,
                borderWidth: 1,
                borderColor: done ? colors.brand : colors.border,
                backgroundColor: done ? colors.brandSoft : colors.surfaceSecondary,
              }}
            >
              <AppText
                variant="caption"
                weight={done ? 'semibold' : 'regular'}
                style={{ color: done ? colors.brand : colors.textMuted }}
              >
                {t(`mobile.productionSetup.journey.${key}`)}
              </AppText>
            </View>
          );
        })}
      </View>
      <View style={{ gap: theme.spacing.sm }}>
        {rows.map((row) => (
          <View
            key={row.label}
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'center',
              gap: theme.spacing.sm,
            }}
          >
            <Ionicons name={row.icon} size={18} color={row.tone} />
            <View style={{ flex: 1 }}>
              <AppText variant="caption" color="muted">
                {row.label}
              </AppText>
              <AppText
                variant="label"
                weight="semibold"
                style={{ color: row.tone }}
                numberOfLines={2}
              >
                {row.value.startsWith('mobile.') ? String(mat.status) : row.value}
              </AppText>
            </View>
          </View>
        ))}
        {mat.anyShortage ? (
          <AppText variant="caption" color="secondary">
            {t('mobile.productionSetup.readiness.shortageNote')}
          </AppText>
        ) : factoryReady && !released ? (
          <AppText variant="caption" color="secondary">
            {t('mobile.productionSetup.readiness.readyNote')}
          </AppText>
        ) : null}
      </View>
    </OrderBoardCard>
  );
}
