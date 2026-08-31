import { View } from 'react-native';
import { AppText } from '@/components/AppText';
import { DealerBoard } from '@/features/dealers/components/DealerBoard';
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
  const { t, isRTL, locale } = useLocale();
  const { colors, theme } = useTheme();
  const current = deriveStep({ poStatus, currentStageCode, deliveryStatus });
  const idx = STEPS.indexOf(current);
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  return (
    <DealerBoard title={t('lifecycle.timelineProduction')} titleWeight={titleWeight}>
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          flexWrap: 'wrap',
          gap: theme.spacing.sm,
        }}
      >
        {STEPS.map((step, stepIdx) => {
          const active = step === current;
          const done = stepIdx < idx;
          const factory = factoryHint(step, current, t);
          const delivery = deliveryHint(step, current, t);
          return (
            <View key={step} style={{ gap: 4, maxWidth: '32%' }}>
              <View
                style={{
                  paddingHorizontal: theme.spacing.sm,
                  paddingVertical: 6,
                  minHeight: 32,
                  borderRadius: theme.radius.lg,
                  backgroundColor: active
                    ? colors.brandSoft
                    : done
                      ? colors.surfaceSecondary
                      : colors.surface,
                  borderWidth: 1,
                  borderColor: active ? colors.brand : colors.border,
                  overflow: 'hidden',
                }}
              >
                {active ? (
                  <View
                    pointerEvents="none"
                    style={{
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      right: 0,
                      height: 3,
                      backgroundColor: colors.brand,
                    }}
                  />
                ) : null}
                <AppText
                  variant="caption"
                  weight={active ? titleWeight : 'regular'}
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
    </DealerBoard>
  );
}
