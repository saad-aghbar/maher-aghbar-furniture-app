import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { AppText } from '@/components/AppText';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';
import type { NewOrderStep } from '../newOrderSteps';
import { stageProgress } from '../newOrderStageMath';

export type { NewOrderStep };

type StepIndicatorProps = {
  step: NewOrderStep;
};

/** @deprecated Prefer NewOrderStageRail — kept for any external imports. */
export function StepIndicator({ step }: StepIndicatorProps) {
  const { t, isRTL } = useLocale();
  const { colors, theme } = useTheme();
  const progress = useSharedValue(stageProgress(step));

  useEffect(() => {
    progress.value = withTiming(stageProgress(step), { duration: 280 });
  }, [step, progress]);

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
    <View style={{ gap: theme.spacing.sm }}>
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          justifyContent: 'space-between',
          gap: 2,
        }}
      >
        {labels.map((label, i) => {
          const active = step === i + 1;
          const done = step > i + 1;
          return (
            <View
              key={`${i}-${label}`}
              style={{ flex: 1, alignItems: 'center', gap: 4 }}
            >
              <View
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 11,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: active || done ? colors.brand : colors.surface,
                  borderWidth: 1,
                  borderColor: active || done ? colors.brand : colors.border,
                }}
              >
                <AppText
                  variant="caption"
                  weight="semibold"
                  style={{
                    color: active || done ? colors.onBrand : colors.textMuted,
                    fontSize: 10,
                  }}
                >
                  {done ? '✓' : i + 1}
                </AppText>
              </View>
              <AppText
                variant="caption"
                weight={active ? 'semibold' : 'medium'}
                numberOfLines={1}
                style={{
                  color: active || done ? colors.brand : colors.textMuted,
                  fontSize: 9,
                  textAlign: 'center',
                }}
              >
                {label}
              </AppText>
            </View>
          );
        })}
      </View>
      <View
        style={{
          height: 4,
          borderRadius: 2,
          backgroundColor: colors.border,
          overflow: 'hidden',
        }}
      >
        <Animated.View
          style={[
            {
              height: 4,
              borderRadius: 2,
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
