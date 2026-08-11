import { View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { AppText } from '@/components/AppText';
import { useLocale } from '@/i18n';
import { useReducedMotion } from '@/motion';
import { useTheme } from '@/theme';
import { useEffect } from 'react';

export type DealerProgressStage = {
  id: string;
  label: string;
  state: 'done' | 'active' | 'upcoming' | 'branch';
};

type Props = {
  stages: DealerProgressStage[];
  title?: string;
};

/** Branched plain-language progress for dealers — no worker/cost jargon. */
export function DealerProgressMap({ stages, title }: Props) {
  const { isRTL, locale } = useLocale();
  const { colors, theme } = useTheme();
  const reduceMotion = useReducedMotion();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const progress = useSharedValue(0);

  useEffect(() => {
    const doneCount = stages.filter((s) => s.state === 'done' || s.state === 'active').length;
    const ratio = stages.length ? doneCount / stages.length : 0;
    progress.value = reduceMotion ? ratio : withTiming(ratio, { duration: 520 });
  }, [stages, reduceMotion, progress]);

  const barStyle = useAnimatedStyle(() => ({
    width: `${Math.max(0, Math.min(1, progress.value)) * 100}%`,
  }));

  return (
    <View style={{ gap: theme.spacing.md }}>
      {title ? (
        <AppText
          variant="heading"
          weight={titleWeight}
          style={{ textAlign: isRTL ? 'right' : 'left', color: colors.textPrimary }}
        >
          {title}
        </AppText>
      ) : null}
      <View
        style={{
          height: 6,
          borderRadius: 3,
          backgroundColor: colors.surfaceSecondary,
          overflow: 'hidden',
        }}
      >
        <Animated.View
          style={[
            {
              height: '100%',
              backgroundColor: colors.brand,
              borderRadius: 3,
              alignSelf: isRTL ? 'flex-end' : 'flex-start',
            },
            barStyle,
          ]}
        />
      </View>
      <View style={{ gap: theme.spacing.sm }}>
        {stages.map((stage, index) => {
          const filled = stage.state === 'done' || stage.state === 'active';
          return (
            <View
              key={stage.id}
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                alignItems: 'center',
                gap: theme.spacing.sm,
              }}
            >
              <View
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 11,
                  borderWidth: 2,
                  borderColor: filled ? colors.brand : colors.border,
                  backgroundColor: stage.state === 'done' ? colors.brand : colors.surface,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {stage.state === 'branch' ? (
                  <View
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: colors.warning,
                    }}
                  />
                ) : null}
              </View>
              <AppText
                variant="body"
                weight={stage.state === 'active' ? titleWeight : 'regular'}
                style={{
                  flex: 1,
                  color: stage.state === 'upcoming' ? colors.textMuted : colors.textPrimary,
                  textAlign: isRTL ? 'right' : 'left',
                }}
              >
                {`${index + 1}. ${stage.label}`}
              </AppText>
            </View>
          );
        })}
      </View>
    </View>
  );
}
