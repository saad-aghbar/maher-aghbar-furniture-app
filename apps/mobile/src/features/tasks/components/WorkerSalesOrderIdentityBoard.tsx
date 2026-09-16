import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Defs, LinearGradient as SvgGradient, Rect, Stop } from 'react-native-svg';
import { AppText } from '@/components/AppText';
import { ProductThumb } from '@/components/desk/ProductThumb';
import type { PriorityLevel } from '@/components/badges/badgeStyles';
import { Divider } from '@/components/layout/Divider';
import { resolveOrderMediaUri } from '@/features/sales-orders/components/OrderCardMedia';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';

type Props = {
  orderNumber: string;
  imageUrl: string | null;
  priority: PriorityLevel;
  deadline: string | null;
  itemCount: number;
  myTaskCount: number;
  blockedCount: number;
  factoryOrderNumber?: string | null;
  /** Finished-work identity on the completed items picker. */
  completed?: boolean;
};

/** Near-square product crop — same as IndustrialFloorTaskCard. */
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
 * Non-pressable tall order identity for the items-picker header —
 * photo crop so the worker sees which order they are choosing items from.
 */
export function WorkerSalesOrderIdentityBoard({
  orderNumber,
  imageUrl,
  priority,
  deadline,
  itemCount,
  myTaskCount,
  blockedCount,
  factoryOrderNumber,
  completed = false,
}: Props) {
  const { t, formatDateTime, isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  const urgent = !completed && (priority === 'urgent' || priority === 'high');
  const blocked = !completed && blockedCount > 0;
  const mediaUri = resolveOrderMediaUri(imageUrl);
  const accent = completed
    ? colors.success
    : urgent || blocked
      ? colors.warning
      : colors.brand;
  const borderColor = completed
    ? colors.success
    : urgent || blocked
      ? colors.warning
      : colors.borderStrong;
  const fadeBottom = colorScheme === 'dark' ? 0.72 : 0.58;

  const department = completed
    ? itemCount > 1
      ? t('mobile.tasks.orderTasksCount', { count: itemCount })
      : t('mobile.tasks.finishedWork')
    : itemCount > 1
      ? t('mobile.tasks.orderItemsCount', { count: itemCount })
      : t('mobile.tasks.openWork');

  const deadlineValue = deadline
    ? formatDateTime(deadline)
    : t('mobile.workerHome.noDeadline');

  const statusStamp = completed
    ? {
        soft: colors.successSoft,
        ink: colors.success,
        label: t('mobile.tasks.segments.done'),
      }
    : urgent
      ? {
          soft: colors.warningSoft,
          ink: colors.warning,
          label: priorityStampLabel(priority, t),
        }
      : blocked
        ? {
            soft: colors.warningSoft,
            ink: colors.warning,
            label: t('mobile.tasks.lockLocked'),
          }
        : null;

  return (
    <View
      accessibilityRole="summary"
      accessibilityLabel={`${orderNumber} ${department}`}
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
            opacity: completed || urgent || blocked ? 0.95 : 0.55,
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
            overflow: 'hidden',
          }}
        >
          <ProductThumb
            uri={mediaUri}
            aspectRatio={MEDIA_ASPECT}
            width="100%"
            radius={theme.radius.lg}
          />
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
                <SvgGradient id="soIdentityMediaFade" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor="#141210" stopOpacity="0" />
                  <Stop offset="0.45" stopColor="#141210" stopOpacity={fadeBottom * 0.35} />
                  <Stop offset="1" stopColor="#141210" stopOpacity={fadeBottom} />
                </SvgGradient>
              </Defs>
              <Rect x="0" y="0" width="100%" height="100%" fill="url(#soIdentityMediaFade)" />
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
                weight={titleWeight}
                dir="ltr"
                style={{
                  color: '#F7F4EF',
                  fontSize: 11,
                  letterSpacing: 0.35,
                }}
              >
                {orderNumber}
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
            borderRadius: theme.radius.lg,
            backgroundColor: colors.surfaceSecondary,
            borderWidth: 1,
            borderColor: colors.border,
            overflow: 'hidden',
          }}
        >
          <MetaRow
            iconName="document-text-outline"
            label={t('mobile.tasks.cardOrder')}
            value={orderNumber}
            isRTL={isRTL}
            valueLtr
            emphasize
          />
          {factoryOrderNumber ? (
            <>
              <Divider compact />
              <MetaRow
                iconName="construct-outline"
                label={t('mobile.tasks.cardFactory')}
                value={factoryOrderNumber}
                isRTL={isRTL}
                valueLtr
              />
            </>
          ) : null}
          <Divider compact />
          <MetaRow
            iconName="layers-outline"
            label={
              completed ? t('mobile.tasks.segments.done') : t('mobile.tasks.cardRemaining')
            }
            value={
              completed
                ? t('mobile.tasks.orderTasksCount', { count: myTaskCount })
                : t('mobile.tasks.orderCardTasks', { count: myTaskCount })
            }
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
  );
}

function MetaRow({
  iconName,
  label,
  value,
  isRTL,
  valueLtr,
  emphasize,
}: {
  iconName: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  isRTL: boolean;
  valueLtr?: boolean;
  emphasize?: boolean;
}) {
  const { colors, theme } = useTheme();
  const ink = emphasize ? colors.brand : colors.textPrimary;

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
          backgroundColor: emphasize ? colors.surface : colors.brandSoft,
          borderWidth: 1,
          borderColor: emphasize ? colors.brand : colors.border,
        }}
      >
        <Ionicons
          name={iconName}
          size={13}
          color={emphasize ? colors.brand : colors.textSecondary}
        />
      </View>
      <AppText
        variant="caption"
        color="muted"
        style={{
          fontSize: 10,
          flexShrink: 0,
          maxWidth: '32%',
          textAlign: isRTL ? 'right' : 'left',
        }}
      >
        {label}
      </AppText>
      <AppText
        weight={emphasize ? 'semibold' : 'medium'}
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
