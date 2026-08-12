import { useMemo, useState, type ReactNode } from 'react';
import {
  LayoutAnimation,
  Platform,
  RefreshControl,
  SectionList,
  UIManager,
  View,
} from 'react-native';
import Animated, { LinearTransition } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { EmptyState } from '@/components/feedback/EmptyState';
import { useLocale } from '@/i18n';
import { haptics, useReducedMotion } from '@/motion';
import { durations, withMotionDuration } from '@/motion/presets';
import { useTheme } from '@/theme';
import { SURFACE_TAB_BAR_CLEARANCE } from '@/navigation/tabBarClearance';
import {
  adminOrderFlowHref,
  dealerOrderFlowHref,
} from '@/features/production-flow/flowRoutes';
import {
  groupOrdersFloorBoard,
  type FloorBoardSectionKey,
} from '../groupOrdersByDay';
import {
  countDealerFocusBuckets,
  countOrderStages,
  filterByStageFocus,
  matchesStatusChip,
  type OrdersStageFocus,
} from '../stageCounts';
import type { AdminOrderCardModel, DealerOrderCardModel, OrdersListVariant } from '../selectOrderCard';
import { DealerOrdersFocusRail } from './DealerOrdersFocusRail';
import { OrdersApprovalChips } from './OrdersApprovalChips';
import { OrdersCompositionChrome } from './OrdersCompositionChrome';
import { OrdersDaySectionHeader } from './OrdersDaySectionHeader';
import { OrdersDealerBar } from './OrdersDealerBar';
import {
  type StatusChipKey,
} from './OrdersFilterChips';
import type { OrdersApprovalFilter } from './OrdersFilterSheet';
import { OrdersListSkeleton } from './OrdersListSkeleton';
import { OrdersProgressCard, type OrdersProgressCardModel } from './OrdersProgressCard';
import { OrdersStageSpine } from './OrdersStageSpine';

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
  approval: OrdersApprovalFilter;
  onApprovalChange: (next: OrdersApprovalFilter) => void;
  /** Dealer status touch bar under On the line. */
  statusChip?: StatusChipKey;
  onStatusChipChange?: (next: StatusChipKey) => void;
  /** Admin only — production-style dealer filter under On the line. */
  dealerLabel?: string | null;
  onOpenDealerFilter?: () => void;
  onClearDealerFilter?: () => void;
  refreshing: boolean;
  onRefresh: () => void;
  onEndReached: () => void;
  isFetchingNextPage: boolean;
  onPressItem: (id: string, kind?: 'order' | 'rfq') => void;
  banner?: ReactNode;
};

/** Extra beige clearance under the list so the last cards clear the tab bar. */
const LIST_BOTTOM_EXTRA = 48;

type Section = {
  key: FloorBoardSectionKey;
  title: string;
  totalCount: number;
  data: OrdersProgressCardModel[];
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
      title: o.title,
      imageUrl: o.imageUrl,
      progressPercent: o.progressPercent,
      progressLabel: o.progressLabel,
      deliveryDate: o.deliveryDate,
      arrivedAt: o.arrivedAt,
      sellerPrice: o.sellerPrice,
      kind: o.kind,
    }));
  }
  return adminItems.map((o) => ({
    id: o.id,
    number: o.number,
    status: o.status,
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

/**
 * Signature Orders: Today → Past by arrival day; each header toggles open/closed.
 * No upcoming — only what has already come in from dealers.
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
  approval,
  onApprovalChange,
  statusChip = 'all',
  onStatusChipChange,
  dealerLabel = null,
  onOpenDealerFilter,
  onClearDealerFilter,
  refreshing,
  onRefresh,
  onEndReached,
  isFetchingNextPage,
  onPressItem,
  banner,
}: Props) {
  const { t } = useLocale();
  const { colors, theme } = useTheme();
  const reduce = useReducedMotion();
  const router = useRouter();
  const [expanded, setExpanded] = useState<ExpandedMap>(DEFAULT_EXPANDED);
  const isDealer = variant === 'dealer';

  const allStream = useMemo(
    () => toStream(variant, adminItems, dealerItems),
    [adminItems, dealerItems, variant],
  );

  /** Spine counts follow admin stream; dealer focus rail counts the searchable stream. */
  const counts = useMemo(
    () =>
      countOrderStages(
        allStream.map((o) => ({ status: o.status, deliveryDate: o.deliveryDate })),
      ),
    [allStream],
  );

  const dealerFocusCounts = useMemo(
    () =>
      countDealerFocusBuckets(
        allStream.map((o) => ({ status: o.status, deliveryDate: o.deliveryDate })),
      ),
    [allStream],
  );

  const sections: Section[] = useMemo(() => {
    const focused = isDealer
      ? allStream.filter((o) => matchesStatusChip(o, statusChip))
      : filterByStageFocus(allStream, stageFocus);
    return groupOrdersFloorBoard(focused).map((g) => {
      const sorted = [...g.items].sort(sortForFloor);
      const open = expanded[g.key];
      return {
        key: g.key,
        title: t(sectionTitleKey(g.key)),
        totalCount: sorted.length,
        data: open ? sorted : [],
      };
    });
  }, [allStream, expanded, isDealer, stageFocus, statusChip, t]);

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

  const header = (
    <View style={{ gap: theme.spacing.md, paddingBottom: theme.spacing.md }}>
      {banner}
      <OrdersCompositionChrome
        title={t('mobile.orders.title')}
        eyebrow={
          isDealer ? t('mobile.dealerAccount.ordersEyebrow') : undefined
        }
        subtitle={
          isDealer ? t('mobile.dealerAccount.ordersSubtitle') : undefined
        }
        searchInput={searchInput}
        setSearchInput={setSearchInput}
        onOpenFilters={onOpenFilters}
        filterActiveCount={filterActiveCount}
        dealerSearch={isDealer}
      >
        <View style={{ gap: theme.spacing.md }}>
          {isDealer && onStatusChipChange ? (
            <DealerOrdersFocusRail
              value={statusChip}
              onChange={onStatusChipChange}
              counts={dealerFocusCounts}
            />
          ) : (
            <>
              <OrdersStageSpine
                counts={counts}
                stageFocus={stageFocus}
                onStageFocusChange={onStageFocusChange}
              />
              {variant === 'admin' && onOpenDealerFilter ? (
                <OrdersDealerBar
                  label={dealerLabel}
                  onPress={onOpenDealerFilter}
                  onClear={dealerLabel ? onClearDealerFilter : undefined}
                />
              ) : null}
              <OrdersApprovalChips value={approval} onChange={onApprovalChange} />
            </>
          )}
        </View>
      </OrdersCompositionChrome>
    </View>
  );

  return (
    <SectionList
      sections={sections}
      keyExtractor={(item, index) =>
        `${item.kind ?? 'order'}-${item.id}-${index}`
      }
      stickySectionHeadersEnabled
      extraData={expanded}
      initialNumToRender={12}
      maxToRenderPerBatch={10}
      windowSize={7}
      removeClippedSubviews
      ListHeaderComponent={header}
      contentContainerStyle={{
        paddingHorizontal: theme.spacing.lg,
        paddingBottom:
          theme.spacing['3xl'] + SURFACE_TAB_BAR_CLEARANCE + LIST_BOTTOM_EXTRA,
        flexGrow: 1,
      }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />
      }
      onEndReached={onEndReached}
      onEndReachedThreshold={0.4}
      ListEmptyComponent={
        <EmptyState
          title={t('mobile.orders.emptyTitle')}
          description={t('mobile.orders.emptyBody')}
        />
      }
      ListFooterComponent={
        isFetchingNextPage ? (
          <View style={{ paddingVertical: theme.spacing.lg }}>
            <OrdersListSkeleton />
          </View>
        ) : null
      }
      renderSectionHeader={({ section }) => (
        <OrdersDaySectionHeader
          title={section.title}
          count={section.totalCount}
          sectionKey={section.key}
          expanded={expanded[section.key]}
          onToggle={() => toggleSection(section.key)}
        />
      )}
      renderItem={({ item, index, section }) => {
        const globalIndex =
          sections
            .slice(0, sections.findIndex((s) => s.key === section.key))
            .reduce((n, s) => n + s.data.length, 0) + index;
        return (
          <OrderRowMotion index={globalIndex} reduce={reduce}>
            <OrdersProgressCard
              order={item}
              variant={variant}
              onPress={() => onPressItem(item.id, item.kind)}
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
            />
          </OrderRowMotion>
        );
      }}
    />
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
    <Animated.View layout={LinearTransition.duration(220)}>
      {children}
    </Animated.View>
  );
}
