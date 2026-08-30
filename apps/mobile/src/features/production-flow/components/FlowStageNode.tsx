import { useEffect } from 'react';
import { Platform, Pressable, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { AppText } from '@/components/AppText';
import { useTheme } from '@/theme';
import type { ProductionFlowStage } from '../selectProductionFlow';
import { selectFlowStageGlyph } from '../flowStageGlyph';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export const FLOW_NODE = 56;

type Props = {
  stage: ProductionFlowStage;
  index: number;
  left: number;
  top: number;
  onPress?: () => void;
  reduceMotion: boolean;
  /** Template / editor chart — show step numbers, not estimate warnings. */
  preview?: boolean;
  /** Product-times editor may show estimates; order flow leaves pending nodes empty. */
  showEstimatedDuration?: boolean;
};

function normalizeStatus(status: string): string {
  const s = status.toUpperCase();
  if (s === 'DONE') return 'COMPLETED';
  return s;
}

export function FlowStageNode({
  stage,
  index,
  left,
  top,
  onPress,
  reduceMotion,
  preview = false,
  showEstimatedDuration = false,
}: Props) {
  const { colors } = useTheme();
  const status = normalizeStatus(stage.status);
  const completed = status === 'COMPLETED' || status === 'SKIPPED';
  const inProgress = status === 'IN_PROGRESS' || status === 'ACTIVE';
  const ready = status === 'READY';
  const blocked = status === 'BLOCKED' || stage.blockers.length > 0 || stage.isOverdue;
  const glyph = selectFlowStageGlyph(stage, {
    preview,
    index,
    showEstimatedDuration,
  });

  const ring =
    blocked && !completed
      ? colors.error
      : completed
        ? colors.success
        : inProgress || ready
          ? colors.brand
          : colors.borderStrong;

  const enter = useSharedValue(preview || reduceMotion ? 1 : 0);
  const pulse = useSharedValue(1);
  const arcProgress = useSharedValue(
    completed ? 1 : Math.max(0.08, Math.min(1, stage.progressPercent / 100)),
  );

  useEffect(() => {
    if (preview || reduceMotion) {
      enter.value = 1;
      return;
    }
    enter.value = withDelay(
      index * 55,
      withTiming(1, { duration: 400, easing: Easing.out(Easing.cubic) }),
    );
  }, [enter, index, preview, reduceMotion]);

  useEffect(() => {
    if (!inProgress || reduceMotion) {
      pulse.value = 1;
      return;
    }
    pulse.value = withRepeat(
      withTiming(1.05, { duration: 1100, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, [inProgress, pulse, reduceMotion]);

  useEffect(() => {
    const target = completed
      ? 1
      : Math.max(inProgress ? 0.12 : 0, Math.min(1, stage.progressPercent / 100));
    if (reduceMotion) {
      arcProgress.value = target;
      return;
    }
    arcProgress.value = withTiming(target, {
      duration: 520,
      easing: Easing.out(Easing.cubic),
    });
  }, [arcProgress, completed, inProgress, reduceMotion, stage.progressPercent]);

  const wrapStyle = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [
      { scale: enter.value * pulse.value },
      { translateY: (1 - enter.value) * 12 },
    ],
  }));

  const r = 20;
  const circumference = 2 * Math.PI * r;
  const animatedArc = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - arcProgress.value),
  }));

  const fillBg = completed
    ? colors.success
    : ready
      ? colors.brandSoft
      : colors.surface;

  const shadow =
    Platform.OS === 'ios'
      ? {
          shadowColor: completed ? colors.success : colors.brandActive,
          shadowOffset: { width: 0, height: 3 },
          shadowOpacity: completed ? 0.28 : 0.12,
          shadowRadius: 8,
        }
      : { elevation: completed ? 4 : 2 };

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left,
          top,
          width: FLOW_NODE + 64,
          marginLeft: -32,
          alignItems: 'center',
          gap: 8,
        },
        wrapStyle,
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={stage.name}
        onPress={onPress}
        hitSlop={10}
        style={{ alignItems: 'center', gap: 8 }}
      >
        {/* Soft halo behind active / completed nodes */}
        {(completed || inProgress || ready) && (
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: -6,
              width: FLOW_NODE + 12,
              height: FLOW_NODE + 12,
              borderRadius: (FLOW_NODE + 12) / 2,
              backgroundColor: completed
                ? colors.successSoft
                : colors.brandSoft,
              opacity: 0.9,
            }}
          />
        )}
        <View
          style={[
            {
              width: FLOW_NODE,
              height: FLOW_NODE,
              borderRadius: FLOW_NODE / 2,
              backgroundColor: fillBg,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: completed ? 0 : 1.5,
              borderColor: ring,
            },
            shadow,
          ]}
        >
          <Svg width={FLOW_NODE} height={FLOW_NODE} style={{ position: 'absolute' }}>
            {!completed ? (
              <Circle
                cx={FLOW_NODE / 2}
                cy={FLOW_NODE / 2}
                r={r + 2}
                stroke={ring}
                strokeWidth={1}
                fill="none"
                opacity={0.22}
              />
            ) : null}
            {!completed && (inProgress || stage.progressPercent > 0) ? (
              <AnimatedCircle
                cx={FLOW_NODE / 2}
                cy={FLOW_NODE / 2}
                r={r}
                stroke={ring}
                strokeWidth={3.25}
                fill="none"
                strokeDasharray={`${circumference} ${circumference}`}
                animatedProps={animatedArc}
                strokeLinecap="round"
                transform={`rotate(-90 ${FLOW_NODE / 2} ${FLOW_NODE / 2})`}
              />
            ) : null}
            {!completed && !inProgress && stage.progressPercent === 0 ? (
              <Circle
                cx={FLOW_NODE / 2}
                cy={FLOW_NODE / 2}
                r={r}
                stroke={ring}
                strokeWidth={1.5}
                fill="none"
                opacity={0.5}
              />
            ) : null}
            {completed ? (
              <Path
                d="M18 29 L25 36 L40 20"
                stroke={colors.onBrand}
                strokeWidth={2.75}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ) : null}
          </Svg>
          {!completed && glyph ? (
            <AppText
              variant="caption"
              weight="semibold"
              style={{
                color:
                  glyph === '!'
                    ? colors.error
                    : inProgress || ready
                      ? colors.brand
                      : colors.textSecondary,
                fontSize: 11,
              }}
            >
              {glyph}
            </AppText>
          ) : null}
        </View>
        <AppText
          variant="caption"
          weight="semibold"
          numberOfLines={2}
          style={{
            textAlign: 'center',
            maxWidth: FLOW_NODE + 72,
            lineHeight: 16,
            letterSpacing: 0.15,
            color: blocked && !completed ? colors.error : colors.textPrimary,
          }}
        >
          {stage.name}
        </AppText>
      </Pressable>
    </Animated.View>
  );
}
