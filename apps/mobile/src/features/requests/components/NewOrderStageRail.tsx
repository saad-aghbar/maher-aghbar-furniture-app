import { useEffect, Fragment } from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { AppText } from '@/components/AppText';
import { useLocale } from '@/i18n';
import { dealerStageRailDuration, useReducedMotion } from '@/motion';
import { dealerTokens, useTheme } from '@/theme';
import type { NewOrderStep } from '../newOrderSteps';
import {
  NEW_ORDER_STAGE_COUNT,
  stageNodeState,
  stageProgress,
} from '../newOrderStageMath';

type NewOrderStageRailProps = {
  step: NewOrderStep;
};

export function NewOrderStageRail({ step }: NewOrderStageRailProps) {
  const { t, isRTL } = useLocale();
  const { colors, theme } = useTheme();
  const dealer = dealerTokens(colors);
  const reduce = useReducedMotion();
  const progress = useSharedValue(stageProgress(step));

  useEffect(() => {
    const duration = dealerStageRailDuration(reduce);
    progress.value =
      duration === 0
        ? stageProgress(step)
        : withTiming(stageProgress(step), { duration });
  }, [step, progress, reduce]);

  const barStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));

  const labels = [
    t('mobile.newOrder.steps.product'),
    t('mobile.newOrder.steps.details'),
    t('mobile.newOrder.steps.customer'),
    t('mobile.newOrder.steps.attachments'),
  ];

  return (
    <View
      style={{ gap: theme.spacing.sm }}
      accessibilityRole="progressbar"
      accessibilityLabel={t('mobile.newOrder.stageOf', {
        current: step,
        total: NEW_ORDER_STAGE_COUNT,
      })}
      accessibilityValue={{
        min: 1,
        max: NEW_ORDER_STAGE_COUNT,
        now: step,
      }}
    >
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'flex-start',
        }}
      >
        {labels.map((label, i) => {
          const state = stageNodeState(step, i);
          const filled = state === 'done' || state === 'active';
          // Cue between the active stage and the next one.
          const showArrowBetween = step === i + 1 && i < labels.length - 1;

          return (
            <Fragment key={`${i}-${label}`}>
              <View style={{ flex: 1, alignItems: 'center', gap: 4 }}>
                <View
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 13,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: filled ? colors.brand : colors.surface,
                    borderWidth: 1.5,
                    borderColor: filled ? colors.brand : colors.border,
                  }}
                >
                  {state === 'done' ? (
                    <Ionicons name="checkmark" size={14} color={colors.onBrand} />
                  ) : (
                    <AppText
                      variant="caption"
                      weight="semibold"
                      style={{
                        color: state === 'active' ? colors.onBrand : colors.textMuted,
                        fontSize: 11,
                      }}
                    >
                      {i + 1}
                    </AppText>
                  )}
                </View>
                <AppText
                  variant="caption"
                  weight={state === 'active' ? 'semibold' : 'medium'}
                  numberOfLines={1}
                  style={{
                    color: state === 'upcoming' ? colors.textMuted : colors.brand,
                    fontSize: 9,
                    textAlign: 'center',
                  }}
                >
                  {label}
                </AppText>
              </View>

              {i < labels.length - 1 ? (
                <View
                  style={{
                    width: 16,
                    height: 26,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {showArrowBetween ? (
                    <Ionicons
                      name={isRTL ? 'chevron-back' : 'chevron-forward'}
                      size={14}
                      color={dealer.fab}
                      accessibilityLabel={t('mobile.newOrder.nextStage')}
                    />
                  ) : (
                    <View
                      style={{
                        width: 6,
                        height: 2,
                        borderRadius: 1,
                        backgroundColor: colors.border,
                        opacity: 0.7,
                      }}
                    />
                  )}
                </View>
              ) : null}
            </Fragment>
          );
        })}
      </View>
      <View
        style={{
          height: 5,
          borderRadius: 3,
          backgroundColor: colors.border,
          overflow: 'hidden',
        }}
      >
        <Animated.View
          style={[
            {
              height: 5,
              borderRadius: 3,
              backgroundColor: colors.brand,
              alignSelf: isRTL ? 'flex-end' : 'flex-start',
            },
            barStyle,
          ]}
        />
      </View>
    </View>
  );
}
