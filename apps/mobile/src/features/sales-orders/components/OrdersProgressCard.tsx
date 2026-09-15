import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { statusLabel as i18nStatusLabel } from '@maher/i18n';
import { AppText } from '@/components/AppText';
import { StatusBadge } from '@/components/badges/StatusBadge';
import { ProductThumb } from '@/components/desk';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';
import { WorkflowProgressHit } from '@/features/production-flow/components/WorkflowProgressHit';
import type { JourneyAttention, JourneyPrimaryCta, JourneyReadiness } from '../adminOrderJourney';
import type { AdminOrderLifecycle } from '../adminOrderLifecycle';
import { dealerLifecycleCardCopy } from '../dealerLifecycleCardCopy';
import { orderBasketDetailsHref, orderBasketItemHref } from '../orderBasketItemHref';
import type { OrderBasketItemModel } from '../selectOrderCard';
import { selectOrderStationStub } from '../selectDealerOrders';
import { OrderBasketBoard } from './OrderBasketBoard';
import { OrderStationStub } from './OrderStationStub';
import { resolveOrderMediaUri } from './OrderCardMedia';
import { orderBoardShadow } from './orderFloorStyle';

export type OrdersProgressCardModel = {
  id: string;
  number: string;
  status: string;
  deliveryStatus?: string | null;
  title: string;
  imageUrl: string | null;
  progressPercent: number | null;
  progressLabel?: string | null;
  deliveryDate: string | null;
  arrivedAt: string | null;
  dealerId?: string;
  dealerName?: string;
  sellerPrice?: number | null;
  kind?: 'order' | 'rfq' | 'returnWork';
  priority?: string;
  quantity?: string | number | null;
  lifecycle?: AdminOrderLifecycle;
  attention?: JourneyAttention;
  primaryCta?: JourneyPrimaryCta;
  journeyReadiness?: JourneyReadiness;
  actionHint?: string | null;
  manufacturingKind?: 'standard' | 'modified' | 'custom';
  items?: OrderBasketItemModel[];
  hasReturn?: boolean;
  originKind?: 'RETURN_WORK' | 'REPLACEMENT';
  originalOrderNumber?: string | null;
  primaryProductionOrderId?: string | null;
  plannedStartDate?: string | null;
  journeyLogistics?: import('@/api/modules/sales-orders').SalesOrderJourneyLogistics | null;
  productionReadinessSummary?: {
    canStart?: boolean;
    needsSetup?: boolean;
    actionHint?: string | null;
    materialsReady?: boolean;
    material?: { ready?: boolean; shortCount?: number } | null;
    assignment?: { required?: number; assigned?: number; missingCount?: number };
    primaryProductionOrderId?: string | null;
  } | null;
};

type Props = {
  order: OrdersProgressCardModel;
  variant: 'admin' | 'dealer';
  onPress: () => void;
  onProgressPress?: () => void;
  onConfirmReceipt?: () => void;
  /** Lane CTA — stage-specific action (does not replace card press → detail). */
  onPrimaryCta?: () => void;
  /** @deprecated Admin desk is always the basket board. */
  layout?: 'tray' | 'stack';
};

/**
 * Floor-list order card. Admin = commercial basket board; dealer keeps station stubs.
 */
export function OrdersProgressCard({
  order,
  variant,
  onPress,
  onProgressPress,
  onConfirmReceipt,
  onPrimaryCta,
}: Props) {
  const { t, formatDate, formatNumber, isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const router = useRouter();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  if (variant === 'admin') {
    return (
      <OrderBasketBoard
        order={order}
        onPressDetails={() => {
          if (order.kind === 'rfq' || order.kind === 'returnWork') {
            onPress();
            return;
          }
          router.push(orderBasketDetailsHref(order.id));
        }}
        onPressItem={(itemId) => {
          router.push(
            orderBasketItemHref({
              salesOrderId: order.id,
              lineId: itemId,
              lifecycle: order.lifecycle,
              itemCount: order.items?.length ?? 0,
              productionOrderId:
                order.items?.find((row) => row.id === itemId)?.productionOrderId ??
                order.primaryProductionOrderId ??
                null,
            }),
          );
        }}
        onPrimaryCta={onPrimaryCta}
      />
    );
  }

  const pct = Math.max(0, Math.min(100, Math.round(order.progressPercent || 0)));
  const stub = selectOrderStationStub(order);
  const lifecycleCopy = dealerLifecycleCardCopy(
    {
      status: order.status,
      deliveryStatus: order.deliveryStatus,
      deliveryDate: order.deliveryDate,
      deliveredAt: order.arrivedAt,
    },
    t,
    formatDate,
  );
  const showConfirm = Boolean(lifecycleCopy?.confirmCta && onConfirmReceipt);
  const accent = showConfirm ? colors.warning : colors.brand;
  const qtyLabel =
    order.quantity != null && Number.isFinite(Number(order.quantity))
      ? String(order.quantity)
      : '—';
  const amountLabel =
    order.sellerPrice != null
      ? `${formatNumber(order.sellerPrice)} ₪`
      : '—';
  const a11y = `${order.number} ${order.title} ${stub.progressLabel}`;

  return (
    <AnimatedPressable
      variant="card"
      accessibilityRole="button"
      accessibilityLabel={a11y}
      onPress={() => {
        void haptics.selection();
        onPress();
      }}
      style={{
        borderRadius: theme.radius.xl,
        borderWidth: 1,
        borderColor: colors.borderStrong,
        backgroundColor: colors.surface,
        overflow: 'hidden',
        marginBottom: theme.spacing.sm,
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
          opacity: showConfirm ? 0.9 : 0.55,
        }}
      />

      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: theme.spacing.sm,
          paddingHorizontal: theme.spacing.lg,
          paddingVertical: theme.spacing.sm + 2,
          ...(isRTL
            ? { paddingRight: theme.spacing.lg + 4 }
            : { paddingLeft: theme.spacing.lg + 4 }),
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          backgroundColor: colors.surfaceSecondary,
        }}
      >
        <StatusBadge
          status={order.status}
          label={i18nStatusLabel(locale, order.status)}
          dot
        />
        <AppText variant="caption" color="brand" weight="semibold">
          {t('common.details')}
        </AppText>
      </View>

      <View
        style={{
          padding: theme.spacing.lg,
          gap: theme.spacing.md,
          ...(isRTL
            ? { paddingRight: theme.spacing.lg + 4 }
            : { paddingLeft: theme.spacing.lg + 4 }),
        }}
      >
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'stretch',
            gap: theme.spacing.md,
          }}
        >
          <ProductThumb
            uri={resolveOrderMediaUri(order.imageUrl)}
            size={64}
            radius={theme.radius.md}
          />
          <View style={{ flex: 1, minWidth: 0, gap: 4, justifyContent: 'center' }}>
            <AppText
              weight={titleWeight}
              numberOfLines={2}
              style={{ textAlign: isRTL ? 'right' : 'left', fontSize: 16 }}
            >
              {order.title}
            </AppText>
            <AppText
              variant="caption"
              color="muted"
              dir={order.kind === 'rfq' ? 'auto' : 'ltr'}
              numberOfLines={1}
            >
              {order.kind === 'rfq' ? t('mobile.orders.rfqLabel') : order.number}
            </AppText>
          </View>
          <OrderStationStub kind={stub.kind} progressLabel={stub.progressLabel} />
        </View>

        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            gap: theme.spacing.sm,
          }}
        >
          <DealerTicketInset
            label={t('mobile.orders.qty')}
            value={qtyLabel}
            isRTL={isRTL}
            locale={locale}
            ltr
          />
          <DealerTicketInset
            label={t('mobile.orders.amount')}
            value={amountLabel}
            isRTL={isRTL}
            locale={locale}
            ltr
          />
        </View>

        {order.kind !== 'rfq' && onProgressPress ? (
          <WorkflowProgressHit
            progressPercent={pct}
            height={5}
            accessibilityLabel={t('mobile.productionFlow.openWorkflow')}
            onPress={() => {
              void haptics.selection();
              onProgressPress();
            }}
          />
        ) : null}
      </View>

      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: theme.spacing.sm,
          paddingHorizontal: theme.spacing.lg,
          paddingVertical: theme.spacing.sm + 2,
          ...(isRTL
            ? { paddingRight: theme.spacing.lg + 4 }
            : { paddingLeft: theme.spacing.lg + 4 }),
          borderTopWidth: 1,
          borderTopColor: colors.border,
          backgroundColor: showConfirm ? colors.warningSoft : colors.surfaceSecondary,
        }}
      >
        {showConfirm ? (
          <AnimatedPressable
            variant="button"
            accessibilityRole="button"
            accessibilityLabel={`${t('lifecycle.confirmReceived')} ${order.number}`}
            onPress={() => {
              void haptics.selection();
              onConfirmReceipt?.();
            }}
            style={{ flex: 1 }}
          >
            <AppText
              variant="caption"
              weight={titleWeight}
              numberOfLines={2}
              style={{
                color: colors.warning,
                textAlign: isRTL ? 'right' : 'left',
              }}
            >
              {t('lifecycle.confirmWhenReceived')}
            </AppText>
          </AnimatedPressable>
        ) : (
          <AppText
            variant="caption"
            weight={titleWeight}
            numberOfLines={2}
            style={{
              flex: 1,
              color: colors.textSecondary,
              textAlign: isRTL ? 'right' : 'left',
            }}
          >
            {lifecycleCopy?.lifecycleStatus ||
              order.progressLabel?.trim() ||
              t('mobile.orders.viewOrder')}
          </AppText>
        )}
        <View
          style={{
            width: 18,
            height: 3,
            borderRadius: 2,
            backgroundColor: showConfirm ? colors.warning : colors.brand,
          }}
        />
      </View>
    </AnimatedPressable>
  );
}

function DealerTicketInset({
  label,
  value,
  isRTL,
  locale,
  ltr,
}: {
  label: string;
  value: string;
  isRTL: boolean;
  locale: string;
  ltr?: boolean;
}) {
  const { colors, theme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  return (
    <View
      style={{
        flex: 1,
        minWidth: 0,
        gap: 4,
        padding: theme.spacing.md,
        borderRadius: theme.radius.lg,
        backgroundColor: colors.surfaceSecondary,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <AppText
        variant="caption"
        color="muted"
        style={{
          textTransform: locale === 'ar' ? 'none' : 'uppercase',
          letterSpacing: locale === 'ar' ? 0 : 0.45,
          fontSize: 10,
          textAlign: isRTL ? 'right' : 'left',
        }}
      >
        {label}
      </AppText>
      <AppText
        variant="caption"
        weight={titleWeight}
        dir={ltr ? 'ltr' : undefined}
        numberOfLines={2}
        style={{ textAlign: isRTL ? 'right' : 'left' }}
      >
        {value}
      </AppText>
    </View>
  );
}
