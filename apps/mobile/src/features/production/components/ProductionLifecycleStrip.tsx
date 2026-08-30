import { View } from 'react-native';
import { AppText } from '@/components/AppText';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';

type Step = 'production' | 'inspection' | 'packaging' | 'ready' | 'shipped' | 'delivered';

const STEPS: Step[] = [
  'production',
  'inspection',
  'packaging',
  'ready',
  'shipped',
  'delivered',
];

function deriveStep(input: {
  poStatus: string;
  currentStageCode?: string | null;
  deliveryStatus?: string | null;
}): Step {
  const po = input.poStatus.toUpperCase();
  const delivery = input.deliveryStatus?.toUpperCase() ?? null;
  if (delivery === 'DELIVERED' || po === 'COMPLETED') {
    return delivery === 'OUT_FOR_DELIVERY' ? 'shipped' : 'delivered';
  }
  if (delivery === 'OUT_FOR_DELIVERY') return 'shipped';
  if (po === 'READY_FOR_DELIVERY') return 'ready';
  const code = input.currentStageCode?.toUpperCase() ?? '';
  if (code === 'PACKAGING') return 'packaging';
  if (code === 'INSPECTION') return 'inspection';
  return 'production';
}

function stepKey(step: Step): string {
  switch (step) {
    case 'production':
      return 'lifecycle.timelineProduction';
    case 'inspection':
      return 'lifecycle.timelineInspection';
    case 'packaging':
      return 'lifecycle.timelinePackaging';
    case 'ready':
      return 'lifecycle.readyForDelivery';
    case 'shipped':
      return 'lifecycle.shipped';
    case 'delivered':
      return 'lifecycle.tabs.delivered';
  }
}

function factoryHint(step: Step, current: Step, t: (k: string) => string): string | null {
  if (step !== current) return null;
  switch (step) {
    case 'ready':
      return t('lifecycle.factoryStoredInFg');
    case 'shipped':
      return t('lifecycle.leftFactory');
    case 'delivered':
      return t('lifecycle.deliveryConfirmedByDealer');
    case 'packaging':
      return t('lifecycle.factoryFinished');
    default:
      return null;
  }
}

function deliveryHint(step: Step, current: Step, t: (k: string) => string): string | null {
  if (step !== current) return null;
  switch (step) {
    case 'ready':
      return t('lifecycle.deliveryReady');
    case 'shipped':
      return t('lifecycle.shippedAwaitingConfirm');
    case 'delivered':
      return t('lifecycle.deliveryDelivered');
    default:
      return null;
  }
}

type Props = {
  poStatus: string;
  currentStageCode?: string | null;
  deliveryStatus?: string | null;
};

/** Compact terminal lifecycle strip on admin mobile production detail. */
export function ProductionLifecycleStrip({ poStatus, currentStageCode, deliveryStatus }: Props) {
  const { t, isRTL } = useLocale();
  const { colors, theme } = useTheme();
  const current = deriveStep({ poStatus, currentStageCode, deliveryStatus });
  const idx = STEPS.indexOf(current);

  return (
    <View
      style={{
        gap: theme.spacing.xs,
        padding: theme.spacing.md,
        borderRadius: theme.radius.lg,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surfaceSecondary,
      }}
    >
      <AppText variant="caption" color="secondary" weight="semibold">
        {t('lifecycle.timelineProduction')}
      </AppText>
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          flexWrap: 'wrap',
          gap: 6,
        }}
      >
        {STEPS.map((step, stepIdx) => {
          const active = step === current;
          const done = stepIdx < idx;
          const factory = factoryHint(step, current, t);
          const delivery = deliveryHint(step, current, t);
          return (
            <View key={step} style={{ gap: 2, maxWidth: '32%' }}>
              <View
                style={{
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                  borderRadius: theme.radius.md,
                  backgroundColor: active
                    ? colors.brandSoft
                    : done
                      ? colors.surface
                      : 'transparent',
                  borderWidth: 1,
                  borderColor: active ? colors.brand : colors.border,
                }}
              >
                <AppText
                  variant="caption"
                  weight={active ? 'semibold' : 'regular'}
                  color={active ? 'brand' : done ? 'secondary' : 'muted'}
                  numberOfLines={1}
                >
                  {t(stepKey(step))}
                </AppText>
              </View>
              {active && (factory || delivery) ? (
                <AppText variant="caption" color="muted" numberOfLines={2} align="center">
                  {[factory, delivery].filter(Boolean).join(' · ')}
                </AppText>
              ) : null}
            </View>
          );
        })}
      </View>
    </View>
  );
}
