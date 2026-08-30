import { View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { AppText } from '@/components/AppText';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics, softFadeDown, useReducedMotion } from '@/motion';
import { useTheme } from '@/theme';
import Animated from 'react-native-reanimated';
import type { WorkerHomeTaskWithFloor } from '../selectWorkerHome';
import { todayBucketLabelKey } from '../selectWorkerHome';
import {
  localizedWorkerProductTitle,
  localizedWorkerStageName,
} from '../selectWorkerHome';
import type { TodayFloorBucket } from '@/features/tasks/floorPhase';
import { todayQualityStampLabelKey } from '@/features/tasks/floorPhase';

type BucketKey = Exclude<TodayFloorBucket, 'COMPLETED_TODAY'>;

type Props = {
  bucket: BucketKey;
  tasks: WorkerHomeTaskWithFloor[];
};

/**
 * Compact Today bucket — section stamp + tappable task rows.
 * Stronger visual separation between Do now / Ready after receiving / Waiting.
 */
export function TodayFloorBucketSection({ bucket, tasks }: Props) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme } = useTheme();
  const router = useRouter();
  const reduce = useReducedMotion();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  if (tasks.length === 0) return null;

  const accent =
    bucket === 'DO_NOW'
      ? colors.brand
      : bucket === 'READY_AFTER_RECEIVING'
        ? colors.info
        : colors.textMuted;
  const accentSoft =
    bucket === 'DO_NOW'
      ? colors.brandSoft
      : bucket === 'READY_AFTER_RECEIVING'
        ? colors.infoSoft
        : colors.surfaceSecondary;
  const borderTone =
    bucket === 'DO_NOW'
      ? colors.brand
      : bucket === 'READY_AFTER_RECEIVING'
        ? colors.info
        : colors.borderStrong;

  return (
    <Animated.View
      entering={reduce ? undefined : softFadeDown(40)}
      style={{ marginBottom: theme.spacing.lg }}
    >
      <View
        style={{
          backgroundColor: colors.surface,
          borderRadius: theme.radius.xl,
          borderWidth: bucket === 'DO_NOW' ? 1.5 : 1,
          borderColor: borderTone,
          overflow: 'hidden',
          ...theme.elevation.card,
        }}
      >
        <View
          style={{
            height: 4,
            backgroundColor: accent,
            opacity: bucket === 'WAITING' ? 0.35 : 0.85,
          }}
        />
        <View
          style={{
            paddingHorizontal: theme.spacing.md,
            paddingTop: theme.spacing.md,
            paddingBottom: theme.spacing.sm,
            backgroundColor: accentSoft,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
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
            <AppText
              variant="caption"
              weight="semibold"
              style={{
                color: accent,
                letterSpacing: locale === 'ar' ? 0 : 1.2,
                textTransform: locale === 'ar' ? 'none' : 'uppercase',
                flex: 1,
                textAlign: isRTL ? 'right' : 'left',
              }}
            >
              {t(todayBucketLabelKey(bucket))}
            </AppText>
            <View
              style={{
                minWidth: 28,
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderRadius: theme.radius.full,
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: accent,
                alignItems: 'center',
              }}
            >
              <AppText variant="caption" weight="semibold" style={{ color: accent }}>
                {String(tasks.length)}
              </AppText>
            </View>
          </View>
        </View>
        <View style={{ padding: theme.spacing.md, gap: theme.spacing.sm }}>
          {tasks.map((task) => {
            const stageName = localizedWorkerStageName(task, locale);
            const productTitle = localizedWorkerProductTitle(task, locale);
            const stampKey = todayQualityStampLabelKey(task.qualityStamp ?? null);
            return (
              <AnimatedPressable
                key={task.id}
                variant="card"
                accessibilityRole="button"
                accessibilityLabel={`${productTitle} ${task.orderNumber}`}
                onPress={() => {
                  void haptics.selection();
                  router.push(`/(app)/(employee)/tasks/${task.id}` as Href);
                }}
                style={{
                  padding: theme.spacing.md,
                  borderRadius: theme.radius.lg,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.surfaceSecondary,
                  gap: 4,
                }}
              >
                <View
                  style={{
                    flexDirection: isRTL ? 'row-reverse' : 'row',
                    alignItems: 'center',
                    gap: theme.spacing.sm,
                    flexWrap: 'wrap',
                  }}
                >
                  <AppText
                    variant="caption"
                    weight="semibold"
                    style={{
                      color: accent,
                      textAlign: isRTL ? 'right' : 'left',
                      fontSize: 11,
                    }}
                  >
                    {stageName}
                  </AppText>
                  {stampKey ? (
                    <View
                      style={{
                        paddingHorizontal: 8,
                        paddingVertical: 2,
                        borderRadius: theme.radius.full,
                        backgroundColor: colors.surface,
                        borderWidth: 1,
                        borderColor: accent,
                      }}
                    >
                      <AppText
                        variant="caption"
                        weight="semibold"
                        style={{
                          color: accent,
                          fontSize: 10,
                          letterSpacing: locale === 'ar' ? 0 : 0.4,
                          textTransform: locale === 'ar' ? 'none' : 'uppercase',
                        }}
                      >
                        {t(stampKey)}
                      </AppText>
                    </View>
                  ) : null}
                </View>
                <AppText
                  variant="label"
                  weight={titleWeight}
                  numberOfLines={2}
                  style={{ textAlign: isRTL ? 'right' : 'left' }}
                >
                  {productTitle}
                </AppText>
                <AppText
                  variant="caption"
                  color="secondary"
                  dir="ltr"
                  style={{ textAlign: isRTL ? 'right' : 'left' }}
                >
                  {t('mobile.workerHome.orderLabel', { number: task.orderNumber })}
                </AppText>
              </AnimatedPressable>
            );
          })}
        </View>
      </View>
    </Animated.View>
  );
}
