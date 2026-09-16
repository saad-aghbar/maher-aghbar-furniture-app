import { View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { ProductThumb } from '@/components/desk/ProductThumb';
import { Divider } from '@/components/layout/Divider';
import { resolveOrderMediaUri } from '@/features/sales-orders/components/OrderCardMedia';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { AnimatedPressable, ListItemEnter, haptics } from '@/motion';
import { useTheme } from '@/theme';
import {
  workerCompletedSalesOrderHref,
  type CompletedSalesOrderCardModel,
} from '../selectTask';
import { WorkerCompletedTaskRow } from './WorkerCompletedTaskRow';

type Props = {
  order: CompletedSalesOrderCardModel;
  q?: string;
  index?: number;
  animateEnter?: boolean;
};

const MEDIA = 72;

/**
 * Completed tab sales-order board — compact identity + nested finished task rows.
 * Header and rows open the completed items picker (tall photo identity).
 */
export function WorkerCompletedSalesOrderCard({
  order,
  q,
  index = 0,
  animateEnter = true,
}: Props) {
  const { t, formatDateTime, isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const router = useRouter();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const mediaUri = resolveOrderMediaUri(order.imageUrl);
  const accent = colors.success;
  const borderColor = colors.success;

  const department =
    order.taskCount > 1
      ? t('mobile.tasks.orderTasksCount', { count: order.taskCount })
      : t('mobile.tasks.finishedWork');

  const deadlineValue = order.deadline
    ? formatDateTime(order.deadline)
    : t('mobile.workerHome.noDeadline');

  const goToPicker = () => {
    router.push(workerCompletedSalesOrderHref(order, { q }) as Href);
  };

  const openPicker = () => {
    void haptics.selection();
    goToPicker();
  };

  return (
    <ListItemEnter index={index} enabled={animateEnter}>
      <View
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
            opacity: 0.95,
          }}
        />

        <AnimatedPressable
          variant="card"
          accessibilityRole="button"
          accessibilityLabel={`${order.number} ${department}`}
          onPress={openPicker}
        >
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
                  maxWidth: '58%',
                }}
              >
                <AppText
                  variant="caption"
                  weight={titleWeight}
                  numberOfLines={1}
                  style={{
                    color: colors.brand,
                    fontSize: 11,
                    letterSpacing: locale === 'ar' ? 0 : 0.4,
                    textTransform: locale === 'ar' ? 'none' : 'uppercase',
                  }}
                >
                  {department}
                </AppText>
              </View>
              <View
                style={{
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                  borderRadius: theme.radius.full,
                  backgroundColor: colors.successSoft,
                  borderWidth: 1,
                  borderColor: colors.success,
                }}
              >
                <AppText
                  variant="caption"
                  weight={titleWeight}
                  numberOfLines={1}
                  style={{ color: colors.success, fontSize: 11 }}
                >
                  {t('mobile.tasks.segments.done')}
                </AppText>
              </View>
            </View>
            <AppText variant="caption" color="brand" weight={titleWeight} numberOfLines={1}>
              {t('mobile.workerHome.viewTask')}
            </AppText>
          </View>

          <View
            style={{
              padding: theme.spacing.md,
              paddingBottom: order.tasks.length ? theme.spacing.sm : theme.spacing.md,
              ...(isRTL
                ? { paddingRight: theme.spacing.md + 4 }
                : { paddingLeft: theme.spacing.md + 4 }),
            }}
          >
            <View
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                gap: theme.spacing.md,
                alignItems: 'flex-start',
              }}
            >
              <ProductThumb uri={mediaUri} size={MEDIA} radius={theme.radius.lg} />
              <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                <AppText
                  variant="label"
                  weight={titleWeight}
                  dir="ltr"
                  numberOfLines={1}
                  style={{ textAlign: isRTL ? 'right' : 'left', fontSize: 17 }}
                >
                  {order.number}
                </AppText>
                <View
                  style={{
                    borderRadius: theme.radius.lg,
                    backgroundColor: colors.surfaceSecondary,
                    borderWidth: 1,
                    borderColor: colors.border,
                    overflow: 'hidden',
                  }}
                >
                  <MetaRow
                    iconName="checkmark-circle-outline"
                    label={t('mobile.tasks.segments.done')}
                    value={t('mobile.tasks.orderTasksCount', { count: order.taskCount })}
                    isRTL={isRTL}
                  />
                  <Divider compact />
                  <MetaRow
                    iconName="time-outline"
                    label={t('mobile.tasks.cardDeadline')}
                    value={deadlineValue}
                    isRTL={isRTL}
                  />
                </View>
              </View>
            </View>
          </View>
        </AnimatedPressable>

        {order.tasks.length > 0 ? (
          <View
            style={{
              paddingHorizontal: theme.spacing.md,
              paddingBottom: theme.spacing.md,
              gap: theme.spacing.xs,
              ...(isRTL
                ? { paddingRight: theme.spacing.md + 4 }
                : { paddingLeft: theme.spacing.md + 4 }),
            }}
          >
            {order.tasks.map((task) => (
              <WorkerCompletedTaskRow key={task.id} task={task} onPress={goToPicker} />
            ))}
          </View>
        ) : null}
      </View>
    </ListItemEnter>
  );
}

function MetaRow({
  iconName,
  label,
  value,
  isRTL,
}: {
  iconName: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  isRTL: boolean;
}) {
  const { colors, theme } = useTheme();

  return (
    <View
      style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        gap: theme.spacing.sm,
        paddingHorizontal: theme.spacing.sm + 2,
        paddingVertical: theme.spacing.sm,
      }}
    >
      <View
        style={{
          width: 26,
          height: 26,
          borderRadius: 13,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.successSoft,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <Ionicons name={iconName} size={13} color={colors.success} />
      </View>
      <AppText
        variant="caption"
        color="muted"
        style={{
          fontSize: 10,
          flexShrink: 0,
          maxWidth: '36%',
          textAlign: isRTL ? 'right' : 'left',
        }}
      >
        {label}
      </AppText>
      <AppText
        weight="medium"
        numberOfLines={1}
        style={{
          flex: 1,
          minWidth: 0,
          color: colors.textPrimary,
          textAlign: isRTL ? 'left' : 'right',
          fontSize: 12,
        }}
      >
        {value}
      </AppText>
    </View>
  );
}
