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
  classifyAdminOrderLifecycle,
  type AdminOrderLifecycle,
} from '../adminOrderLifecycle';
import type { JourneyAttention, JourneyPrimaryCta, JourneyReadiness } from '../adminOrderJourney';
import { buildLaneCardPresentation } from '../laneOrderCard';
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
  manufacturingKind?: 'standard' | 'modified' | 'custom';
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
  onPrimaryCta,
  layout = 'stack',
}: Props) {
  const { t, formatCurrency, formatDate, formatDateTime, isRTL, locale } = useLocale();
  const { colors, theme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  if (variant === 'admin') {
    return (
      <AdminCommercialCard
        order={order}
        layout={layout}
        onPress={onPress}
        onPrimaryCta={onPrimaryCta}
        t={t}
        formatDate={formatDate}
        formatDateTime={formatDateTime}
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
  onPrimaryCta,
  t,
  formatDate,
  formatDateTime,
  isRTL,
  titleWeight,
  colors,
  theme,
}: {
  order: OrdersProgressCardModel;
  layout: 'tray' | 'stack';
  onPress: () => void;
  onPrimaryCta?: () => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  formatDate: (value: string) => string;
  formatDateTime: (value: string) => string;
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
    onBrand: string;
  };
  theme: { spacing: Record<string, number>; radius: { lg: number; md: number; xl: number } };
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

  const logistics = order.journeyLogistics;
  const packageCount =
    logistics?.packageCount != null && logistics.packageCount > 0
      ? logistics.packageCount
      : null;
  const packageCountLabel =
    packageCount != null
      ? logistics?.packagesLoaded != null && logistics?.packagesTotal != null
        ? t('mobile.orders.packagesLoadedOf', {
            loaded: logistics.packagesLoaded,
            total: logistics.packagesTotal,
          })
        : t('mobile.orders.packageCount', { count: packageCount })
      : null;
  const loadProgressLabel = (() => {
    const raw = logistics?.loadStatus;
    if (!raw) return null;
    const s =
      raw === 'partial' ? 'loading' : raw === 'complete' ? 'fully_loaded' : raw;
    const key = `mobile.orders.loadStatus.${s}`;
    const label = t(key);
    return label.startsWith('mobile.') ? null : label;
  })();
  const finReadyLabel =
    logistics?.finReady === true
      ? t('mobile.orders.finReady')
      : logistics?.finReady === false
        ? t('mobile.orders.finNotReady')
        : null;
  const committedFromLogistics = logistics?.committedDeliveryDate
    ? formatDate(logistics.committedDeliveryDate)
    : null;

  const presentation = buildLaneCardPresentation(
    {
      lifecycle: life,
      number: order.number,
      dealerName: order.dealerName,
      deliveryDateLabel:
        committedFromLogistics ??
        (order.deliveryDate ? formatDate(order.deliveryDate) : null),
      plannedStartLabel: order.plannedStartDate
        ? formatDate(order.plannedStartDate)
        : null,
      progressPercent: order.progressPercent,
      progressLabel: order.progressLabel,
      attention: order.attention,
      attentionReasonLabel: attentionReason,
      attentionActionLabel: attentionAction,
      actionHint: order.actionHint,
      readiness: order.journeyReadiness,
      assignment: order.productionReadinessSummary?.assignment ?? null,
      materialsReady:
        order.productionReadinessSummary?.materialsReady ??
        order.productionReadinessSummary?.material?.ready ??
        null,
      needsSetup: order.productionReadinessSummary?.needsSetup ?? null,
      sellerPriceMissing: order.sellerPrice == null && !isRfq,
      primaryCta: order.primaryCta,
      packageCountLabel,
      finReadyLabel,
      warehouseLabel: logistics?.finishedWarehouseName ?? null,
      loadProgressLabel,
      loadStatus: logistics?.loadStatus ?? null,
      missingPackageIndex: logistics?.firstMissingPackageIndex ?? null,
      packagesLoaded: logistics?.packagesLoaded ?? null,
      packagesTotal: logistics?.packagesTotal ?? null,
      deliveryNumberLabel: logistics?.deliveryNumber ?? null,
      departedLabel: logistics?.truckDepartedAt
        ? formatDateTime(logistics.truckDepartedAt)
        : null,
      confirmedLabel: logistics?.dealerConfirmedAt
        ? formatDateTime(logistics.dealerConfirmedAt)
        : logistics?.actualDeliveredAt
          ? formatDateTime(logistics.actualDeliveredAt)
          : null,
    },
    t,
  );

  const ctaLabel = presentation.ctaLabelKey
    ? (() => {
        const label = t(presentation.ctaLabelKey);
        return label.startsWith('mobile.') ? null : label;
      })()
    : null;

  const qty =
    order.quantity != null && String(order.quantity).trim() !== ''
      ? String(order.quantity)
      : null;
  const soQty = qty ? `${order.number} · ${qty}` : order.number;
  const tray = layout === 'tray';

  const metaFacts = presentation.facts.filter((f) => f.key !== 'dealer');
  const showAttention = Boolean(presentation.attentionBlock);

  return (
    <DeskCard
      accent={showAttention ? colors.warning : accent}
      embedded
      onPress={() => {
        void haptics.selection();
        onPress();
      }}
      accessibilityLabel={`${order.number} ${order.title} ${presentation.statusLine}`}
      style={{ marginBottom: 0 }}
    >
      {tray ? (
        <View style={{ gap: theme.spacing.sm }}>
          <ProductThumb
            uri={resolveOrderMediaUri(order.imageUrl)}
            aspectRatio={16 / 10}
            radius={theme.radius.lg}
          />
          <LaneCardBody
            order={order}
            isRfq={isRfq}
            soQty={soQty}
            presentation={presentation}
            metaFacts={metaFacts}
            ctaLabel={ctaLabel}
            onPrimaryCta={onPrimaryCta}
            accent={showAttention ? colors.warning : accent}
            titleWeight={titleWeight}
            isRTL={isRTL}
            colors={colors}
            theme={theme}
            t={t}
            compact
          />
        </View>
      ) : (
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            gap: theme.spacing.md,
            alignItems: 'flex-start',
            minHeight: MEDIA,
          }}
        >
          <ProductThumb
            uri={resolveOrderMediaUri(order.imageUrl)}
            size={MEDIA}
            radius={theme.radius.lg}
          />
          <View style={{ flex: 1, minWidth: 0 }}>
            <LaneCardBody
              order={order}
              isRfq={isRfq}
              soQty={soQty}
              presentation={presentation}
              metaFacts={metaFacts}
              ctaLabel={ctaLabel}
              onPrimaryCta={onPrimaryCta}
              accent={showAttention ? colors.warning : accent}
              titleWeight={titleWeight}
              isRTL={isRTL}
              colors={colors}
              theme={theme}
              t={t}
              compact={false}
            />
          </View>
          <Ionicons
            name={isRTL ? 'chevron-back' : 'chevron-forward'}
            size={18}
            color={colors.textMuted}
            style={{ marginTop: theme.spacing.md }}
          />
        </View>
      )}
    </DeskCard>
  );
}

function LaneCardBody({
  order,
  isRfq,
  soQty,
  presentation,
  metaFacts,
  ctaLabel,
  onPrimaryCta,
  accent,
  titleWeight,
  isRTL,
  colors,
  theme,
  t,
  compact,
}: {
  order: OrdersProgressCardModel;
  isRfq: boolean;
  soQty: string;
  presentation: ReturnType<typeof buildLaneCardPresentation>;
  metaFacts: ReturnType<typeof buildLaneCardPresentation>['facts'];
  ctaLabel: string | null;
  onPrimaryCta?: () => void;
  accent: string;
  titleWeight: 'medium' | 'semibold';
  isRTL: boolean;
  colors: {
    brand: string;
    onBrand: string;
    surfaceSecondary: string;
    warning: string;
  };
  theme: { spacing: Record<string, number>; radius: { lg: number; md: number } };
  t: (key: string, params?: Record<string, string | number>) => string;
  compact: boolean;
}) {
  const { locale } = useLocale();
  const kindLabel = order.manufacturingKind
    ? t(`mobile.orders.journey.kind.${order.manufacturingKind}`)
    : null;
  const kindKey = kindLabel && kindLabel !== `mobile.orders.journey.kind.${order.manufacturingKind}`
    ? kindLabel
    : null;

  return (
    <View style={{ gap: compact ? 4 : 6, width: '100%' }}>
      {order.dealerName ? (
        <AppText variant="caption" color="muted" numberOfLines={1} style={{ width: '100%' }}>
          {order.dealerName}
        </AppText>
      ) : null}
      {kindKey ? (
        <AppText
          variant="caption"
          weight={titleWeight}
          color="brand"
          numberOfLines={1}
          style={{
            width: '100%',
            fontSize: 10,
            lineHeight: 12,
            letterSpacing: locale === 'ar' ? 0 : 0.5,
            textTransform: locale === 'ar' ? 'none' : 'uppercase',
          }}
        >
          {kindKey}
        </AppText>
      ) : null}
      <AppText
        variant="label"
        weight={titleWeight}
        numberOfLines={compact ? 2 : 2}
        style={{ width: '100%' }}
      >
        {order.title}
      </AppText>
      {isRfq && order.manufacturingKind === 'modified' ? (
        <AppText variant="caption" color="muted" numberOfLines={1} style={{ width: '100%' }}>
          {t('mobile.orders.journey.kind.basedOnCatalog')}
        </AppText>
      ) : null}
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
            {presentation.statusLine}
          </AppText>
        </View>
      </View>

      {presentation.attentionBlock ? (
        <View
          style={{
            gap: 4,
            width: '100%',
            padding: theme.spacing.sm,
            borderRadius: theme.radius.lg,
            backgroundColor: colors.surfaceSecondary,
          }}
        >
          <AppText variant="caption" weight={titleWeight} color="warning">
            {t('mobile.orders.attentionWhat')}: {presentation.attentionBlock.what}
          </AppText>
          <AppText variant="caption" color="secondary" numberOfLines={2}>
            {t('mobile.orders.attentionWhy')}: {presentation.attentionBlock.why}
          </AppText>
          <AppText variant="caption" weight="semibold" color="brand" numberOfLines={1}>
            {t('mobile.orders.attentionNext')}: {presentation.attentionBlock.whatNext}
          </AppText>
        </View>
      ) : null}

      {metaFacts.map((fact) => (
        <AppText
          key={fact.key}
          variant="caption"
          color={
            fact.tone === 'warning'
              ? 'warning'
              : fact.tone === 'brand'
                ? 'brand'
                : fact.tone === 'muted'
                  ? 'muted'
                  : 'secondary'
          }
          numberOfLines={2}
          style={{ width: '100%' }}
        >
          {fact.labelKey ? `${t(fact.labelKey)} · ${fact.value}` : fact.value}
        </AppText>
      ))}

      {presentation.blockers.length > 0 && !presentation.attentionBlock ? (
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            flexWrap: 'wrap',
            gap: 6,
            width: '100%',
          }}
        >
          {presentation.blockers.slice(0, 3).map((gap) => (
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

      {ctaLabel && onPrimaryCta ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={ctaLabel}
          onPress={() => {
            void haptics.selection();
            onPrimaryCta();
          }}
          style={{
            marginTop: 4,
            alignSelf: isRTL ? 'flex-end' : 'flex-start',
            paddingHorizontal: theme.spacing.md,
            paddingVertical: theme.spacing.sm,
            borderRadius: theme.radius.lg,
            backgroundColor: colors.brand,
            minHeight: 36,
            justifyContent: 'center',
          }}
        >
          <AppText variant="caption" weight="semibold" style={{ color: colors.onBrand }}>
            {ctaLabel}
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}
