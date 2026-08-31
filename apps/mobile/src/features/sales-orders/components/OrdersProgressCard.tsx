import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { DeskCard, ProductThumb } from '@/components/desk';
import { DirectionalIcon } from '@/components/DirectionalIcon';
import { alignStart, useLocale } from '@/i18n';
import { haptics } from '@/motion';
import { useTheme } from '@/theme';
import { WorkflowProgressHit } from '@/features/production-flow/components/WorkflowProgressHit';
import {
  adminLifecycleAccentKey,
  adminLifecycleHumanLabel,
  classifyAdminOrderLifecycle,
  type AdminOrderLifecycle,
} from '../adminOrderLifecycle';
import type { JourneyAttention, JourneyPrimaryCta, JourneyReadiness } from '../adminOrderJourney';
import { dealerLifecycleCardCopy } from '../dealerLifecycleCardCopy';
import { resolveOrderMediaUri } from './OrderCardMedia';

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
  kind?: 'order' | 'rfq';
  priority?: string;
  quantity?: string | number | null;
  lifecycle?: AdminOrderLifecycle;
  attention?: JourneyAttention;
  primaryCta?: JourneyPrimaryCta;
  journeyReadiness?: JourneyReadiness;
  actionHint?: string | null;
  productionReadinessSummary?: {
    canStart?: boolean;
    needsSetup?: boolean;
    actionHint?: string | null;
    materialsReady?: boolean;
    material?: { ready?: boolean; shortCount?: number } | null;
  } | null;
};

type Props = {
  order: OrdersProgressCardModel;
  variant: 'admin' | 'dealer';
  onPress: () => void;
  onProgressPress?: () => void;
  onConfirmReceipt?: () => void;
  /** Admin tray carousel vs vertical stack density. */
  layout?: 'tray' | 'stack';
};

const MEDIA = 112;

function accentColor(
  key: ReturnType<typeof adminLifecycleAccentKey>,
  colors: {
    warning: string;
    success: string;
    info: string;
    brand: string;
    textMuted: string;
  },
): string {
  switch (key) {
    case 'warning':
      return colors.warning;
    case 'success':
      return colors.success;
    case 'info':
      return colors.info;
    case 'brand':
      return colors.brand;
    default:
      return colors.textMuted;
  }
}

/**
 * Floor-list order card — soft elevation, accent strip, progress row.
 * Admin path uses commercial desk anatomy (DeskCard + ProductThumb).
 */
export function OrdersProgressCard({
  order,
  variant,
  onPress,
  onProgressPress,
  onConfirmReceipt,
  layout = 'stack',
}: Props) {
  const { t, formatCurrency, formatDate, isRTL, locale } = useLocale();
  const { colors, theme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  if (variant === 'admin') {
    return (
      <AdminCommercialCard
        order={order}
        layout={layout}
        onPress={onPress}
        t={t}
        formatDate={formatDate}
        isRTL={isRTL}
        titleWeight={titleWeight}
        colors={colors}
        theme={theme}
      />
    );
  }

  const pct = Math.max(0, Math.min(100, Math.round(order.progressPercent || 0)));
  const urgent =
    (order.priority ?? '').toUpperCase() === 'URGENT' ||
    (order.priority ?? '').toUpperCase() === 'HIGH';
  const accent = urgent ? colors.warning : colors.brand;
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

  return (
    <DeskCard
      accent={accent}
      onPress={() => {
        void haptics.selection();
        onPress();
      }}
      accessibilityLabel={`${order.number} ${order.title} ${pct}%`}
      style={{ marginBottom: theme.spacing.sm }}
    >
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          gap: theme.spacing.md,
          alignItems: 'flex-start',
        }}
      >
        <ProductThumb
          uri={resolveOrderMediaUri(order.imageUrl)}
          size={MEDIA}
          radius={theme.radius.lg}
        />
        <View
          style={{
            flex: 1,
            minWidth: 0,
            gap: 4,
            alignItems: alignStart(isRTL),
          }}
        >
          <AppText variant="label" weight={titleWeight} numberOfLines={2} style={{ width: '100%' }}>
            {order.title}
          </AppText>
          <AppText
            variant="caption"
            color="secondary"
            numberOfLines={1}
            dir={order.kind === 'rfq' ? 'auto' : 'ltr'}
            style={{ letterSpacing: 0.2 }}
          >
            {order.kind === 'rfq' ? t('mobile.orders.rfqLabel') : order.number}
          </AppText>
          {order.sellerPrice != null ? (
            <AppText variant="caption" color="muted" dir="ltr" style={{ width: '100%' }}>
              {formatCurrency(order.sellerPrice)}
            </AppText>
          ) : null}
          {lifecycleCopy?.summary ? (
            <AppText variant="caption" color="secondary" style={{ width: '100%' }}>
              {lifecycleCopy.summary}
            </AppText>
          ) : order.deliveryDate ? (
            <AppText variant="caption" color="muted" style={{ width: '100%' }}>
              {formatDate(order.deliveryDate)}
            </AppText>
          ) : null}
          {lifecycleCopy?.lifecycleStatus ? (
            <AppText variant="caption" weight="medium" style={{ color: colors.brand }}>
              {lifecycleCopy.lifecycleStatus}
            </AppText>
          ) : null}
        </View>

        <View
          style={{
            alignSelf: 'center',
            width: 22,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <DirectionalIcon>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </DirectionalIcon>
        </View>
      </View>

      {order.kind !== 'rfq' ? (
        <View
          style={{
            marginTop: theme.spacing.sm,
            paddingTop: theme.spacing.sm,
            borderTopWidth: 1,
            borderTopColor: colors.borderMuted,
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
            <AppText variant="caption" color="secondary" numberOfLines={1} style={{ flex: 1 }}>
              {order.progressLabel?.trim() || t('mobile.orders.progress')}
            </AppText>
            <AppText variant="caption" weight="semibold" style={{ color: accent }} dir="ltr">
              {`${pct}%`}
            </AppText>
          </View>
          <WorkflowProgressHit
            progressPercent={pct}
            height={5}
            accessibilityLabel={
              onProgressPress ? t('mobile.productionFlow.openWorkflow') : undefined
            }
            onPress={
              onProgressPress
                ? () => {
                    void haptics.selection();
                    onProgressPress();
                  }
                : undefined
            }
          />
          {showConfirm ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${t('lifecycle.confirmReceived')} ${order.number}`}
              onPress={() => {
                void haptics.selection();
                onConfirmReceipt?.();
              }}
              style={{
                marginTop: theme.spacing.sm,
                alignSelf: isRTL ? 'flex-end' : 'flex-start',
                paddingHorizontal: theme.spacing.md,
                paddingVertical: theme.spacing.sm,
                borderRadius: theme.radius.lg,
                backgroundColor: colors.brand,
              }}
            >
              <AppText variant="caption" weight="semibold" style={{ color: colors.onBrand }}>
                {t('lifecycle.confirmWhenReceived')}
              </AppText>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </DeskCard>
  );
}

function AdminCommercialCard({
  order,
  layout,
  onPress,
  t,
  formatDate,
  isRTL,
  titleWeight,
  colors,
  theme,
}: {
  order: OrdersProgressCardModel;
  layout: 'tray' | 'stack';
  onPress: () => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  formatDate: (value: string) => string;
  isRTL: boolean;
  titleWeight: 'medium' | 'semibold';
  colors: {
    warning: string;
    success: string;
    info: string;
    brand: string;
    textMuted: string;
    textSecondary: string;
    textPrimary: string;
    borderMuted: string;
    surfaceSecondary: string;
  };
  theme: { spacing: Record<string, number>; radius: { lg: number; md: number } };
}) {
  const isRfq = order.kind === 'rfq';
  const life =
    order.lifecycle ??
    classifyAdminOrderLifecycle({
      status: order.status,
      deliveryStatus: order.deliveryStatus,
      requiredDeliveryDate: order.deliveryDate,
      isRfq,
      productionReadinessSummary: order.productionReadinessSummary,
      progressPercent: order.progressPercent,
      currentStageLabel: order.progressLabel,
    });
  const accent = accentColor(adminLifecycleAccentKey(life), colors);
  const lifecycleLabel = adminLifecycleHumanLabel(life, t);
  const attentionReason = order.attention
    ? (() => {
        const label = t(order.attention.reasonLabelKey);
        return label === order.attention.reasonLabelKey || label.startsWith('mobile.')
          ? null
          : label;
      })()
    : null;
  const attentionAction = order.attention
    ? (() => {
        const label = t(order.attention.actionLabelKey);
        return label === order.attention.actionLabelKey || label.startsWith('mobile.')
          ? null
          : label;
      })()
    : null;
  const candidates = [
    attentionReason,
    order.actionHint?.trim(),
    order.productionReadinessSummary?.actionHint?.trim(),
    life === 'in_production' && order.progressLabel?.trim()
      ? t('mobile.orders.actionHint.inStage', { stage: order.progressLabel.trim() })
      : null,
  ].filter(Boolean) as string[];
  const actionHint =
    candidates.find((h) => h.toLowerCase() !== lifecycleLabel.toLowerCase()) ?? null;

  const readiness = order.journeyReadiness;
  const setupGaps: string[] = [];
  if (life === 'preparing') {
    const needsSetup =
      Boolean(order.productionReadinessSummary?.needsSetup) ||
      readiness?.setupReady === false ||
      readiness?.workflowReady === false;
    const materialsIncomplete =
      readiness?.materialsReady === false ||
      readiness?.hasShortage === true ||
      order.productionReadinessSummary?.materialsReady === false ||
      order.productionReadinessSummary?.material?.ready === false;
    const priceIncomplete = order.sellerPrice == null;
    if (needsSetup) setupGaps.push(t('mobile.orders.journey.setupRemaining.spec'));
    if (materialsIncomplete) {
      setupGaps.push(t('mobile.orders.journey.setupRemaining.materials'));
    }
    if (priceIncomplete) setupGaps.push(t('mobile.orders.journey.setupRemaining.price'));
  }

  const qty =
    order.quantity != null && String(order.quantity).trim() !== ''
      ? String(order.quantity)
      : null;
  const soQty = qty ? `${order.number} · ${qty}` : order.number;
  const tray = layout === 'tray';

  return (
    <DeskCard
      accent={accent}
      embedded
      onPress={() => {
        void haptics.selection();
        onPress();
      }}
      accessibilityLabel={`${order.number} ${order.title} ${lifecycleLabel}`}
      style={{ marginBottom: 0 }}
    >
      {tray ? (
        <View style={{ gap: theme.spacing.sm }}>
          <ProductThumb
            uri={resolveOrderMediaUri(order.imageUrl)}
            aspectRatio={16 / 10}
            radius={theme.radius.lg}
          />
          <View style={{ gap: 4 }}>
            {order.dealerName ? (
              <AppText variant="caption" color="muted" numberOfLines={1}>
                {order.dealerName}
              </AppText>
            ) : null}
            <AppText variant="label" weight={titleWeight} numberOfLines={2}>
              {order.title}
            </AppText>
            <AppText variant="caption" color="secondary" numberOfLines={1} dir="ltr">
              {isRfq ? `${t('mobile.orders.customerRequestLabel')} · ${order.number}` : soQty}
              {!isRfq && order.manufacturingKind
                ? ` · ${t(`mobile.orders.journey.kind.${order.manufacturingKind}`)}`
                : ''}
            </AppText>
            <View
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: theme.spacing.sm,
                marginTop: 4,
              }}
            >
              <AppText
                variant="caption"
                weight="semibold"
                numberOfLines={2}
                style={{ color: accent, flex: 1 }}
              >
                {attentionReason ?? actionHint ?? lifecycleLabel}
              </AppText>
              {order.deliveryDate ? (
                <AppText variant="caption" color="muted" numberOfLines={1}>
                  {formatDate(order.deliveryDate)}
                </AppText>
              ) : null}
            </View>
            {attentionAction ? (
              <AppText variant="caption" color="secondary" numberOfLines={1}>
                {attentionAction}
              </AppText>
            ) : null}
            {setupGaps.length > 0 ? (
              <View
                style={{
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  flexWrap: 'wrap',
                  gap: 6,
                  marginTop: 2,
                }}
              >
                {setupGaps.map((gap) => (
                  <View
                    key={gap}
                    style={{
                      paddingHorizontal: theme.spacing.sm,
                      paddingVertical: 3,
                      borderRadius: theme.radius.md,
                      backgroundColor: colors.surfaceSecondary,
                    }}
                  >
                    <AppText variant="caption" color="secondary" style={{ fontSize: 10 }}>
                      {gap}
                    </AppText>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        </View>
      ) : (
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            gap: theme.spacing.md,
            alignItems: 'center',
            minHeight: MEDIA,
          }}
        >
          <ProductThumb
            uri={resolveOrderMediaUri(order.imageUrl)}
            size={MEDIA}
            radius={theme.radius.lg}
          />
          <View
            style={{
              flex: 1,
              minWidth: 0,
              gap: 6,
              justifyContent: 'center',
              alignItems: isRTL ? 'flex-end' : 'flex-start',
            }}
          >
            {order.dealerName ? (
              <AppText variant="caption" color="muted" numberOfLines={1} style={{ width: '100%' }}>
                {order.dealerName}
              </AppText>
            ) : null}
            <AppText variant="label" weight={titleWeight} numberOfLines={2} style={{ width: '100%' }}>
              {order.title}
            </AppText>
            <AppText
              variant="caption"
              color="secondary"
              numberOfLines={1}
              dir="ltr"
              style={{ letterSpacing: 0.2, width: '100%' }}
            >
              {isRfq ? `${t('mobile.orders.customerRequestLabel')} · ${order.number}` : soQty}
            </AppText>
            <View
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: theme.spacing.sm,
                marginTop: 2,
                width: '100%',
              }}
            >
              <View
                style={{
                  paddingHorizontal: theme.spacing.sm,
                  paddingVertical: 5,
                  borderRadius: theme.radius.md,
                  backgroundColor: colors.surfaceSecondary,
                }}
              >
                <AppText variant="caption" weight="semibold" style={{ color: accent }}>
                  {attentionReason ?? lifecycleLabel}
                </AppText>
              </View>
              {order.manufacturingKind && order.kind !== 'rfq' ? (
                <View
                  style={{
                    paddingHorizontal: theme.spacing.sm,
                    paddingVertical: 5,
                    borderRadius: theme.radius.md,
                    backgroundColor: colors.surfaceSecondary,
                  }}
                >
                  <AppText variant="caption" weight="semibold" color="secondary">
                    {t(`mobile.orders.journey.kind.${order.manufacturingKind}`)}
                  </AppText>
                </View>
              ) : null}
              {order.deliveryDate ? (
                <AppText variant="caption" color="muted">
                  {formatDate(order.deliveryDate)}
                </AppText>
              ) : null}
            </View>
            {attentionAction ? (
              <AppText
                variant="caption"
                weight="semibold"
                color="brand"
                numberOfLines={1}
                style={{ width: '100%' }}
              >
                {attentionAction}
              </AppText>
            ) : actionHint && actionHint !== attentionReason ? (
              <AppText
                variant="caption"
                color="secondary"
                numberOfLines={2}
                style={{ width: '100%' }}
              >
                {actionHint}
              </AppText>
            ) : null}
            {setupGaps.length > 0 ? (
              <View
                style={{
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  flexWrap: 'wrap',
                  gap: 6,
                  width: '100%',
                }}
              >
                {setupGaps.map((gap) => (
                  <View
                    key={gap}
                    style={{
                      paddingHorizontal: theme.spacing.sm,
                      paddingVertical: 3,
                      borderRadius: theme.radius.md,
                      backgroundColor: colors.surfaceSecondary,
                    }}
                  >
                    <AppText variant="caption" color="secondary" style={{ fontSize: 10 }}>
                      {gap}
                    </AppText>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
          <Ionicons
            name={isRTL ? 'chevron-back' : 'chevron-forward'}
            size={18}
            color={colors.textMuted}
          />
        </View>
      )}
    </DeskCard>
  );
}
