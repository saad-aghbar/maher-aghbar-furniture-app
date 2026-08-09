import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { AppText } from '@/components/AppText';
import { useLocale } from '@/i18n';
import { useReducedMotion } from '@/motion/useReducedMotion';
import { useTheme } from '@/theme';
import type { AiReviewPhase } from '../api';
import { isProcessingPhase, processingSteps } from '../selectAiReview';

type AiProcessingAnimationProps = {
  phase: AiReviewPhase;
};

/**
 * One refined AI processing animation — checklist of states, no chatbot, no % bar.
 */
export function AiProcessingAnimation({ phase }: AiProcessingAnimationProps) {
  const { t } = useLocale();
  const { colors, theme } = useTheme();
  const reduce = useReducedMotion();
  const pulse = useSharedValue(1);

  useEffect(() => {
    if (reduce || !isProcessingPhase(phase)) {
      pulse.value = 1;
      return;
    }
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.08, { duration: 700, easing: Easing.inOut(Easing.quad) }),
        withTiming(1, { duration: 700, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      false,
    );
  }, [phase, pulse, reduce]);

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
    opacity: 0.35 + (pulse.value - 1) * 2,
  }));

  const steps = processingSteps(
    isProcessingPhase(phase) ? phase : 'preparing',
  );

  return (
    <View
      accessibilityRole="summary"
      style={{
        alignItems: 'center',
        gap: theme.spacing.lg,
        paddingVertical: theme.spacing.xl,
      }}
    >
      <View
        style={{
          width: 120,
          height: 120,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Animated.View
          style={[
            {
              position: 'absolute',
              width: 120,
              height: 120,
              borderRadius: 60,
              borderWidth: 2,
              borderColor: colors.brand,
            },
            ringStyle,
          ]}
        />
        <View
          style={{
            width: 72,
            height: 72,
            borderRadius: 36,
            backgroundColor: colors.brandSoft ?? colors.surfaceSecondary,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <AppText variant="heading" weight="semibold" style={{ color: colors.brand }}>
            AI
          </AppText>
        </View>
      </View>

      <AppText variant="heading" weight="semibold" align="center">
        {t(`mobile.aiIntake.phases.${phase}`)}
      </AppText>
      <AppText variant="bodySecondary" color="secondary" align="center">
        {t('mobile.aiIntake.processingHint')}
      </AppText>

      <View style={{ width: '100%', gap: theme.spacing.md, marginTop: theme.spacing.sm }}>
        {steps.map((step) => (
          <View
            key={step.key}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: theme.spacing.md,
              minHeight: theme.sizes.touch.min * 0.7,
            }}
          >
            <View
              style={{
                width: 22,
                height: 22,
                borderRadius: 11,
                borderWidth: 2,
                borderColor: step.done || step.active ? colors.brand : colors.border,
                backgroundColor: step.done ? colors.brand : 'transparent',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {step.done ? (
                <AppText variant="caption" style={{ color: colors.onBrand }}>
                  ✓
                </AppText>
              ) : step.active ? (
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: colors.brand,
                  }}
                />
              ) : null}
            </View>
            <AppText
              variant="label"
              weight={step.active ? 'semibold' : 'medium'}
              color={step.active || step.done ? 'primary' : 'muted'}
            >
              {t(`mobile.aiIntake.phases.${step.key}`)}
            </AppText>
          </View>
        ))}
      </View>
    </View>
  );
}
