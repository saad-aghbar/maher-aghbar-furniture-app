import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { statusLabel as i18nStatusLabel } from '@maher/i18n';
import { AppText } from '@/components/AppText';
import { StatusBadge } from '@/components/badges/StatusBadge';
import { DeskCard, ProductThumb } from '@/components/desk';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
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
import { orderProgressChipFlags } from '../ordersReturnedLens';
import { selectOrderStationStub } from '../selectDealerOrders';
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
  const { t, formatDate, formatDateTime, formatNumber, isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
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

function KindChip({
  label,
  colors,
  theme,
}: {
  label: string;
  colors: { brand: string; brandSoft?: string; surfaceSecondary: string };
  theme: { spacing: Record<string, number>; radius: { md: number } };
}) {
  return (
    <View
      style={{
        paddingHorizontal: theme.spacing.sm,
        paddingVertical: 3,
        borderRadius: theme.radius.md,
        backgroundColor: colors.brandSoft ?? colors.surfaceSecondary,
        borderWidth: 1,
        borderColor: colors.brand,
      }}
    >
      <AppText
        variant="caption"
        weight="semibold"
        numberOfLines={1}
        style={{
          color: colors.brand,
          fontSize: 10,
          lineHeight: 12,
          textTransform: 'uppercase',
        }}
      >
        {label}
      </AppText>
    </View>
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
  const chips = orderProgressChipFlags(order);
  const kindLabel = chips.manufacturingKind
    ? t(`mobile.orders.journey.kind.${chips.manufacturingKind}`)
    : null;
  const kindKey = kindLabel && kindLabel !== `mobile.orders.journey.kind.${chips.manufacturingKind}`
    ? kindLabel
    : null;
  const originLabel =
    chips.originKind === 'REPLACEMENT'
      ? t('mobile.production.origin.replacement')
      : chips.originKind === 'RETURN_WORK'
        ? t('mobile.production.origin.returnWork')
        : null;
  const showReturned = chips.returned;

  return (
    <View style={{ gap: compact ? 4 : 6, width: '100%' }}>
      {order.dealerName ? (
        <AppText variant="caption" color="muted" numberOfLines={1} style={{ width: '100%' }}>
          {order.dealerName}
        </AppText>
      ) : null}
      {kindKey || showReturned || originLabel ? (
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            flexWrap: 'wrap',
            gap: 6,
            width: '100%',
          }}
        >
          {originLabel ? <KindChip label={originLabel} colors={colors} theme={theme} /> : null}
          {kindKey ? <KindChip label={kindKey} colors={colors} theme={theme} /> : null}
          {showReturned ? (
            <KindChip
              label={t('mobile.orders.journey.kind.returned')}
              colors={colors}
              theme={theme}
            />
          ) : null}
        </View>
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
