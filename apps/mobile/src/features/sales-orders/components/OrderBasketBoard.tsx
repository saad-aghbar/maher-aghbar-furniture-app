import { View } from 'react-native';
import { AppText } from '@/components/AppText';
import { StatusBadge } from '@/components/badges/StatusBadge';
import { Divider } from '@/components/layout/Divider';
import { WorkflowProgressHit } from '@/features/production-flow/components/WorkflowProgressHit';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';
import {
  adminLifecycleHumanLabel,
  classifyAdminOrderLifecycle,
} from '../adminOrderLifecycle';
import { buildLaneCardPresentation } from '../laneOrderCard';
import type { OrderBasketBoardOrder } from '../selectOrderCard';
import { orderBoardShadow } from './orderFloorStyle';
import { OrderBasketItemRow } from './OrderBasketItemRow';

type Props = {
  order: OrderBasketBoardOrder;
  onPressDetails: () => void;
  onPressItem: (itemId: string) => void;
  onPrimaryCta?: () => void;
};

/**
 * One commercial sales-order board — same parchment recipe as production baskets.
 */
export function OrderBasketBoard({
  order,
  onPressDetails,
  onPressItem,
  onPrimaryCta,
}: Props) {
  const { t, isRTL, locale, formatDate, formatDateTime } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
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
  const attention = Boolean(order.attention);
  const accent = attention ? colors.warning : colors.brand;
  const dealer = order.dealerName && order.dealerName !== '—' ? order.dealerName : null;
  const items = isRfq ? [] : (order.items ?? []);
  const itemCount = items.length || Number(order.quantity) || 0;
  const doneCount = items.filter((row) => row.done).length;
  const showDoneOf =
    (life === 'in_production' ||
      life === 'ready_to_ship' ||
      life === 'shipped' ||
      life === 'delivered') &&
    items.some((row) => row.productionOrderId);
  const pct =
    order.progressPercent != null && Number.isFinite(Number(order.progressPercent))
      ? Math.max(0, Math.min(100, Math.round(Number(order.progressPercent))))
      : null;
  const showProgress =
    pct != null &&
    (life === 'in_production' ||
      life === 'ready_to_ship' ||
      life === 'shipped' ||
      life === 'delivered' ||
      pct > 0);

  const logistics = order.journeyLogistics;
  const presentation = buildLaneCardPresentation(
    {
      lifecycle: life,
      number: order.number,
      dealerName: dealer,
      deliveryDateLabel: order.deliveryDate ? formatDate(order.deliveryDate) : null,
      plannedStartLabel: order.plannedStartDate
        ? formatDate(order.plannedStartDate)
        : null,
      progressPercent: order.progressPercent,
      progressLabel: order.progressLabel,
      attention: order.attention,
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
      packagesLoaded: logistics?.packagesLoaded ?? null,
      packagesTotal: logistics?.packagesTotal ?? null,
      loadStatus: logistics?.loadStatus ?? null,
      missingPackageIndex: logistics?.firstMissingPackageIndex ?? null,
      packageCountLabel:
        logistics?.packageCount != null && logistics.packageCount > 0
          ? t('mobile.orders.packageCount', { count: logistics.packageCount })
          : null,
      finReadyLabel:
        logistics?.finReady === true
          ? t('mobile.orders.finReady')
          : logistics?.finReady === false
            ? t('mobile.orders.finNotReady')
            : null,
      warehouseLabel: logistics?.finishedWarehouseName ?? null,
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

  const laneFact = presentation.facts.find((f) => f.key !== 'dealer') ?? null;
  const ctaLabel = presentation.ctaLabelKey
    ? (() => {
        const label = t(presentation.ctaLabelKey);
        return label.startsWith('mobile.') ? null : label;
      })()
    : null;
  const laneLabel = adminLifecycleHumanLabel(life, t);
  const footerCount =
    itemCount === 1
      ? t('mobile.orders.journey.itemsCountOne', { count: 1 })
      : t('mobile.orders.journey.itemsCount', { count: itemCount });

  return (
    <View
      style={{
        borderRadius: theme.radius.xl,
        borderWidth: 1,
        borderColor: attention ? colors.warning : colors.borderStrong,
        backgroundColor: colors.surface,
        overflow: 'hidden',
        ...orderBoardShadow(colorScheme),
      }}
    >
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          width: 3,
          backgroundColor: accent,
          opacity: attention ? 0.9 : 0.55,
          ...(isRTL ? { right: 0 } : { left: 0 }),
        }}
      />

      <AnimatedPressable
        variant="card"
        accessibilityRole="button"
        accessibilityLabel={`${order.number} ${t('common.details')}`}
        onPress={() => {
          void haptics.selection();
          onPressDetails();
        }}
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: theme.spacing.sm,
          paddingHorizontal: theme.spacing.lg,
          paddingVertical: theme.spacing.md,
          ...(isRTL
            ? { paddingRight: theme.spacing.lg + 4 }
            : { paddingLeft: theme.spacing.lg + 4 }),
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          backgroundColor: colors.surfaceSecondary,
        }}
      >
        <View
          style={{
            flex: 1,
            minWidth: 0,
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            gap: theme.spacing.sm,
            flexWrap: 'wrap',
          }}
        >
          <AppText
            variant="label"
            weight={titleWeight}
            dir="ltr"
            numberOfLines={1}
            style={{ textAlign: isRTL ? 'right' : 'left', fontSize: 16 }}
          >
            {order.number}
          </AppText>
          {dealer ? (
            <AppText
              variant="caption"
              color="secondary"
              numberOfLines={1}
              style={{ flexShrink: 1, textAlign: isRTL ? 'right' : 'left' }}
            >
              {dealer}
            </AppText>
          ) : null}
          <StatusBadge status={life} dot label={laneLabel} />
        </View>
        <AppText variant="caption" color="brand" weight={titleWeight}>
          {t('common.details')}
        </AppText>
      </AnimatedPressable>

      <View
        style={{
          padding: theme.spacing.lg,
          gap: theme.spacing.md,
          ...(isRTL
            ? { paddingRight: theme.spacing.lg + 4 }
            : { paddingLeft: theme.spacing.lg + 4 }),
        }}
      >
        {dealer || laneFact ? (
          <View
            style={{
              borderRadius: theme.radius.lg,
              backgroundColor: colors.surfaceSecondary,
              borderWidth: 1,
              borderColor: colors.border,
              overflow: 'hidden',
            }}
          >
            {dealer ? (
              <MetaRow label={t('mobile.orders.dealer')} value={dealer} isRTL={isRTL} />
            ) : null}
            {laneFact ? (
              <>
                {dealer ? <Divider compact plain style={{ marginVertical: 0 }} /> : null}
                <MetaRow
                  label={
                    laneFact.labelKey ? t(laneFact.labelKey) : presentation.statusLine
                  }
                  value={laneFact.value}
                  isRTL={isRTL}
                  tone={laneFact.tone === 'warning' ? 'warning' : undefined}
                />
              </>
            ) : null}
          </View>
        ) : null}

        {items.length ? (
          <View style={{ gap: theme.spacing.xs }}>
            {items.map((row) => (
              <OrderBasketItemRow
                key={row.id}
                item={row}
                onPress={() => onPressItem(row.id)}
              />
            ))}
          </View>
        ) : null}

        <View style={{ gap: theme.spacing.xs }}>
          {itemCount > 0 ? (
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
                color="muted"
                style={{
                  flex: 1,
                  textAlign: isRTL ? 'right' : 'left',
                  fontSize: 10,
                  letterSpacing: locale === 'en' ? 0.45 : 0,
                  textTransform: locale === 'en' ? 'uppercase' : 'none',
                }}
              >
                {showDoneOf
                  ? t('mobile.production.basketItemsOf', {
                      done: doneCount,
                      n: itemCount,
                    })
                  : footerCount}
              </AppText>
              {showProgress && pct != null ? (
                <AppText
                  weight={titleWeight}
                  dir="ltr"
                  style={{ color: accent, fontSize: 15 }}
                >
                  {`${pct}%`}
                </AppText>
              ) : null}
            </View>
          ) : null}
          {showProgress && pct != null ? (
            <WorkflowProgressHit
              progressPercent={pct}
              height={5}
              accessibilityLabel={t('mobile.orders.progress')}
            />
          ) : null}
        </View>

        {ctaLabel && onPrimaryCta ? (
          <AnimatedPressable
            variant="button"
            accessibilityRole="button"
            accessibilityLabel={ctaLabel}
            onPress={() => {
              void haptics.selection();
              onPrimaryCta();
            }}
            style={{
              minHeight: 44,
              borderRadius: theme.radius.xl,
              borderWidth: 1,
              borderColor: colors.brand,
              backgroundColor: colors.brandSoft,
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: theme.spacing.lg,
            }}
          >
            <AppText variant="caption" weight={titleWeight} style={{ color: colors.brand }}>
              {ctaLabel}
            </AppText>
          </AnimatedPressable>
        ) : null}
      </View>
    </View>
  );
}

function MetaRow({
  label,
  value,
  isRTL,
  tone,
}: {
  label: string;
  value: string;
  isRTL: boolean;
  tone?: 'warning';
}) {
  const { colors, theme } = useTheme();
  const { locale } = useLocale();

  return (
    <View
      style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: theme.spacing.md,
        paddingHorizontal: theme.spacing.md,
        paddingVertical: theme.spacing.sm + 2,
      }}
    >
      <AppText
        variant="caption"
        color="muted"
        style={{
          textTransform: locale === 'en' ? 'uppercase' : 'none',
          letterSpacing: locale === 'en' ? 0.5 : 0,
          fontSize: 10,
          flexShrink: 0,
          textAlign: isRTL ? 'right' : 'left',
        }}
      >
        {label}
      </AppText>
      <AppText
        weight="semibold"
        numberOfLines={1}
        style={{
          flex: 1,
          minWidth: 0,
          color: tone === 'warning' ? colors.warning : colors.textPrimary,
          textAlign: isRTL ? 'left' : 'right',
        }}
      >
        {value}
      </AppText>
    </View>
  );
}
