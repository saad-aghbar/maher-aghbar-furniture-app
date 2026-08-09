import { Image, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Defs, LinearGradient as SvgGradient, Rect, Stop } from 'react-native-svg';
import Animated from 'react-native-reanimated';
import { BrandMark } from '@/components/BrandMark';
import { AppText } from '@/components/AppText';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics, softFadeDown, useReducedMotion } from '@/motion';
import { useTheme } from '@/theme';
import type { WorkerHomeTask } from '../api';
import {
  formatEstimatedDuration,
  localizedWorkerProductTitle,
  localizedWorkerStageName,
} from '../selectWorkerHome';

const CREAM = '#F7F4EF';
const CHARCOAL = '#141210';
const STAGE_HEIGHT = 320;

type Props = {
  task: WorkerHomeTask;
};

function isHighPriority(priority: string): boolean {
  const p = priority.toLowerCase();
  return p === 'urgent' || p === 'high';
}

function dueTimeLabel(
  deadline: string | null,
  formatDateTime: (v: string) => string,
  noDeadline: string,
): string {
  if (!deadline) return noDeadline;
  const full = formatDateTime(deadline);
  const parts = full.split(/[,\s]+/).filter(Boolean);
  return parts.length > 1 ? parts[parts.length - 1]! : full;
}

/**
 * Image-backed current-task stage — workshop floor hero for Worker Home.
 */
export function WorkerCurrentTaskHero({ task }: Props) {
  const { t, formatDateTime, isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const router = useRouter();
  const reduce = useReducedMotion();
  const href = `/(app)/(employee)/tasks/${task.id}` as Href;
  const high = isHighPriority(task.priority);
  const inProgress = String(task.status).toUpperCase() === 'IN_PROGRESS';
  const stageName = localizedWorkerStageName(task, locale);
  const productTitle = localizedWorkerProductTitle(task, locale);

  const dueLabel = dueTimeLabel(
    task.deadline,
    formatDateTime,
    t('mobile.workerHome.noDeadline'),
  );
  const estLabel = formatEstimatedDuration(task.estimatedMinutes, {
    hour: t('mobile.workerHome.durationHour'),
    minute: t('mobile.workerHome.durationMinute'),
  });
  const elapsedLabel =
    task.timing && task.timing.elapsedMinutes > 0
      ? formatEstimatedDuration(task.timing.elapsedMinutes, {
          hour: t('mobile.workerHome.durationHour'),
          minute: t('mobile.workerHome.durationMinute'),
        })
      : null;
  const running = task.timing?.status === 'running';

  const open = () => {
    void haptics.selection();
    router.push(href);
  };

  const midOpacity = colorScheme === 'dark' ? 0.55 : 0.5;
  const bottomOpacity = colorScheme === 'dark' ? 0.94 : 0.88;
  const edge = theme.spacing.md;
  const markSize = 140;

  return (
    <Animated.View
      entering={reduce ? undefined : softFadeDown(40)}
      style={{ marginBottom: theme.spacing.xl, gap: theme.spacing.sm }}
    >
      <AppText
        variant="caption"
        weight="semibold"
        style={{
          color: colors.textMuted,
          letterSpacing: locale === 'ar' ? 0 : 1.4,
          textTransform: locale === 'ar' ? 'none' : 'uppercase',
          textAlign: isRTL ? 'right' : 'left',
        }}
      >
        {t('mobile.workerHome.currentTaskSection')}
      </AppText>

      <AnimatedPressable
        variant="card"
        accessibilityRole="button"
        accessibilityLabel={`${productTitle} ${task.orderNumber}`}
        onPress={open}
        style={{
          borderRadius: theme.radius.xl,
          overflow: 'hidden',
          backgroundColor: CHARCOAL,
          ...theme.elevation.card,
        }}
      >
        <View style={{ height: STAGE_HEIGHT, width: '100%' }}>
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
                  <SvgGradient id="workerHeroFallback" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0%" stopColor="#2C2724" stopOpacity="1" />
                    <Stop offset="55%" stopColor="#221E1C" stopOpacity="1" />
                    <Stop offset="100%" stopColor={CHARCOAL} stopOpacity="1" />
                  </SvgGradient>
                </Defs>
                <Rect x="0" y="0" width="100%" height="100%" fill="url(#workerHeroFallback)" />
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
                  opacity: 0.08,
                }}
              >
                <BrandMark
                  variant="monogram"
                  size="hero"
                  tone="on-dark"
                  style={{ width: markSize, height: markSize }}
                />
              </View>
            </View>
          )}

          {/* Single bottom-weighted scrim — no muddy mid washes */}
          <View
            pointerEvents="none"
            style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
          >
            <Svg width="100%" height="100%" preserveAspectRatio="none">
              <Defs>
                <SvgGradient id="workerHeroScrim" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0%" stopColor={CHARCOAL} stopOpacity="0" />
                  <Stop offset="38%" stopColor={CHARCOAL} stopOpacity={midOpacity * 0.35} />
                  <Stop offset="62%" stopColor={CHARCOAL} stopOpacity={midOpacity} />
                  <Stop offset="100%" stopColor={CHARCOAL} stopOpacity={bottomOpacity} />
                </SvgGradient>
              </Defs>
              <Rect x="0" y="0" width="100%" height="100%" fill="url(#workerHeroScrim)" />
            </Svg>
          </View>

          <View
            style={{
              position: 'absolute',
              top: edge,
              bottom: edge,
              left: edge,
              right: edge,
              justifyContent: 'space-between',
            }}
          >
            {high ? (
              <View
                style={{
                  alignSelf: isRTL ? 'flex-end' : 'flex-start',
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  alignItems: 'center',
                  gap: 6,
                  backgroundColor: 'rgba(20,18,16,0.72)',
                  borderWidth: 1,
                  borderColor: 'rgba(247,244,239,0.16)',
                  paddingHorizontal: theme.spacing.sm + 2,
                  paddingVertical: 5,
                  borderRadius: theme.radius.full,
                }}
              >
                <View
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: colors.error,
                  }}
                />
                <AppText
                  variant="caption"
                  weight="semibold"
                  style={{ color: CREAM, fontSize: 11 }}
                >
                  {t('mobile.workerHome.highPriority')}
                </AppText>
              </View>
            ) : (
              <View />
            )}

            <View style={{ gap: theme.spacing.md, width: '100%' }}>
              <View
                style={{
                  gap: theme.spacing.xs,
                  alignItems: isRTL ? 'flex-end' : 'flex-start',
                  width: '100%',
                }}
              >
                <AppText
                  variant="title"
                  weight="semibold"
                  numberOfLines={2}
                  align="start"
                  style={{ color: CREAM, fontSize: 22, lineHeight: 28 }}
                >
                  {productTitle}
                </AppText>
                <View
                  style={{
                    flexDirection: isRTL ? 'row-reverse' : 'row',
                    flexWrap: 'wrap',
                    gap: theme.spacing.sm,
                    alignItems: 'center',
                  }}
                >
                  <AppText
                    variant="bodySecondary"
                    align="start"
                    style={{ color: 'rgba(247,244,239,0.88)' }}
                  >
                    {t('mobile.workerHome.orderLabel', { number: task.orderNumber })}
                  </AppText>
                  <AppText
                    variant="bodySecondary"
                    weight="semibold"
                    align="start"
                    style={{ color: colors.brand }}
                  >
                    {stageName}
                  </AppText>
                </View>
              </View>

              <View
                style={{
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  gap: theme.spacing.md,
                  backgroundColor: 'rgba(247,244,239,0.10)',
                  borderWidth: 1,
                  borderColor: 'rgba(247,244,239,0.14)',
                  borderRadius: theme.radius.lg,
                  paddingHorizontal: theme.spacing.md,
                  paddingVertical: theme.spacing.sm + 2,
                }}
              >
                <View
                  style={{
                    flexDirection: isRTL ? 'row-reverse' : 'row',
                    alignItems: 'center',
                    gap: 8,
                    flex: 1,
                    minWidth: 0,
                  }}
                >
                  <Ionicons name="time-outline" size={18} color={colors.brand} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <AppText
                      variant="caption"
                      align="start"
                      style={{ color: 'rgba(247,244,239,0.58)' }}
                    >
                      {t('mobile.workerHome.dueLabel')}
                    </AppText>
                    <AppText
                      variant="label"
                      weight="semibold"
                      align="start"
                      numberOfLines={1}
                      style={{ color: CREAM }}
                    >
                      {dueLabel}
                    </AppText>
                  </View>
                </View>
                {elapsedLabel ? (
                  <View
                    style={{
                      flexDirection: isRTL ? 'row-reverse' : 'row',
                      alignItems: 'center',
                      gap: 8,
                      flex: 1,
                      minWidth: 0,
                    }}
                  >
                    <Ionicons
                      name={running ? 'play-circle-outline' : 'timer-outline'}
                      size={18}
                      color={colors.brand}
                    />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <AppText
                        variant="caption"
                        align="start"
                        style={{ color: 'rgba(247,244,239,0.58)' }}
                      >
                        {running
                          ? t('mobile.tasks.timerLive')
                          : t('mobile.tasks.timerElapsed')}
                      </AppText>
                      <AppText
                        variant="label"
                        weight="semibold"
                        align="start"
                        numberOfLines={1}
                        style={{ color: CREAM }}
                      >
                        {elapsedLabel}
                      </AppText>
                    </View>
                  </View>
                ) : estLabel ? (
                  <View
                    style={{
                      flexDirection: isRTL ? 'row-reverse' : 'row',
                      alignItems: 'center',
                      gap: 8,
                      flex: 1,
                      minWidth: 0,
                    }}
                  >
                    <Ionicons name="hourglass-outline" size={18} color={colors.brand} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <AppText
                        variant="caption"
                        align="start"
                        style={{ color: 'rgba(247,244,239,0.58)' }}
                      >
                        {t('mobile.workerHome.estLabel')}
                      </AppText>
                      <AppText
                        variant="label"
                        weight="semibold"
                        align="start"
                        numberOfLines={1}
                        style={{ color: CREAM }}
                      >
                        {estLabel}
                      </AppText>
                    </View>
                  </View>
                ) : null}
              </View>

              <PrimaryButton
                label={
                  inProgress
                    ? t('mobile.workerHome.openTask')
                    : t('mobile.workerHome.startTask')
                }
                onPress={open}
                style={{
                  minHeight: theme.sizes.touch.min + 12,
                  borderRadius: theme.radius.lg,
                }}
              />
            </View>
          </View>
        </View>
      </AnimatedPressable>
    </Animated.View>
  );
}
