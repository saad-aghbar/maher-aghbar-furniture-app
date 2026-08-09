import { Image, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Defs, LinearGradient as SvgGradient, Rect, Stop } from 'react-native-svg';
import { AppText } from '@/components/AppText';
import { Divider } from '@/components/layout/Divider';
import type { PriorityLevel } from '@/components/badges/badgeStyles';
import { resolveOrderMediaUri } from '@/features/sales-orders/components/OrderCardMedia';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { AnimatedPressable, ListItemEnter, haptics } from '@/motion';
import { useTheme } from '@/theme';

export type IndustrialFloorTaskCardModel = {
  id: string;
  /** Stage / department label (already localized) */
  department: string;
  productTitle: string;
  orderNumber: string;
  imageUrl: string | null;
  priority: PriorityLevel;
  deadline: string | null;
  emphasize?: boolean;
  completed?: boolean;
};

type Props = {
  task: IndustrialFloorTaskCardModel;
  index?: number;
  hero?: boolean;
  showOpenButton?: boolean;
  animateEnter?: boolean;
};

/** Near-square product crop — closer to catalog photo proportions. */
const MEDIA_ASPECT = 1.28;

function priorityStampLabel(
  priority: PriorityLevel,
  t: (key: string) => string,
): string {
  const apiKey = priority === 'medium' ? 'NORMAL' : priority.toUpperCase();
  const key = `mobile.production.priority.${apiKey}`;
  const label = t(key);
  if (label !== key) return label;
  const fallback: Record<PriorityLevel, string> = {
    urgent: 'Urgent',
    high: 'High',
    medium: 'Medium',
    low: 'Low',
  };
  return fallback[priority];
}

/**
 * Compact floor task board — header band, photo crop, identity, inset meta.
 */
export function IndustrialFloorTaskCard({
  task,
  index = 0,
  hero = false,
  showOpenButton = true,
  animateEnter = true,
}: Props) {
  const { t, formatDateTime, isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const router = useRouter();
  const href = `/(app)/(employee)/tasks/${task.id}` as Href;
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  const urgent = task.priority === 'urgent' || task.priority === 'high';
  const late = Boolean(task.emphasize) && !task.completed;
  const mediaUri = resolveOrderMediaUri(task.imageUrl);

  const accent = task.completed
    ? colors.success
    : late
      ? colors.error
      : urgent
        ? colors.warning
        : colors.brand;

  const borderColor = task.completed
    ? colors.success
    : late
      ? colors.error
      : urgent
        ? colors.warning
        : colors.borderStrong;

  const deadlineValue = task.deadline
    ? formatDateTime(task.deadline)
    : t('mobile.workerHome.noDeadline');

  const cta = task.completed
    ? t('mobile.workerHome.viewTask')
    : t('mobile.workerHome.openTask');

  const statusStamp = task.completed
    ? { soft: colors.successSoft, ink: colors.success, label: t('mobile.tasks.segments.done') }
    : late
      ? { soft: colors.errorSoft, ink: colors.error, label: t('mobile.production.late') }
      : urgent
        ? {
            soft: colors.warningSoft,
            ink: colors.warning,
            label: priorityStampLabel(task.priority, t),
          }
        : null;

  const open = () => {
    void haptics.selection();
    router.push(href);
  };

  const fadeBottom = colorScheme === 'dark' ? 0.72 : 0.58;

  return (
    <ListItemEnter index={index} enabled={animateEnter}>
      <AnimatedPressable
        variant="card"
        accessibilityRole="button"
        accessibilityLabel={`${task.productTitle} ${task.orderNumber}`}
        onPress={open}
        style={{
          borderRadius: theme.radius.xl,
          borderWidth: 1,
          borderColor,
          backgroundColor: colors.surface,
          overflow: 'hidden',
          marginBottom: theme.spacing.sm + 4,
          ...orderBoardShadow(colorScheme),
        }}
      >
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            ...(isRTL ? { right: 0 } : { left: 0 }),
            width: 3,
            backgroundColor: accent,
            opacity: late || urgent || task.completed ? 0.95 : 0.55,
          }}
        />

        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: theme.spacing.sm,
            paddingHorizontal: theme.spacing.md,
            paddingVertical: theme.spacing.sm + 2,
            ...(isRTL
              ? { paddingRight: theme.spacing.md + 4 }
              : { paddingLeft: theme.spacing.md + 4 }),
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
            backgroundColor: colors.surfaceSecondary,
          }}
        >
          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'center',
              gap: theme.spacing.sm,
              flex: 1,
              minWidth: 0,
            }}
          >
            <View
              style={{
                paddingHorizontal: 9,
                paddingVertical: 4,
                borderRadius: theme.radius.full,
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
                maxWidth: statusStamp ? '58%' : '78%',
              }}
            >
              <AppText
                variant="caption"
                weight="semibold"
                numberOfLines={1}
                style={{
                  color: colors.brand,
                  fontSize: 11,
                  letterSpacing: locale === 'ar' ? 0 : 0.4,
                  textTransform: locale === 'ar' ? 'none' : 'uppercase',
                }}
              >
                {hero ? t('mobile.workerHome.currentTask') : task.department}
              </AppText>
            </View>
            {statusStamp ? (
              <View
                style={{
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                  borderRadius: theme.radius.full,
                  backgroundColor: statusStamp.soft,
                  borderWidth: 1,
                  borderColor: statusStamp.ink,
                }}
              >
                <AppText
                  variant="caption"
                  weight="semibold"
                  numberOfLines={1}
                  style={{ color: statusStamp.ink, fontSize: 11 }}
                >
                  {statusStamp.label}
                </AppText>
              </View>
            ) : null}
          </View>

          {showOpenButton ? (
            <AppText variant="caption" color="brand" weight="semibold" numberOfLines={1}>
              {cta}
            </AppText>
          ) : null}
        </View>

        <View
          style={{
            paddingHorizontal: theme.spacing.md,
            marginTop: theme.spacing.sm + 2,
          }}
        >
          <View
            style={{
              aspectRatio: MEDIA_ASPECT,
              borderRadius: theme.radius.lg,
              borderWidth: 1,
              borderColor: colors.borderStrong,
              backgroundColor: colors.surfaceSecondary,
              overflow: 'hidden',
            }}
          >
          {mediaUri ? (
            <Image
              source={{ uri: mediaUri }}
              style={{ width: '100%', height: '100%' }}
              resizeMode="cover"
              accessibilityIgnoresInvertColors
            />
          ) : (
            <View
              style={{
                flex: 1,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: colors.brandSoft,
              }}
            >
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Ionicons name="cube-outline" size={20} color={colors.brand} />
              </View>
            </View>
          )}

          {/* Soft bottom fade — no hard pill cut */}
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              height: '42%',
            }}
          >
            <Svg width="100%" height="100%" style={{ position: 'absolute' }}>
              <Defs>
                <SvgGradient id="taskMediaFade" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor="#141210" stopOpacity="0" />
                  <Stop offset="0.45" stopColor="#141210" stopOpacity={fadeBottom * 0.35} />
                  <Stop offset="1" stopColor="#141210" stopOpacity={fadeBottom} />
                </SvgGradient>
              </Defs>
              <Rect x="0" y="0" width="100%" height="100%" fill="url(#taskMediaFade)" />
            </Svg>
            <View
              style={{
                flex: 1,
                justifyContent: 'flex-end',
                paddingHorizontal: theme.spacing.sm + 2,
                paddingBottom: theme.spacing.sm,
                alignItems: isRTL ? 'flex-start' : 'flex-end',
              }}
            >
              <AppText
                variant="caption"
                weight="semibold"
                dir="ltr"
                style={{
                  color: '#F7F4EF',
                  fontSize: 11,
                  letterSpacing: 0.35,
                }}
              >
                {task.orderNumber}
              </AppText>
            </View>
          </View>
          </View>
        </View>

        <View
          style={{
            paddingHorizontal: theme.spacing.md,
            paddingTop: theme.spacing.sm + 2,
            paddingBottom: theme.spacing.md,
            gap: theme.spacing.sm,
            ...(isRTL
              ? { paddingRight: theme.spacing.md + 4 }
              : { paddingLeft: theme.spacing.md + 4 }),
          }}
        >
          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'center',
              gap: theme.spacing.sm,
            }}
          >
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: late
                  ? colors.errorSoft
                  : urgent
                    ? colors.warningSoft
                    : colors.brandSoft,
                borderWidth: 1,
                borderColor: late
                  ? colors.error
                  : urgent
                    ? colors.warning
                    : colors.border,
              }}
            >
              <Ionicons
                name={
                  task.completed
                    ? 'checkmark-circle-outline'
                    : late
                      ? 'alert-circle-outline'
                      : 'construct-outline'
                }
                size={16}
                color={accent}
              />
            </View>
            <AppText
              variant="label"
              weight={titleWeight}
              numberOfLines={2}
              style={{
                flex: 1,
                textAlign: isRTL ? 'right' : 'left',
                fontSize: 15,
                lineHeight: 20,
              }}
            >
              {task.productTitle}
            </AppText>
          </View>

          <View
            style={{
              borderRadius: theme.radius.lg,
              backgroundColor: colors.surfaceSecondary,
              borderWidth: 1,
              borderColor: late ? colors.error : colors.border,
              overflow: 'hidden',
            }}
          >
            <MetaRow
              iconName="document-text-outline"
              label={t('mobile.tasks.cardOrder')}
              value={task.orderNumber}
              isRTL={isRTL}
              valueLtr
              emphasize
            />
            <Divider compact />
            <MetaRow
              iconName="layers-outline"
              label={t('mobile.tasks.cardStage')}
              value={task.department}
              isRTL={isRTL}
            />
            <Divider compact />
            <MetaRow
              iconName="time-outline"
              label={t('mobile.tasks.cardDeadline')}
              value={deadlineValue}
              isRTL={isRTL}
              danger={late}
            />
          </View>
        </View>
      </AnimatedPressable>
    </ListItemEnter>
  );
}

function MetaRow({
  iconName,
  label,
  value,
  isRTL,
  valueLtr,
  emphasize,
  danger,
}: {
  iconName: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  isRTL: boolean;
  valueLtr?: boolean;
  emphasize?: boolean;
  danger?: boolean;
}) {
  const { colors, theme } = useTheme();
  const ink = danger ? colors.error : emphasize ? colors.brand : colors.textPrimary;

  return (
    <View
      style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        gap: theme.spacing.sm,
        paddingHorizontal: theme.spacing.sm + 2,
        paddingVertical: theme.spacing.sm,
        backgroundColor: emphasize ? colors.brandSoft : 'transparent',
      }}
    >
      <View
        style={{
          width: 26,
          height: 26,
          borderRadius: 13,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: emphasize ? colors.surface : danger ? colors.errorSoft : colors.brandSoft,
          borderWidth: 1,
          borderColor: emphasize ? colors.brand : danger ? colors.error : colors.border,
        }}
      >
        <Ionicons
          name={iconName}
          size={13}
          color={danger ? colors.error : emphasize ? colors.brand : colors.textSecondary}
        />
      </View>
      <AppText
        variant="caption"
        color="muted"
        style={{
          textTransform: localeSafeTransform(isRTL),
          letterSpacing: isRTL ? 0 : 0.4,
          fontSize: 10,
          flexShrink: 0,
          maxWidth: '32%',
          textAlign: isRTL ? 'right' : 'left',
        }}
      >
        {label}
      </AppText>
      <AppText
        weight={emphasize || danger ? 'semibold' : 'medium'}
        dir={valueLtr ? 'ltr' : undefined}
        numberOfLines={1}
        style={{
          flex: 1,
          minWidth: 0,
          color: ink,
          textAlign: isRTL ? 'left' : 'right',
          fontSize: 12,
        }}
      >
        {value}
      </AppText>
    </View>
  );
}

function localeSafeTransform(isRTL: boolean): 'none' | 'uppercase' {
  return isRTL ? 'none' : 'uppercase';
}
