import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AppText } from '@/components/AppText';
import { StatusBadge } from '@/components/badges/StatusBadge';
import { useLocale } from '@/i18n';
import { AnimatedPressable, ListItemEnter, haptics } from '@/motion';
import { useTheme } from '@/theme';
import { WorkflowProgressHit } from '@/features/production-flow/components/WorkflowProgressHit';
import { adminOrderFlowHref } from '@/features/production-flow/flowRoutes';
import { humanizeOrderChip } from '../humanizeOrderChip';
import type { AdminOrderCardModel } from '../selectOrderCard';
import { OrderCardMedia } from './OrderCardMedia';
import { orderBoardShadow } from './orderFloorStyle';

type AdminOrderCardProps = {
  order: AdminOrderCardModel;
  index?: number;
  onPress?: () => void;
};

function priorityLabel(priority: string, t: (key: string) => string): string {
  const upper = priority.toUpperCase();
  const key = `mobile.production.priority.${upper}`;
  const label = t(key);
  return label === key ? priority : label;
}

export function AdminOrderCard({ order, index = 0, onPress }: AdminOrderCardProps) {
  const { t, formatCurrency, formatDate, isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const router = useRouter();

  const pct = Math.max(0, Math.min(100, Math.round(order.progressPercent || 0)));
  const urgent =
    order.priority.toUpperCase() === 'URGENT' ||
    order.priority.toUpperCase() === 'HIGH';
  const accent = urgent ? colors.warning : colors.brand;
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  return (
    <ListItemEnter index={index}>
      <AnimatedPressable
        variant="card"
        accessibilityRole="button"
        accessibilityLabel={order.number}
        onPress={() => {
          void haptics.selection();
          onPress?.();
        }}
        style={{
          borderRadius: theme.radius.xl,
          borderWidth: 1,
          borderColor: urgent ? colors.warning : colors.borderStrong,
          backgroundColor: colors.surface,
          overflow: 'hidden',
          marginBottom: theme.spacing.md,
          ...orderBoardShadow(colorScheme),
        }}
      >
        <View
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            ...(isRTL ? { right: 0 } : { left: 0 }),
            width: 3,
            backgroundColor: accent,
            opacity: urgent ? 1 : 0.5,
          }}
        />

        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            gap: theme.spacing.md,
            paddingTop: theme.spacing.md,
            paddingBottom: theme.spacing.sm,
            paddingHorizontal: theme.spacing.md,
            ...(isRTL
              ? { paddingRight: theme.spacing.md + 4 }
              : { paddingLeft: theme.spacing.md + 4 }),
            alignItems: 'flex-start',
          }}
        >
          <View style={{ width: 88, gap: theme.spacing.xs }}>
            <OrderCardMedia imageUrl={order.imageUrl} size={88} />
            {urgent ? (
              <View
                style={{
                  paddingHorizontal: 6,
                  paddingVertical: 3,
                  borderRadius: theme.radius.sm,
                  backgroundColor: colors.warningSoft,
                  alignItems: 'center',
                }}
              >
                <AppText
                  variant="caption"
                  weight="semibold"
                  numberOfLines={1}
                  style={{ color: colors.warning, fontSize: 10, lineHeight: 13 }}
                >
                  {priorityLabel(order.priority, t)}
                </AppText>
              </View>
            ) : null}
          </View>

          <View
            style={{
              flex: 1,
              minWidth: 0,
              gap: 4,
              alignItems: isRTL ? 'flex-end' : 'flex-start',
            }}
          >
            <View
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: theme.spacing.sm,
                width: '100%',
              }}
            >
              <AppText
                variant="label"
                weight={titleWeight}
                numberOfLines={2}
                style={{ flex: 1 }}
              >
                {order.title}
              </AppText>
              <StatusBadge
                status={order.status}
                label={humanizeOrderChip(locale, order.status)}
                ink="board"
                dot
              />
            </View>
            <AppText
              variant="caption"
              color="secondary"
              numberOfLines={1}
              dir="ltr"
              style={{ letterSpacing: 0.2 }}
            >
              {order.kind === 'rfq'
                ? `${t('mobile.orders.unapprovedLabel')} · ${order.number}`
                : order.number}
            </AppText>
            <AppText variant="caption" color="muted" style={{ width: '100%' }}>
              {`${t('mobile.orders.dealer')}: ${order.dealerName}`}
            </AppText>
            {order.deliveryDate ? (
              <AppText variant="caption" color="muted" style={{ width: '100%' }}>
                {formatDate(order.deliveryDate)}
              </AppText>
            ) : null}
            {order.profit != null ? (
              <AppText variant="caption" weight="semibold" style={{ width: '100%' }}>
                {`${t('mobile.orders.profit')}: ${formatCurrency(order.profit)}`}
              </AppText>
            ) : order.sellerPrice != null ? (
              <AppText variant="caption" color="muted" style={{ width: '100%' }}>
                {`${t('mobile.orders.sellerPrice')}: ${formatCurrency(order.sellerPrice)}`}
              </AppText>
            ) : null}
          </View>
        </View>

        <View
          style={{
            marginHorizontal: theme.spacing.md,
            marginBottom: theme.spacing.md,
            paddingTop: theme.spacing.sm,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: colors.border,
            gap: theme.spacing.xs,
          }}
        >
          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: theme.spacing.sm,
            }}
          >
            <AppText
              variant="caption"
              color="secondary"
              numberOfLines={1}
              style={{ flex: 1 }}
            >
              {order.progressLabel?.trim()
                ? humanizeOrderChip(locale, order.progressLabel)
                : t('mobile.orders.progress')}
            </AppText>
            <AppText
              variant="caption"
              weight="semibold"
              style={{ color: accent }}
              dir="ltr"
            >
              {`${pct}%`}
            </AppText>
          </View>
          <WorkflowProgressHit
            progressPercent={pct}
            height={5}
            accessibilityLabel={t('mobile.productionFlow.openWorkflow')}
            onPress={
              order.kind === 'rfq'
                ? undefined
                : () => {
                    void haptics.selection();
                    router.push(adminOrderFlowHref(order.id));
                  }
            }
          />
        </View>
      </AnimatedPressable>
    </ListItemEnter>
  );
}
