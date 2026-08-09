import { useEffect } from 'react';
import { Image, ScrollView, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Defs, LinearGradient as SvgGradient, Rect, Stop } from 'react-native-svg';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { BrandMark } from '@/components/BrandMark';
import { AppText } from '@/components/AppText';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics, softFadeDown, softFadeSide, useReducedMotion } from '@/motion';
import { useTheme } from '@/theme';
import type { WorkerHomeTask } from '../api';
import {
  localizedWorkerProductTitle,
  localizedWorkerStageName,
} from '../selectWorkerHome';

type UpcomingTasksListProps = {
  tasks: WorkerHomeTask[];
};

const TICKET_WIDTH = 212;
const MEDIA_HEIGHT = 120;
const CHARCOAL = '#141210';

function dueShort(
  deadline: string | null,
  formatDateTime: (v: string) => string,
  fallback: string,
): string {
  if (!deadline) return fallback;
  const full = formatDateTime(deadline);
  const parts = full.split(/[,\s]+/).filter(Boolean);
  return parts.length > 1 ? parts[parts.length - 1]! : full;
}

type TicketProps = {
  task: WorkerHomeTask;
  index: number;
};

function UpcomingQueueTicket({ task, index }: TicketProps) {
  const { t, formatDateTime, isRTL, locale } = useLocale();
  const { colors, theme } = useTheme();
  const router = useRouter();
  const stageName = localizedWorkerStageName(task, locale);
  const productTitle = localizedWorkerProductTitle(task, locale);
  const reduce = useReducedMotion();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  const due = dueShort(task.deadline, formatDateTime, t('mobile.workerHome.noDeadline'));

  return (
    <Animated.View
      entering={reduce ? undefined : softFadeSide(isRTL, 80 + index * 24)}
    >
      <AnimatedPressable
        variant="card"
        accessibilityRole="button"
        accessibilityLabel={`${productTitle} ${task.orderNumber}`}
        onPress={() => {
          void haptics.selection();
          router.push(`/(app)/(employee)/tasks/${task.id}` as Href);
        }}
        style={{
          width: TICKET_WIDTH,
          borderRadius: theme.radius.xl,
          borderWidth: 1,
          borderColor: colors.borderStrong,
          backgroundColor: colors.surface,
          overflow: 'hidden',
          ...theme.elevation.raised,
        }}
      >
        <View style={{ height: MEDIA_HEIGHT, width: '100%', backgroundColor: CHARCOAL }}>
          {task.imageUrl ? (
            <Image
              source={{ uri: task.imageUrl }}
              style={{ width: '100%', height: '100%' }}
              resizeMode="cover"
              accessibilityIgnoresInvertColors
            />
          ) : (
            <View style={{ flex: 1 }}>
              <Svg width="100%" height="100%" preserveAspectRatio="none">
                <Defs>
                  <SvgGradient id={`queueTicketFallback-${task.id}`} x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0%" stopColor="#2C2724" stopOpacity="1" />
                    <Stop offset="100%" stopColor={CHARCOAL} stopOpacity="1" />
                  </SvgGradient>
                </Defs>
                <Rect
                  x="0"
                  y="0"
                  width="100%"
                  height="100%"
                  fill={`url(#queueTicketFallback-${task.id})`}
                />
              </Svg>
              <View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  top: 0,
                  bottom: 0,
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: 0.1,
                }}
              >
                <BrandMark
                  variant="monogram"
                  size="hero"
                  tone="on-dark"
                  style={{ width: 72, height: 72 }}
                />
              </View>
            </View>
          )}

          <View
            pointerEvents="none"
            style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
          >
            <Svg width="100%" height="100%" preserveAspectRatio="none">
              <Defs>
                <SvgGradient id={`queueTicketScrim-${task.id}`} x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0%" stopColor={CHARCOAL} stopOpacity="0" />
                  <Stop offset="55%" stopColor={CHARCOAL} stopOpacity="0.15" />
                  <Stop offset="100%" stopColor={CHARCOAL} stopOpacity="0.72" />
                </SvgGradient>
              </Defs>
              <Rect
                x="0"
                y="0"
                width="100%"
                height="100%"
                fill={`url(#queueTicketScrim-${task.id})`}
              />
            </Svg>
          </View>

          <View
            style={{
              position: 'absolute',
              left: theme.spacing.sm,
              right: theme.spacing.sm,
              bottom: theme.spacing.sm,
              alignItems: isRTL ? 'flex-end' : 'flex-start',
            }}
          >
            <AppText
              variant="caption"
              weight="semibold"
              numberOfLines={1}
              align="start"
              style={{ color: colors.brand, fontSize: 11 }}
            >
              {stageName}
            </AppText>
          </View>
        </View>

        <View
          style={{
            padding: theme.spacing.md,
            gap: 6,
            alignItems: isRTL ? 'flex-end' : 'flex-start',
          }}
        >
          <AppText variant="label" weight={titleWeight} numberOfLines={2} align="start">
            {productTitle}
          </AppText>
          <AppText
            variant="caption"
            color="secondary"
            numberOfLines={1}
            align="start"
            dir="ltr"
            style={{ letterSpacing: 0.2 }}
          >
            {t('mobile.workerHome.orderLabel', { number: task.orderNumber })}
          </AppText>
          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'center',
              gap: 5,
              marginTop: 2,
            }}
          >
            <Ionicons name="time-outline" size={13} color={colors.textMuted} />
            <AppText variant="caption" color="muted" numberOfLines={1} align="start">
              {due}
            </AppText>
          </View>
        </View>
      </AnimatedPressable>
    </Animated.View>
  );
}

/**
 * Upcoming queue board — one industrial tray + Moments-style horizontal tickets.
 */
export function UpcomingTasksList({ tasks }: UpcomingTasksListProps) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme } = useTheme();
  const router = useRouter();
  const reduce = useReducedMotion();

  const countPulse = useSharedValue(reduce || tasks.length === 0 ? 0 : 0);

  useEffect(() => {
    if (reduce || tasks.length === 0) {
      countPulse.value = 0;
      return;
    }
    countPulse.value = withDelay(
      400,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: 1400, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        false,
      ),
    );
  }, [countPulse, reduce, tasks.length]);

  const countStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(countPulse.value, [0, 1], [1, 1.06]) }],
    opacity: interpolate(countPulse.value, [0, 1], [0.92, 1]),
  }));

  return (
    <Animated.View
      entering={reduce ? undefined : softFadeDown(40)}
      style={{ marginBottom: theme.spacing.xl }}
    >
      <View
        style={{
          backgroundColor: colors.surface,
          borderRadius: theme.radius.xl,
          borderWidth: 1,
          borderColor: colors.borderStrong,
          overflow: 'hidden',
          ...theme.elevation.card,
        }}
      >
        {/* Brand hairline tray edge */}
        <View
          style={{
            height: 3,
            backgroundColor: colors.brand,
            opacity: 0.35,
          }}
        />

        <View style={{ paddingTop: theme.spacing.md, paddingBottom: theme.spacing.md, gap: theme.spacing.md }}>
          <Animated.View
            entering={reduce ? undefined : softFadeDown(60)}
            style={{
              paddingHorizontal: theme.spacing.md,
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'flex-end',
              justifyContent: 'space-between',
              gap: theme.spacing.md,
            }}
          >
            <View style={{ flex: 1, gap: 4, minWidth: 0 }}>
              <AppText
                variant="caption"
                weight="semibold"
                style={{
                  color: colors.brand,
                  letterSpacing: locale === 'ar' ? 0 : 1.6,
                  textTransform: locale === 'ar' ? 'none' : 'uppercase',
                }}
              >
                {t('mobile.workerHome.upcomingEyebrow')}
              </AppText>
              <View
                style={{
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  alignItems: 'center',
                  gap: theme.spacing.sm,
                  flexWrap: 'wrap',
                }}
              >
                <AppText variant="title" weight="semibold" align="start">
                  {t('mobile.workerHome.upcomingSection')}
                </AppText>
                <Animated.View
                  style={[
                    {
                      minWidth: 28,
                      height: 28,
                      borderRadius: 14,
                      paddingHorizontal: 8,
                      backgroundColor: colors.brandSoft,
                      borderWidth: 1,
                      borderColor: colors.brand,
                      alignItems: 'center',
                      justifyContent: 'center',
                    },
                    countStyle,
                  ]}
                >
                  <AppText
                    variant="caption"
                    weight="semibold"
                    style={{ color: colors.brand, fontVariant: ['tabular-nums'] }}
                  >
                    {String(tasks.length)}
                  </AppText>
                </Animated.View>
              </View>
            </View>

            <AnimatedPressable
              variant="button"
              accessibilityRole="button"
              accessibilityLabel={t('mobile.workerHome.viewAll')}
              onPress={() => {
                void haptics.selection();
                router.push('/(app)/(employee)/(tabs)/tasks' as Href);
              }}
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                alignItems: 'center',
                gap: 4,
                paddingHorizontal: theme.spacing.sm + 2,
                paddingVertical: 8,
                borderRadius: theme.radius.full,
                borderWidth: 1,
                borderColor: colors.brand,
                backgroundColor: colors.brandSoft,
              }}
            >
              <AppText variant="caption" weight="semibold" style={{ color: colors.brand }}>
                {t('mobile.workerHome.viewAll')}
              </AppText>
              <Ionicons
                name={isRTL ? 'chevron-back' : 'chevron-forward'}
                size={14}
                color={colors.brand}
              />
            </AnimatedPressable>
          </Animated.View>

          {tasks.length === 0 ? (
            <View style={{ paddingHorizontal: theme.spacing.md, paddingBottom: theme.spacing.xs }}>
              <AppText variant="bodySecondary" color="secondary" align="start">
                {t('mobile.workerHome.noMoreTasks')}
              </AppText>
            </View>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              decelerationRate="fast"
              contentContainerStyle={{
                gap: theme.spacing.md,
                paddingHorizontal: theme.spacing.md,
                paddingVertical: 4,
                flexDirection: isRTL ? 'row-reverse' : 'row',
              }}
            >
              {tasks.map((task, index) => (
                <UpcomingQueueTicket key={task.id} task={task} index={index} />
              ))}
            </ScrollView>
          )}
        </View>
      </View>
    </Animated.View>
  );
}
