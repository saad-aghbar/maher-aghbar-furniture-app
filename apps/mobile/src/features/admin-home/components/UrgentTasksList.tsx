import { useEffect } from 'react';
import { View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import Animated, {
  Easing,
  FadeInDown,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { AppText } from '@/components/AppText';
import { PriorityBadge } from '@/components/badges/PriorityBadge';
import type { PriorityLevel } from '@/components/badges/badgeStyles';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics, useReducedMotion } from '@/motion';
import { useTheme } from '@/theme';
import type { AdminHomeUrgentTask } from '../api';

type UrgentTasksListProps = {
  tasks: AdminHomeUrgentTask[];
};

function toPriorityLevel(priority: string): PriorityLevel {
  const p = priority.toLowerCase();
  if (p === 'urgent' || p === 'high' || p === 'low' || p === 'medium') return p;
  if (p === 'normal') return 'medium';
  return 'medium';
}

/**
 * Perforated shop tickets with a living priority pulse.
 */
export function UrgentTasksList({ tasks }: UrgentTasksListProps) {
  const { t, isRTL } = useLocale();
  const { colors, theme } = useTheme();
  const router = useRouter();
  const reduce = useReducedMotion();

  if (tasks.length === 0) return null;

  const Wrapper = reduce ? View : Animated.View;
  const wrapperProps = reduce
    ? {}
    : { entering: FadeInDown.delay(240).springify().damping(16) };

  return (
    <Wrapper {...wrapperProps} style={{ marginBottom: theme.spacing.xl, gap: theme.spacing.md }}>
      <View style={{ gap: 4 }}>
        <AppText
          variant="caption"
          weight="semibold"
          style={{ letterSpacing: 1.6, textTransform: 'uppercase', color: colors.brand }}
        >
          {t('mobile.adminHome.ticketsEyebrow')}
        </AppText>
        <AppText variant="title" weight="semibold">
          {t('mobile.adminHome.urgentTasksTitle')}
        </AppText>
      </View>

      {tasks.map((task, index) => (
        <TaskTicket
          key={task.id}
          task={task}
          index={index}
          reduce={reduce}
          isRTL={isRTL}
          onPress={() => {
            void haptics.selection();
            router.push('/(app)/(admin)/(tabs)/production' as Href);
          }}
        />
      ))}
    </Wrapper>
  );
}

function TaskTicket({
  task,
  index,
  reduce,
  isRTL,
  onPress,
}: {
  task: AdminHomeUrgentTask;
  index: number;
  reduce: boolean;
  isRTL: boolean;
  onPress: () => void;
}) {
  const { colors, theme } = useTheme();
  const enter = useSharedValue(reduce ? 1 : 0);
  const pulse = useSharedValue(0);
  const hot = toPriorityLevel(task.priority) === 'urgent' || toPriorityLevel(task.priority) === 'high';

  useEffect(() => {
    if (reduce) {
      enter.value = 1;
      return;
    }
    enter.value = withDelay(
      200 + index * 100,
      withTiming(1, { duration: 480, easing: Easing.out(Easing.cubic) }),
    );
    if (hot) {
      pulse.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 900, easing: Easing.inOut(Easing.sin) }),
          withTiming(0.3, { duration: 900, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        false,
      );
    }
  }, [enter, hot, index, pulse, reduce]);

  const style = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [
      { translateY: interpolate(enter.value, [0, 1], [16, 0]) },
      { rotate: `${interpolate(enter.value, [0, 1], [isRTL ? 1.5 : -1.5, 0])}deg` },
    ],
  }));

  const stubStyle = useAnimatedStyle(() => ({
    opacity: hot ? 0.55 + pulse.value * 0.45 : 1,
  }));

  return (
    <Animated.View
      style={[
        style,
        {
          borderRadius: theme.radius.lg,
          ...theme.elevation.card,
        },
      ]}
    >
      <AnimatedPressable
        variant="card"
        accessibilityRole="button"
        accessibilityLabel={task.name}
        onPress={onPress}
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: theme.radius.lg,
          overflow: 'hidden',
          minHeight: 84,
        }}
      >
        <Animated.View
          style={[
            {
              width: 8,
              backgroundColor: hot ? colors.warning : colors.brand,
            },
            stubStyle,
          ]}
        />
        <View
          style={{
            flex: 1,
            paddingVertical: theme.spacing.md,
            paddingHorizontal: theme.spacing.md,
            gap: theme.spacing.xs,
          }}
        >
          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: theme.spacing.sm,
            }}
          >
            <AppText variant="label" weight="semibold" style={{ flex: 1 }} numberOfLines={1}>
              {task.name}
            </AppText>
            <PriorityBadge priority={toPriorityLevel(task.priority)} />
          </View>
          <AppText variant="caption" color="secondary">
            {task.number}
            {task.assigneeName ? ` · ${task.assigneeName}` : ''}
          </AppText>
        </View>
        {/* Perforation dots */}
        <View
          style={{
            width: 16,
            justifyContent: 'space-evenly',
            alignItems: 'center',
            paddingVertical: 8,
            borderLeftWidth: isRTL ? 0 : 1,
            borderRightWidth: isRTL ? 1 : 0,
            borderColor: colors.border,
            borderStyle: 'dashed',
          }}
        >
          {[0, 1, 2, 3].map((i) => (
            <View
              key={i}
              style={{
                width: 5,
                height: 5,
                borderRadius: 2.5,
                backgroundColor: colors.border,
              }}
            />
          ))}
        </View>
      </AnimatedPressable>
    </Animated.View>
  );
}
