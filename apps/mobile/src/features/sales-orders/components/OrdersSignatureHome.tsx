import { useMemo, useState, type ReactNode } from 'react';
import {
  LayoutAnimation,
  Platform,
  RefreshControl,
  ScrollView,
  SectionList,
  UIManager,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { mapConfirmReceiptErrorCode } from '@maher/types';
import { confirmDeliveryReceipt } from '@/api/modules/deliveries';
import { getSalesOrder } from '@/api/modules/sales-orders';
import { isApiError } from '@/api/errors';
import { queryKeys } from '@/api/queryKeys';
import { AppText } from '@/components/AppText';
import { EmptyState } from '@/components/feedback/EmptyState';
import { useToast } from '@/components/feedback/Toast';
import { DealerEmptyState, DealerSearchBar } from '@/features/dealer-ui';
import { DealerEmptyPanel } from '@/features/dealers/components/DealerEmptyPanel';
import { useLocale } from '@/i18n';
import { haptics, ListItemEnter, useReducedMotion } from '@/motion';
import { durations, withMotionDuration } from '@/motion/presets';
import { useTheme } from '@/theme';
import { SURFACE_TAB_BAR_CLEARANCE } from '@/navigation/tabBarClearance';
import {
  adminOrderFlowHref,
  dealerOrderFlowHref,
} from '@/features/production-flow/flowRoutes';
import { DealerQuotationsEntry } from '@/features/quotations/DealerQuotationsEntry';
import {
  groupOrdersFloorBoard,
  type FloorBoardSectionKey,
} from '../groupOrdersByDay';
import {
  countDealerOrderStamps,
  matchesDealerOrderTile,
  matchesDealerOrdersRail,
  railStopsForTile,
  type DealerOrderTileKey,
  type DealerOrdersRailKey,
} from '../selectDealerOrders';
import {
  countOrderStages,
  type OrdersStageFocus,
} from '../stageCounts';
import {
  adminLifecycleHumanLabel,
  adminLifecyclePhaseHint,
  classifyAdminOrderLifecycle,
  type AdminOrderLifecycle,
} from '../adminOrderLifecycle';
import type { AdminOrderCardModel, DealerOrderCardModel, OrdersListVariant } from '../selectOrderCard';
import {
  AdminLifecycleChips,
  ADMIN_LIFECYCLE_SECTION_ORDER,
  type AdminLifecycleChipKey,
} from './AdminLifecycleChips';
import { AdminLifecycleTray } from './AdminLifecycleTray';
import {
  AdminOrdersDeskSwitch,
  type AdminOrdersDeskMode,
} from './AdminOrdersDeskSwitch';
import { ConfirmReceiptSheet } from './ConfirmReceiptSheet';
import { DealerOrdersHubBoard } from './DealerOrdersHubBoard';
import { DealerOrdersRail } from './DealerOrdersRail';
import { OrdersCompositionChrome } from './OrdersCompositionChrome';
import { OrdersDaySectionHeader } from './OrdersDaySectionHeader';
import { OrdersDealerBar } from './OrdersDealerBar';
import { OrdersFilterButton } from './OrdersFilterButton';
import { orderBoardShadow } from './orderFloorStyle';
import { type StatusChipKey } from './OrdersFilterChips';
import { OrdersListSkeleton } from './OrdersListSkeleton';
import { OrdersProgressCard, type OrdersProgressCardModel } from './OrdersProgressCard';
import {
  OrdersRfqInboxChips,
  type RfqInboxSubchip,
} from './OrdersRfqInboxChips';
import { OrdersStageSpine } from './OrdersStageSpine';
import {
  OrderTypeLensBar,
  type OrderTypeCounts,
  type OrderTypeFocus,
} from './OrderTypeLensBar';

if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type Props = {
  variant: OrdersListVariant;
  adminItems: AdminOrderCardModel[];
  dealerItems: DealerOrderCardModel[];
  stageFocus: OrdersStageFocus;
  onStageFocusChange: (next: OrdersStageFocus) => void;
  searchInput: string;
  setSearchInput: (v: string) => void;
  onOpenFilters: () => void;
  filterActiveCount?: number;
  /** Admin desk: Sales Orders vs Customer Requests. */
  deskMode?: AdminOrdersDeskMode;
  onDeskModeChange?: (next: AdminOrdersDeskMode) => void;
  ordersCount?: number;
  requestsCount?: number;
  /** Classic / admin header chip — dealer signature uses DealerOrdersRail locally. */
  statusChip?: StatusChipKey;
  onStatusChipChange?: (next: StatusChipKey) => void;
  /** Admin lifecycle focus (commercial desk) — server-scoped list via journeyBucket. */
  adminLifecycleFocus?: AdminLifecycleChipKey;
  onAdminLifecycleFocusChange?: (next: AdminLifecycleChipKey) => void;
  /**
   * Server journeyCounts (COUNT=DATASET). Required for admin Orders chips —
   * never derive from loadedRows.length.
   */
  journeyCounts?: Partial<Record<AdminLifecycleChipKey, number>> | null;
  /** Admin Standard / Modified / Custom lens — server-scoped. */
  orderTypeFocus?: OrderTypeFocus;
  onOrderTypeFocusChange?: (next: OrderTypeFocus) => void;
  orderTypeCounts?: OrderTypeCounts | null;
  rfqSubchip?: RfqInboxSubchip;
  onRfqSubchipChange?: (next: RfqInboxSubchip) => void;
  requestInboxCounts?: import('@/api/modules/requests').RequestInboxCounts | null;
  /** Admin only — production-style dealer filter under On the line. */
  dealerLabel?: string | null;
  onOpenDealerFilter?: () => void;
  onClearDealerFilter?: () => void;
  refreshing: boolean;
  onRefresh: () => void;
  onEndReached: () => void;
  isFetchingNextPage: boolean;
  onPressItem: (id: string, kind?: 'order' | 'rfq' | 'returnWork') => void;
  onPrimaryCta?: (order: OrdersProgressCardModel) => void;
  banner?: ReactNode;
};

/** Extra beige clearance under the list so the last cards clear the tab bar. */
const LIST_BOTTOM_EXTRA = 48;

type BoardSection = {
  key: string;
  title: string;
  totalCount: number;
  data: OrdersProgressCardModel[];
  kind: 'day' | 'lifecycle';
  dayKey?: FloorBoardSectionKey;
  lifecycleKey?: AdminOrderLifecycle;
};

type ExpandedMap = Record<FloorBoardSectionKey, boolean>;

const DEFAULT_EXPANDED: ExpandedMap = {
  today: true,
  past: true,
};

function toStream(
  variant: OrdersListVariant,
  adminItems: AdminOrderCardModel[],
  dealerItems: DealerOrderCardModel[],
): OrdersProgressCardModel[] {
  if (variant === 'dealer') {
    return dealerItems.map((o) => ({
      id: o.id,
      number: o.number,
      status: o.status,
      deliveryStatus: o.deliveryStatus,
      title: o.title,
      imageUrl: o.imageUrl,
      progressPercent: o.progressPercent,
      progressLabel: o.progressLabel,
      deliveryDate: o.deliveryDate,
      arrivedAt: o.arrivedAt,
      sellerPrice: o.sellerPrice,
      kind: o.kind,
      quantity: o.quantity,
      hasReturn: o.hasReturn,
    }));
  }
  return adminItems.map((o) => ({
    id: o.id,
    number: o.number,
    status: o.status,
    deliveryStatus: o.deliveryStatus,
    title: o.title,
    imageUrl: o.imageUrl,
    progressPercent: o.progressPercent,
    progressLabel: o.progressLabel,
    deliveryDate: o.deliveryDate,
    arrivedAt: o.arrivedAt,
    dealerId: o.dealerId,
    dealerName: o.dealerName,
    priority: o.priority,
    kind: o.kind ?? 'order',
    quantity: o.quantity,
    sellerPrice: o.sellerPrice,
    lifecycle: o.lifecycle,
    attention: o.attention,
    primaryCta: o.primaryCta,
    journeyReadiness: o.journeyReadiness,
    actionHint: o.actionHint,
    productionReadinessSummary: o.productionReadinessSummary,
    manufacturingKind: o.manufacturingKind,
    primaryProductionOrderId: o.primaryProductionOrderId,
    plannedStartDate: o.plannedStartDate,
    journeyLogistics: o.journeyLogistics,
    hasReturn: o.hasReturn,
    originKind: o.originKind,
    originalOrderNumber: o.originalOrderNumber,
  }));
}

function sortForFloor(a: OrdersProgressCardModel, b: OrdersProgressCardModel): number {
  const pa = (a.priority ?? '').toUpperCase();
  const pb = (b.priority ?? '').toUpperCase();
  const rank = (p: string) => (p === 'URGENT' ? 0 : p === 'HIGH' ? 1 : 2);
  const pr = rank(pa) - rank(pb);
  if (pr !== 0) return pr;
  const aa = a.arrivedAt ? Date.parse(a.arrivedAt) : 0;
  const ab = b.arrivedAt ? Date.parse(b.arrivedAt) : 0;
  if (aa !== ab) return ab - aa;
  const da = a.deliveryDate ? Date.parse(a.deliveryDate) : Number.POSITIVE_INFINITY;
  const db = b.deliveryDate ? Date.parse(b.deliveryDate) : Number.POSITIVE_INFINITY;
  if (da !== db) return da - db;
  return (a.progressPercent || 0) - (b.progressPercent || 0);
}

function sectionTitleKey(key: FloorBoardSectionKey): string {
  return `mobile.orders.ledger.${key}`;
}

function stageCountable(o: OrdersProgressCardModel) {
  return {
    status: o.status,
    deliveryDate: o.deliveryDate,
    deliveryStatus: 'deliveryStatus' in o ? o.deliveryStatus : null,
    kind: o.kind,
  };
}

function resolveLifecycle(o: OrdersProgressCardModel): AdminOrderLifecycle {
  if (o.lifecycle) return o.lifecycle;
  return classifyAdminOrderLifecycle({
    status: o.status,
    deliveryStatus: o.deliveryStatus,
    requiredDeliveryDate: o.deliveryDate,
    isRfq: o.kind === 'rfq',
    productionReadinessSummary: o.productionReadinessSummary,
    progressPercent: o.progressPercent,
    currentStageLabel: o.progressLabel,
  });
}

/**
 * Signature Orders: Today → Past by arrival day; each header toggles open/closed.
 * Admin: commercial desk sectioned by lifecycle (+ RFQ rail).
 */
export function OrdersSignatureHome({
  variant,
  adminItems,
  dealerItems,
  stageFocus,
  onStageFocusChange,
  searchInput,
  setSearchInput,
  onOpenFilters,
  filterActiveCount = 0,
  deskMode = 'orders',
  onDeskModeChange,
  ordersCount,
  requestsCount,
  statusChip = 'all',
  adminLifecycleFocus = 'all',
  onAdminLifecycleFocusChange,
  journeyCounts = null,
  orderTypeFocus = 'all',
  onOrderTypeFocusChange,
  orderTypeCounts = null,
  rfqSubchip = 'all',
  onRfqSubchipChange,
  requestInboxCounts = null,
  dealerLabel = null,
  onOpenDealerFilter,
  onClearDealerFilter,
  refreshing,
  onRefresh,
  onEndReached,
  isFetchingNextPage,
  onPressItem,
  onPrimaryCta,
  banner,
}: Props) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const reduce = useReducedMotion();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [expanded, setExpanded] = useState<ExpandedMap>(DEFAULT_EXPANDED);
  const [selectedTile, setSelectedTile] = useState<DealerOrderTileKey | null>(null);
  const [dealerRail, setDealerRail] = useState<DealerOrdersRailKey>('all');
  const [confirmTarget, setConfirmTarget] = useState<OrdersProgressCardModel | null>(null);
  const [confirmDeliveryId, setConfirmDeliveryId] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [resolvingConfirm, setResolvingConfirm] = useState(false);
  const isDealer = variant === 'dealer';
  const isAdmin = variant === 'admin';

  const confirmReceiptMutation = useMutation({
    mutationFn: (deliveryId: string) => confirmDeliveryReceipt(deliveryId),
    onSuccess: async () => {
      setConfirmTarget(null);
      setConfirmDeliveryId(null);
      setConfirmError(null);
      await queryClient.invalidateQueries({ queryKey: queryKeys.salesOrders.lists() });
      await queryClient.invalidateQueries({ queryKey: queryKeys.scheduling.ownDeliveries() });
      await queryClient.invalidateQueries({ queryKey: queryKeys.reports.dealerHome() });
      showToast({
        variant: 'success',
        message: t('lifecycle.confirmReceiptSuccess'),
      });
    },
    onError: (err) => {
      const code = isApiError(err) ? err.code : null;
      setConfirmError(t(`lifecycle.${mapConfirmReceiptErrorCode(code)}`));
    },
  });

  async function openConfirmReceipt(order: OrdersProgressCardModel) {
    setConfirmTarget(order);
    setConfirmDeliveryId(null);
    setConfirmError(null);
    setResolvingConfirm(true);
    try {
      const detail = await getSalesOrder(order.id);
      const delivery = (detail.deliveries ?? []).find(
        (d) => String(d.status).toUpperCase() === 'OUT_FOR_DELIVERY',
      );
      if (!delivery) {
        setConfirmError(t('lifecycle.confirmWrongState'));
        return;
      }
      setConfirmDeliveryId(delivery.id);
    } catch (err) {
      const code = isApiError(err) ? err.code : null;
      setConfirmError(t(`lifecycle.${mapConfirmReceiptErrorCode(code)}`));
    } finally {
      setResolvingConfirm(false);
    }
  }

  const allStream = useMemo(
    () => toStream(variant, adminItems, dealerItems),
    [adminItems, dealerItems, variant],
  );

  /** COUNT=DATASET — server meta only; never tally loaded pages. */
  const adminLifecycleCounts = useMemo(() => {
    if (!isAdmin || deskMode !== 'orders') {
      return {} as Partial<Record<AdminLifecycleChipKey, number>>;
    }
    if (!journeyCounts) {
      return {} as Partial<Record<AdminLifecycleChipKey, number>>;
    }
    return {
      all: journeyCounts.all ?? 0,
      preparing: journeyCounts.preparing ?? 0,
      ready_to_start: journeyCounts.ready_to_start ?? 0,
      in_production: journeyCounts.in_production ?? 0,
      ready_to_ship: journeyCounts.ready_to_ship ?? 0,
      shipped: journeyCounts.shipped ?? 0,
      delivered: journeyCounts.delivered ?? 0,
    };
  }, [deskMode, isAdmin, journeyCounts]);

  /** Spine counts follow admin stream. */
  const counts = useMemo(
    () => countOrderStages(allStream.map(stageCountable)),
    [allStream],
  );
  const dealerStampCounts = useMemo(
    () => countDealerOrderStamps(allStream.map(stageCountable)),
    [allStream],
  );
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  const dealerSections: BoardSection[] = useMemo(() => {
    if (!isDealer) return [];
    let focused = allStream;
    if (selectedTile) {
      focused = focused.filter((o) => matchesDealerOrderTile(stageCountable(o), selectedTile));
    }
    focused = focused.filter((o) => matchesDealerOrdersRail(stageCountable(o), dealerRail));
    return groupOrdersFloorBoard(focused).map((g) => {
      const sorted = [...g.items].sort(sortForFloor);
      const open = expanded[g.key];
      return {
        key: g.key,
        title: t(sectionTitleKey(g.key)),
        totalCount: sorted.length,
        data: open ? sorted : [],
        kind: 'day' as const,
        dayKey: g.key,
      };
    });
  }, [allStream, dealerRail, expanded, isDealer, selectedTile, t]);

  const adminSections: BoardSection[] = useMemo(() => {
    if (!isAdmin || deskMode !== 'orders') return [];
    const returnWork = allStream.filter((o) => o.kind === 'returnWork');
    if (returnWork.length) {
      const sorted = [...returnWork].sort(sortForFloor);
      return [
        {
          key: 'return_work',
          title: t('mobile.orders.journey.returnWorkSection'),
          totalCount: sorted.length,
          data: sorted,
          kind: 'lifecycle' as const,
        },
      ];
    }
    const salesOnly = allStream.filter((o) => o.kind !== 'rfq' && o.kind !== 'returnWork');

    // Focused lane is already server-scoped via journeyBucket — do not re-filter.
    if (adminLifecycleFocus !== 'all') {
      const life = adminLifecycleFocus as AdminOrderLifecycle;
      const items = [...salesOnly].sort(sortForFloor);
      const serverCount = adminLifecycleCounts[adminLifecycleFocus];
      return [
        {
          key: life,
          title: adminLifecycleHumanLabel(life, t),
          totalCount: serverCount ?? items.length,
          data: items,
          kind: 'lifecycle' as const,
          lifecycleKey: life,
        },
      ];
    }

    const buckets = new Map<AdminOrderLifecycle, OrdersProgressCardModel[]>();
    for (const o of salesOnly) {
      const life = resolveLifecycle(o);
      if (life === 'rfq') continue;
      const list = buckets.get(life) ?? [];
      list.push(o);
      buckets.set(life, list);
    }

    return ADMIN_LIFECYCLE_SECTION_ORDER.map((lifeKey) => {
      const items = [...(buckets.get(lifeKey) ?? [])].sort(sortForFloor);
      const serverCount = adminLifecycleCounts[lifeKey];
      return {
        key: lifeKey,
        title: adminLifecycleHumanLabel(lifeKey, t),
        totalCount: serverCount ?? items.length,
        data: items,
        kind: 'lifecycle' as const,
        lifecycleKey: lifeKey,
      };
    }).filter((s) => (adminLifecycleCounts[s.key as AdminLifecycleChipKey] ?? s.totalCount) > 0);
  }, [
    adminLifecycleCounts,
    adminLifecycleFocus,
    allStream,
    deskMode,
    isAdmin,
    t,
  ]);

  const requestInboxItems = useMemo(() => {
    if (!isAdmin || deskMode !== 'requests') return [];
    return [...allStream]
      .filter((o) => o.kind === 'rfq')
      .sort(sortForFloor);
  }, [allStream, deskMode, isAdmin]);

  const sections: BoardSection[] = isAdmin ? adminSections : dealerSections;

  const listPad = {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    paddingBottom:
      theme.spacing['3xl'] + SURFACE_TAB_BAR_CLEARANCE + LIST_BOTTOM_EXTRA,
  };
  /** Row layout anim fights the keyboard while typing — keep list stable during search. */
  const searchActive = searchInput.trim().length > 0;
  const dealerFiltersActive = Boolean(selectedTile) || dealerRail !== 'all' || searchActive;

  const toggleSection = (key: FloorBoardSectionKey) => {
    void haptics.selection();
    LayoutAnimation.configureNext(
      LayoutAnimation.create(
        withMotionDuration(durations.cardEnter, reduce),
        LayoutAnimation.Types.easeInEaseOut,
        LayoutAnimation.Properties.opacity,
      ),
    );
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const dealerRailStops = railStopsForTile(selectedTile);
  const showDealerRail = dealerRailStops.length > 0;

  const selectDealerTile = (key: DealerOrderTileKey | null) => {
    setSelectedTile(key);
    setDealerRail('all');
  };

  const railMotion = reduce
    ? undefined
    : FadeIn.duration(withMotionDuration(durations.chip, reduce));
  const railExit = reduce
    ? undefined
    : FadeOut.duration(withMotionDuration(durations.chip, reduce));
  const chromeLayout = reduce
    ? undefined
    : LinearTransition.duration(withMotionDuration(durations.chip, reduce));

  const dealerHeader = (
    <View style={{ gap: theme.spacing.md, paddingBottom: theme.spacing.md }}>
      {banner}
      <AppText variant="largeTitle" weight={titleWeight} align="center" numberOfLines={1}>
        {t('mobile.orders.title')}
      </AppText>
      <DealerOrdersHubBoard
        counts={dealerStampCounts}
        selectedTile={selectedTile}
        onSelectTile={selectDealerTile}
      />
      <DealerQuotationsEntry />
      <Animated.View
        layout={chromeLayout}
        style={{
          borderRadius: theme.radius.xl,
          borderWidth: 1,
          borderColor: colors.borderStrong,
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
            ...(isRTL ? { right: 0 } : { left: 0 }),
            width: 3,
            backgroundColor: colors.brand,
            opacity: 0.55,
          }}
        />
        <View
          style={{
            padding: theme.spacing.md,
            gap: theme.spacing.md,
            ...(isRTL
              ? { paddingRight: theme.spacing.md + 4 }
              : { paddingLeft: theme.spacing.md + 4 }),
          }}
        >
          <DealerSearchBar
            value={searchInput}
            onChangeText={setSearchInput}
            placeholder={t('mobile.orders.searchPlaceholder')}
          />
          <OrdersFilterButton onPress={onOpenFilters} activeCount={filterActiveCount} />
          {showDealerRail ? (
            <Animated.View
              key={selectedTile}
              entering={railMotion}
              exiting={railExit}
            >
              <DealerOrdersRail
                segments={dealerRailStops}
                value={dealerRail}
                onChange={setDealerRail}
              />
            </Animated.View>
          ) : null}
        </View>
      </Animated.View>
    </View>
  );

  const header = isDealer ? (
    dealerHeader
  ) : (
    <View style={{ gap: theme.spacing.md, paddingBottom: theme.spacing.md }}>
      {banner}
      <OrdersCompositionChrome
        title={t('mobile.orders.title')}
        searchInput={searchInput}
        setSearchInput={setSearchInput}
        onOpenFilters={onOpenFilters}
        filterActiveCount={filterActiveCount}
      >
        <View style={{ gap: theme.spacing.md }}>
          {onDeskModeChange ? (
            <>
              <AdminOrdersDeskSwitch
                value={deskMode}
                onChange={onDeskModeChange}
                ordersCount={ordersCount}
                requestsCount={requestsCount}
              />
              {onOpenDealerFilter ? (
                <OrdersDealerBar
                  label={dealerLabel}
                  onPress={onOpenDealerFilter}
                  onClear={dealerLabel ? onClearDealerFilter : undefined}
                />
              ) : null}
              {deskMode === 'orders' && onAdminLifecycleFocusChange ? (
                <>
                  {onOrderTypeFocusChange ? (
                    <OrderTypeLensBar
                      value={orderTypeFocus}
                      counts={orderTypeCounts}
                      onChange={onOrderTypeFocusChange}
                      includeReturned
                    />
                  ) : null}
                  <AdminLifecycleChips
                    value={adminLifecycleFocus}
                    onChange={onAdminLifecycleFocusChange}
                    counts={adminLifecycleCounts}
                  />
                </>
              ) : null}
              {deskMode === 'requests' ? (
                <>
                  {onOrderTypeFocusChange ? (
                    <OrderTypeLensBar
                      value={orderTypeFocus}
                      counts={orderTypeCounts}
                      onChange={onOrderTypeFocusChange}
                      includeReturned={false}
                    />
                  ) : null}
                  <OrdersRfqInboxChips
                    value={rfqSubchip}
                    onChange={onRfqSubchipChange ?? (() => undefined)}
                    counts={requestInboxCounts}
                  />
                </>
              ) : null}
            </>
          ) : (
            <>
              <OrdersStageSpine
                counts={counts}
                stageFocus={stageFocus}
                onStageFocusChange={onStageFocusChange}
              />
              {onOpenDealerFilter ? (
                <OrdersDealerBar
                  label={dealerLabel}
                  onPress={onOpenDealerFilter}
                  onClear={dealerLabel ? onClearDealerFilter : undefined}
                />
              ) : null}
            </>
          )}
        </View>
      </OrdersCompositionChrome>
    </View>
  );

  const adminBoard =
    isAdmin && onDeskModeChange ? (
      <ScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="none"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />
        }
        onScroll={({ nativeEvent }) => {
          const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
          if (layoutMeasurement.height + contentOffset.y >= contentSize.height - 420) {
            onEndReached();
          }
        }}
        scrollEventThrottle={400}
        contentContainerStyle={{
          ...listPad,
          flexGrow: 1,
          gap: theme.spacing.lg,
        }}
      >
        {header}
        {deskMode === 'requests' ? (
          requestInboxItems.length === 0 ? (
            <EmptyState
              title={t('mobile.orders.requestsEmptyTitle')}
              description={t('mobile.orders.requestsEmptyBody')}
            />
          ) : (
            <View
              style={{
                borderRadius: theme.radius.xl,
                borderWidth: 1.5,
                borderColor: colors.warning,
                backgroundColor: colors.warningSoft,
                padding: theme.spacing.sm,
                gap: theme.spacing.sm,
              }}
            >
              <AppText
                variant="caption"
                weight="semibold"
                style={{
                  color: colors.warning,
                  letterSpacing: 0.6,
                  textTransform: 'uppercase',
                  fontSize: 11,
                  paddingHorizontal: theme.spacing.xs,
                }}
              >
                {adminLifecyclePhaseHint('rfq', t)}
              </AppText>
              <AdminLifecycleTray
                lifecycleKey="rfq"
                title={adminLifecycleHumanLabel('rfq', t)}
                items={requestInboxItems}
                mode="focused"
                hint={t('mobile.orders.requestsInboxHint')}
                onPressItem={onPressItem}
              />
            </View>
          )
        ) : adminSections.length === 0 ? (
          <EmptyState
            title={
              adminLifecycleFocus !== 'all'
                ? t('mobile.orders.emptyLifecycleTitle')
                : t('mobile.orders.emptyTitle')
            }
            description={
              adminLifecycleFocus !== 'all'
                ? t('mobile.orders.emptyLifecycleBody')
                : t('mobile.orders.emptyBody')
            }
          />
        ) : (
          adminSections.map((section) => (
            <AdminLifecycleTray
              key={section.key}
              lifecycleKey={section.lifecycleKey!}
              title={section.title}
              items={section.data}
              totalCount={section.totalCount}
              mode={adminLifecycleFocus === 'all' ? 'preview' : 'focused'}
              hint={
                section.lifecycleKey
                  ? adminLifecyclePhaseHint(section.lifecycleKey, t)
                  : null
              }
              onPressItem={onPressItem}
              onPrimaryCta={onPrimaryCta}
              onOpenFocused={
                adminLifecycleFocus === 'all' && onAdminLifecycleFocusChange
                  ? () => onAdminLifecycleFocusChange(section.lifecycleKey as AdminLifecycleChipKey)
                  : undefined
              }
            />
          ))
        )}
        {isFetchingNextPage && deskMode === 'orders' ? (
          <View style={{ paddingVertical: theme.spacing.lg }}>
            <OrdersListSkeleton />
          </View>
        ) : null}
      </ScrollView>
    ) : null;

  return (
    <>
    {adminBoard ?? (
    <SectionList<OrdersProgressCardModel, BoardSection>
      sections={sections}
      keyExtractor={(item, index) =>
        `${item.kind ?? 'order'}-${item.id}-${index}`
      }
      stickySectionHeadersEnabled
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="none"
      extraData={expanded}
      initialNumToRender={12}
      maxToRenderPerBatch={10}
      windowSize={7}
      removeClippedSubviews={false}
      ListHeaderComponent={header}
      contentContainerStyle={{
        ...listPad,
        flexGrow: 1,
      }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />
      }
      onEndReached={onEndReached}
      onEndReachedThreshold={0.4}
      ListEmptyComponent={
        isDealer ? (
          <DealerEmptyState
            title={
              dealerFiltersActive
                ? t('mobile.orders.emptyStamp')
                : t('mobile.orders.emptyTitle')
            }
            body={
              dealerFiltersActive
                ? t('mobile.orders.emptyStampHint')
                : t('mobile.orders.emptyBody')
            }
          />
        ) : (
        <EmptyState
          title={
            searchActive
              ? t('mobile.orders.emptySearchTitle')
              : statusChip === 'drafts'
                ? t('mobile.orders.emptyDraftsTitle')
                : statusChip === 'waiting'
                  ? t('mobile.orders.emptyWaitingTitle')
                  : statusChip === 'needsInformation'
                    ? t('mobile.orders.emptyNeedsInfoTitle')
                    : statusChip === 'production'
                      ? t('lifecycle.noInProduction')
                      : statusChip === 'ready'
                        ? t('lifecycle.noReady')
                        : statusChip === 'shipped'
                          ? t('lifecycle.noShipped')
                          : statusChip === 'delivered'
                            ? t('lifecycle.noDelivered')
                            : t('mobile.orders.emptyTitle')
          }
          description={
            searchActive
              ? t('mobile.orders.emptySearchBody')
              : statusChip === 'drafts'
                ? t('mobile.orders.emptyDraftsBody')
                : statusChip === 'waiting'
                  ? t('mobile.orders.emptyWaitingBody')
                  : statusChip === 'needsInformation'
                    ? t('mobile.orders.emptyNeedsInfoBody')
                    : statusChip === 'production' ||
                        statusChip === 'ready' ||
                        statusChip === 'shipped' ||
                        statusChip === 'delivered'
                      ? undefined
                      : t('mobile.orders.emptyBody')
          }
        />
        )
      }
      ListFooterComponent={
        isFetchingNextPage ? (
          <View style={{ paddingVertical: theme.spacing.lg }}>
            <OrdersListSkeleton />
          </View>
        ) : null
      }
      renderSectionHeader={({ section }) => {
        const dayKey = section.dayKey ?? 'today';
        return (
          <OrdersDaySectionHeader
            title={section.title}
            count={section.totalCount}
            sectionKey={dayKey}
            expanded={expanded[dayKey]}
            onToggle={() => toggleSection(dayKey)}
          />
        );
      }}
      renderSectionFooter={({ section }) => {
        if (!isDealer) return null;
        const dayKey = section.dayKey ?? 'today';
        if (!expanded[dayKey] || section.totalCount > 0) return null;
        return (
          <DealerEmptyPanel
            text={
              dealerFiltersActive
                ? t('mobile.orders.emptyStampHint')
                : dayKey === 'today'
                  ? t('mobile.orders.emptyToday')
                  : t('mobile.orders.emptyPast')
            }
            icon="file-tray-outline"
            nested
            compact
          />
        );
      }}
      renderItem={({ item, index, section }) => {
        const globalIndex =
          sections
            .slice(0, sections.findIndex((s) => s.key === section.key))
            .reduce((n, s) => n + s.data.length, 0) + index;
        return (
          <OrderRowMotion index={globalIndex} reduce={reduce || searchActive}>
            <OrdersProgressCard
              order={item}
              variant={variant}
              onPress={() => onPressItem(item.id, item.kind)}
              onPrimaryCta={
                variant === 'admin' && onPrimaryCta
                  ? () => onPrimaryCta(item)
                  : undefined
              }
              onProgressPress={
                item.kind === 'rfq'
                  ? undefined
                  : () =>
                      router.push(
                        variant === 'admin'
                          ? adminOrderFlowHref(item.id)
                          : dealerOrderFlowHref(item.id),
                      )
              }
              onConfirmReceipt={
                isDealer && item.kind !== 'rfq'
                  ? () => {
                      void openConfirmReceipt(item);
                    }
                  : undefined
              }
            />
          </OrderRowMotion>
        );
      }}
    />
    )}
    <ConfirmReceiptSheet
      open={Boolean(confirmTarget)}
      orderNumber={confirmTarget?.number ?? ''}
      productTitle={confirmTarget?.title ?? ''}
      quantity={confirmTarget?.quantity}
      imageUrl={confirmTarget?.imageUrl}
      loading={resolvingConfirm || confirmReceiptMutation.isPending}
      error={confirmError}
      canConfirm={Boolean(confirmDeliveryId) && !resolvingConfirm}
      onClose={() => {
        if (resolvingConfirm || confirmReceiptMutation.isPending) return;
        setConfirmTarget(null);
        setConfirmDeliveryId(null);
        setConfirmError(null);
      }}
      onConfirm={() => {
        setConfirmError(null);
        if (confirmDeliveryId) confirmReceiptMutation.mutate(confirmDeliveryId);
      }}
    />
    </>
  );
}

function OrderRowMotion({
  children,
  index,
  reduce,
}: {
  children: ReactNode;
  index: number;
  reduce: boolean;
}) {
  if (reduce || index > 10) {
    return <View>{children}</View>;
  }
  return (
    <ListItemEnter index={index}>
      <Animated.View layout={LinearTransition.duration(220)}>
        <View>{children}</View>
      </Animated.View>
    </ListItemEnter>
  );
}
