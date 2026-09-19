import { View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import type { PriorityLevel } from '@/components/badges/badgeStyles';
import { ProductThumb } from '@/components/desk/ProductThumb';
import { Divider } from '@/components/layout/Divider';
import { resolveOrderMediaUri } from '@/features/sales-orders/components/OrderCardMedia';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { AnimatedPressable, ListItemEnter, haptics } from '@/motion';
import { useTheme } from '@/theme';
import type { MyOrderSegment } from '../api';
import { workerSalesOrderHref, type WorkerSalesOrderCardModel } from '../selectWorkerOrder';
import { WorkerSalesOrderItemRow } from './WorkerSalesOrderItemRow';

type Props = {
  order: WorkerSalesOrderCardModel;
  segment?: MyOrderSegment;
  q?: string;
  index?: number;
  animateEnter?: boolean;
  selected?: boolean;
  onSelect?: () => void;
};

const MEDIA = 72;

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
 * Worker My Tasks sales-order board — compact identity + nested item rows.
 * Header and item rows both open the items picker (not nested pressables).
 */
export function WorkerSalesOrderCard({
  order,
  segment,
  q,
  index = 0,
  animateEnter = true,
  selected = false,
  onSelect,
}: Props) {
  const { t, formatDateTime, isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const router = useRouter();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  const urgent = order.priority === 'urgent' || order.priority === 'high';
  const blocked = order.blockedCount > 0;
  const accent = urgent || blocked ? colors.warning : colors.brand;
  const borderColor = urgent || blocked ? colors.warning : colors.borderStrong;
  const mediaUri = resolveOrderMediaUri(order.imageUrl);

  const department =
    order.itemCount > 1
      ? t('mobile.tasks.orderItemsCount', { count: order.itemCount })
      : t('mobile.tasks.openWork');

  const deadlineValue = order.deadline
    ? formatDateTime(order.deadline)
    : t('mobile.workerHome.noDeadline');

  const statusStamp = urgent
    ? {
        soft: colors.warningSoft,
        ink: colors.warning,
        label: priorityStampLabel(order.priority, t),
      }
    : blocked
      ? {
          soft: colors.warningSoft,
          ink: colors.warning,
          label: t('mobile.tasks.lockLocked'),
        }
      : null;

  const goToPicker = () => {
    if (onSelect) {
      onSelect();
      return;
    }
    router.push(workerSalesOrderHref(order, { segment, q }) as Href);
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
          borderColor: selected ? colors.brand : borderColor,
          backgroundColor: selected ? colors.brandSoft : colors.surface,
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
            opacity: urgent || blocked ? 0.95 : 0.55,
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
                  maxWidth: statusStamp ? '58%' : '78%',
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
                    weight={titleWeight}
                    numberOfLines={1}
                    style={{ color: statusStamp.ink, fontSize: 11 }}
                  >
                    {statusStamp.label}
                  </AppText>
                </View>
              ) : null}
            </View>
            <AppText variant="caption" color="brand" weight={titleWeight} numberOfLines={1}>
              {t('mobile.workerHome.openTask')}
            </AppText>
          </View>

          <View
            style={{
              padding: theme.spacing.md,
              paddingBottom: order.items.length ? theme.spacing.sm : theme.spacing.md,
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
                    iconName="layers-outline"
                    label={t('mobile.tasks.cardRemaining')}
                    value={t('mobile.tasks.orderCardTasks', { count: order.myTaskCount })}
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

        {order.items.length > 0 ? (
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
            {order.items.map((item) => (
              <WorkerSalesOrderItemRow key={item.id} item={item} onPress={goToPicker} />
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
          backgroundColor: colors.brandSoft,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <Ionicons name={iconName} size={13} color={colors.textSecondary} />
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
