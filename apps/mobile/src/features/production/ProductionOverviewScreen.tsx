import { useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { canAny } from '@maher/permissions';
import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { OfflineBanner } from '@/components/feedback/OfflineBanner';
import { TextField } from '@/components/forms/TextField';
import { AppScreen } from '@/components/layout/AppScreen';
import { useNetwork } from '@/components/network/NetworkProvider';
import { useLocale } from '@/i18n';
import {
  AnimatedPressable,
  CountUp,
  ListItemEnter,
  haptics,
} from '@/motion';
import { useTheme } from '@/theme';
import { SURFACE_TAB_BAR_CLEARANCE } from '@/navigation/tabBarClearance';
import type { ProductionListBucket } from './api';
import { ProductionDealerBar } from './components/ProductionDealerBar';
import { ProductionDealerSheet } from './components/ProductionDealerSheet';
import { ProductionOrderCard } from './components/ProductionOrderCard';
import { ProductionListSkeleton } from './components/ProductionSkeleton';
import {
  flattenProductionOrderPages,
  useProductionDealersQuery,
  useProductionOrdersInfiniteQuery,
  useProductionSummaryQuery,
} from './query';
import { selectProductionCard } from './selectProduction';

type MetricAccent = 'brand' | 'info' | 'success' | 'late' | 'warning';

type MetricKey =
  | 'needs_setup'
  | 'ready_to_start'
  | 'on_floor'
  | 'blocked'
  | 'inspection_packaging';

type MetricDef = {
  key: MetricKey;
  label: string;
  value: number;
  accent?: MetricAccent;
};

const BOARD_BUCKETS = new Set<string>([
  'needs_setup',
  'ready_to_start',
  'on_floor',
  'blocked',
  'inspection_packaging',
  'completed',
  'in_production',
  'late',
  'all',
]);

export function ProductionOverviewScreen() {
  const { user, refreshUser } = useAuth();
  const { t, locale, isRTL } = useLocale();
  const { theme, colors } = useTheme();
  const { showOfflineBanner } = useNetwork();
  const router = useRouter();
  const params = useLocalSearchParams<{ bucket?: string; section?: string; quality?: string }>();
  const listRef = useRef<FlatList>(null);
  /** Stagger enter only on first paint — filter swaps remount rows and must stay opaque. */
  const [staggerListEnter, setStaggerListEnter] = useState(true);
  const allowed = canAny(user, ['production-order.read', 'production-task.read']);
  const canWorkflow = canAny(user, ['production.workflow.read', 'production-order.update']);

  const initialBucket = (() => {
    const raw = String(params.bucket ?? params.section ?? 'on_floor');
    return BOARD_BUCKETS.has(raw) ? (raw as ProductionListBucket) : 'on_floor';
  })();

  const [bucket, setBucket] = useState<ProductionListBucket>(initialBucket);
  const [searchInput, setSearchInput] = useState('');
  const [q, setQ] = useState('');
  const [dealerId, setDealerId] = useState<string | null>(null);
  const [dealerLabel, setDealerLabel] = useState<string | null>(null);
  const [dealerSheetOpen, setDealerSheetOpen] = useState(false);

  useEffect(() => {
    const raw = String(params.bucket ?? params.section ?? '');
    if (raw && BOARD_BUCKETS.has(raw)) {
      setBucket(raw as ProductionListBucket);
    }
  }, [params.bucket, params.section, params.quality]);

  // Pick up newly seeded production.workflow.* grants without forcing a full reinstall.
  useEffect(() => {
    if (!allowed) return;
    void refreshUser();
  }, [allowed, refreshUser]);

  useEffect(() => {
    const id = setTimeout(() => {
      const next = searchInput.trim();
      if (next !== q) setStaggerListEnter(false);
      setQ(next);
    }, 300);
    return () => clearTimeout(id);
  }, [searchInput, q]);

  const summaryQuery = useProductionSummaryQuery(allowed);
  const dealersQuery = useProductionDealersQuery(allowed);
  const listQuery = useProductionOrdersInfiniteQuery(
    {
      bucket,
      q: q || undefined,
      customerId: dealerId ?? undefined,
    },
    allowed,
  );

  const refreshing =
    (summaryQuery.isRefetching || listQuery.isRefetching) &&
    !listQuery.isFetchingNextPage &&
    !listQuery.isPlaceholderData;

  /** Soft indicator while keepPreviousData shows the prior list. */
  const isFilterUpdating =
    listQuery.isFetching &&
    !listQuery.isFetchingNextPage &&
    Boolean(listQuery.data);

  const cards = useMemo(
    () =>
      flattenProductionOrderPages(listQuery.data).map((item) =>
        selectProductionCard(item, locale),
      ),
    [listQuery.data, locale],
  );

  useEffect(() => {
    if (!staggerListEnter) return;
    if (listQuery.isPending || !listQuery.data) return;
    const t = setTimeout(() => setStaggerListEnter(false), 520);
    return () => clearTimeout(t);
  }, [listQuery.data, listQuery.isPending, staggerListEnter]);

  const selectBucket = (next: ProductionListBucket) => {
    // Tap active lane again → clear filter and show all orders.
    const resolved = next === bucket ? 'all' : next;
    if (resolved === bucket) return;
    setStaggerListEnter(false);
    void haptics.selection();
    setBucket(resolved);
    // Persist lane in URL so list → detail → back restores Attention/Needs planning/etc.
    router.setParams({ bucket: resolved === 'all' ? undefined : resolved });
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  };

  if (!allowed) {
    return (
      <AppScreen>
        <EmptyState title={t('mobile.noModules')} description={t('mobile.noModulesHint')} />
      </AppScreen>
    );
  }

  // Only the true first load — never tear down the page when filters change
  const initialLoad = listQuery.isPending && !listQuery.data;

  if (initialLoad) {
    return (
      <AppScreen>
        <AppText variant="title" weight="semibold">
          {t('mobile.production.title')}
        </AppText>
        <ProductionListSkeleton />
      </AppScreen>
    );
  }

  if (listQuery.isError && !listQuery.data) {
    return (
      <AppScreen>
        {showOfflineBanner ? <OfflineBanner /> : null}
        <ErrorState
          title={t('mobile.production.errorTitle')}
          description={t('mobile.production.errorBody')}
          retryLabel={t('mobile.production.retry')}
          onRetry={() => void listQuery.refetch()}
        />
      </AppScreen>
    );
  }

  const summary = summaryQuery.data;
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  const setupMetrics: MetricDef[] | null = summary
    ? [
        {
          key: 'needs_setup',
          label: t('mobile.production.needsSetup'),
          value: summary.needsSetup ?? 0,
          accent: 'warning',
        },
        {
          key: 'ready_to_start',
          label: t('mobile.production.readyToStart'),
          value: summary.readyToStart ?? 0,
          accent: 'brand',
        },
        {
          key: 'on_floor',
          label: t('mobile.production.onFloor'),
          value: summary.onFloor ?? 0,
          accent: 'info',
        },
      ]
    : null;

  const attentionMetrics: MetricDef[] | null = summary
    ? [
        {
          key: 'blocked',
          label: t('mobile.production.blocked'),
          value: summary.blocked ?? 0,
          accent: summary.blocked && summary.blocked > 0 ? 'late' : undefined,
        },
        {
          key: 'inspection_packaging',
          label: t('mobile.production.inspectionPackaging'),
          value: summary.inspectionPackaging ?? 0,
          accent: 'success',
        },
      ]
    : null;

  return (
    <AppScreen>
      {showOfflineBanner ? <OfflineBanner /> : null}
      <FlatList
        ref={listRef}
        data={cards}
        keyExtractor={(item) => item.id}
        style={{ opacity: isFilterUpdating ? 0.72 : 1 }}
        extraData={`${bucket}:${q}:${dealerId}:${isFilterUpdating}`}
        contentContainerStyle={{
          gap: theme.spacing.md,
          paddingBottom: theme.spacing['3xl'] + SURFACE_TAB_BAR_CLEARANCE,
          flexGrow: 1,
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              void summaryQuery.refetch();
              void listQuery.refetch();
            }}
          />
        }
        onEndReached={() => {
          if (listQuery.hasNextPage && !listQuery.isFetchingNextPage) {
            void listQuery.fetchNextPage();
          }
        }}
        onEndReachedThreshold={0.4}
        ListHeaderComponent={
          <View style={{ gap: theme.spacing.lg, marginBottom: theme.spacing.sm }}>
            {isFilterUpdating ? (
              <AppText
                variant="caption"
                color="muted"
                style={{ textAlign: isRTL ? 'right' : 'left' }}
              >
                {t('mobile.production.updatingList')}
              </AppText>
            ) : null}
            <View style={{ gap: theme.spacing.xs }}>
              <AppText
                variant="caption"
                weight={locale === 'ar' ? 'regular' : 'medium'}
                style={{
                  letterSpacing: locale === 'ar' ? 0 : 1.4,
                  textTransform: locale === 'ar' ? 'none' : 'uppercase',
                  color: colors.brand,
                }}
              >
                {t('mobile.production.pulseEyebrow')}
              </AppText>
              <AppText variant="title" weight={titleWeight}>
                {t('mobile.production.title')}
              </AppText>
              <AppText variant="caption" color="muted">
                {t('mobile.production.subtitle')}
              </AppText>
            </View>

            {canWorkflow ? (
              <AnimatedPressable
                variant="button"
                onPress={() => {
                  void haptics.selection();
                  router.push('/(app)/(admin)/production/workflow' as Href);
                }}
                style={{
                  borderRadius: theme.radius.xl,
                  borderWidth: StyleSheet.hairlineWidth,
                  borderColor: colors.borderStrong,
                  backgroundColor: colors.surface,
                  paddingHorizontal: theme.spacing.lg,
                  paddingVertical: theme.spacing.md,
                  gap: theme.spacing.xs,
                }}
                accessibilityRole="button"
                accessibilityLabel={t('mobile.production.workflow.title')}
              >
                <View
                  style={{
                    flexDirection: isRTL ? 'row-reverse' : 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: theme.spacing.md,
                  }}
                >
                  <View style={{ flex: 1, gap: 2 }}>
                    <AppText variant="body" weight="semibold">
                      {t('mobile.production.workflow.title')}
                    </AppText>
                    <AppText variant="caption" color="muted">
                      {t('mobile.production.workflow.subtitle')}
                    </AppText>
                  </View>
                  <AppText variant="body" color="brand" weight="semibold">
                    {isRTL ? '←' : '→'}
                  </AppText>
                </View>
              </AnimatedPressable>
            ) : null}

            {setupMetrics && attentionMetrics ? (
              <View
                style={{
                  borderRadius: theme.radius.xl,
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: colors.borderStrong,
                  overflow: 'hidden',
                  ...theme.elevation.card,
                }}
              >
                <View
                  style={{
                    paddingHorizontal: theme.spacing.md,
                    paddingTop: theme.spacing.md,
                    paddingBottom: theme.spacing.sm,
                    flexDirection: isRTL ? 'row-reverse' : 'row',
                    alignItems: 'baseline',
                    justifyContent: 'space-between',
                    gap: theme.spacing.sm,
                    backgroundColor: colors.surfaceElevated,
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    borderBottomColor: colors.borderMuted,
                  }}
                >
                  <AppText
                    variant="caption"
                    weight="semibold"
                    style={{
                      color: colors.brand,
                      letterSpacing: locale === 'ar' ? 0 : 1.1,
                      textTransform: locale === 'ar' ? 'none' : 'uppercase',
                      fontSize: 10,
                      lineHeight: 12,
                    }}
                  >
                    {t('mobile.production.boardSections')}
                  </AppText>
                  <AppText variant="caption" color="muted" numberOfLines={1}>
                    {bucket === 'all'
                      ? t('mobile.production.boardShowingAll')
                      : t('mobile.production.boardTapAgain')}
                  </AppText>
                </View>

                <View
                  style={{
                    padding: theme.spacing.sm,
                    gap: theme.spacing.sm,
                    backgroundColor: colors.background,
                  }}
                >
                  <MetricRow
                    isRTL={isRTL}
                    items={setupMetrics}
                    selected={bucket}
                    onSelect={selectBucket}
                  />
                  <MetricRow
                    isRTL={isRTL}
                    items={attentionMetrics}
                    selected={bucket}
                    onSelect={selectBucket}
                  />
                </View>
              </View>
            ) : null}

            <View style={{ gap: theme.spacing.md }}>
              <ProductionDealerBar
                label={dealerLabel}
                onPress={() => setDealerSheetOpen(true)}
                onClear={() => {
                  setStaggerListEnter(false);
                  setDealerId(null);
                  setDealerLabel(null);
                  listRef.current?.scrollToOffset({ offset: 0, animated: false });
                }}
              />
              <TextField
                value={searchInput}
                onChangeText={setSearchInput}
                placeholder={t('mobile.production.searchPlaceholder')}
                autoCorrect={false}
                autoCapitalize="none"
                returnKeyType="search"
              />
            </View>
          </View>
        }
        ListEmptyComponent={
          listQuery.isFetching && cards.length === 0 ? (
            <ProductionListSkeleton />
          ) : cards.length === 0 && !listQuery.isFetching ? (
            <EmptyState
              title={
                q
                  ? t('mobile.production.searchEmpty')
                  : t('mobile.production.emptyTitle')
              }
              description={
                dealerLabel
                  ? t('mobile.production.emptyDealerBody', { dealer: dealerLabel })
                  : q
                    ? t('mobile.production.emptySearchBody')
                    : t('mobile.production.emptyBody')
              }
            />
          ) : null
        }
        ListFooterComponent={
          listQuery.isFetchingNextPage ? (
            <AppText
              variant="caption"
              color="secondary"
              style={{ textAlign: 'center', paddingVertical: theme.spacing.md }}
            >
              {t('mobile.production.loadingMore')}
            </AppText>
          ) : null
        }
        renderItem={({ item, index }) => (
          <ListItemEnter index={index} enabled={staggerListEnter}>
            <ProductionOrderCard
              order={item}
              onPress={() => {
                void haptics.selection();
                router.push(`/(app)/(admin)/production/${item.id}` as Href);
              }}
            />
          </ListItemEnter>
        )}
      />
      <ProductionDealerSheet
        open={dealerSheetOpen}
        onClose={() => setDealerSheetOpen(false)}
        dealers={dealersQuery.data?.data ?? []}
        loading={dealersQuery.isPending && !dealersQuery.data}
        selectedId={dealerId}
        onSelect={(next) => {
          setStaggerListEnter(false);
          setDealerId(next?.id ?? null);
          setDealerLabel(next?.name ?? null);
          listRef.current?.scrollToOffset({ offset: 0, animated: false });
        }}
      />
    </AppScreen>
  );
}

function MetricRow({
  items,
  isRTL,
  selected,
  onSelect,
}: {
  items: MetricDef[];
  isRTL: boolean;
  selected: ProductionListBucket;
  onSelect: (next: ProductionListBucket) => void;
}) {
  const { colors, theme } = useTheme();
  const { locale } = useLocale();

  return (
    <View
      style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'stretch',
        gap: theme.spacing.sm,
      }}
    >
      {items.map((item) => {
        const isSelected = selected === item.key;
        const tint =
          item.accent === 'late'
            ? colors.error
            : item.accent === 'success'
              ? colors.success
              : item.accent === 'info'
                ? colors.info
                : item.accent === 'warning'
                  ? colors.warning
                  : item.accent === 'brand'
                    ? colors.brand
                    : colors.brand;
        const soft =
          item.accent === 'late'
            ? colors.errorSoft
            : item.accent === 'success'
              ? colors.successSoft
              : item.accent === 'info'
                ? colors.infoSoft
                : item.accent === 'warning'
                  ? colors.warningSoft
                  : colors.brandSoft;

        return (
          <AnimatedPressable
            key={item.key}
            variant="card"
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            accessibilityLabel={`${item.label}: ${item.value}`}
            onPress={() => onSelect(item.key)}
            style={{
              flex: 1,
              minHeight: 104,
              borderRadius: theme.radius.lg,
              paddingTop: theme.spacing.md + 4,
              paddingBottom: theme.spacing.md,
              paddingHorizontal: theme.spacing.sm,
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              backgroundColor: isSelected ? soft : colors.surface,
              borderWidth: isSelected ? 1.5 : 1,
              borderColor: isSelected ? tint : colors.borderMuted,
              overflow: 'hidden',
              ...(isSelected ? theme.elevation.rest : null),
            }}
          >
            <View
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: 3,
                backgroundColor: tint,
                opacity: isSelected ? 1 : 0.35,
              }}
            />
            <AppText
              variant="caption"
              align="center"
              numberOfLines={2}
              weight={
                isSelected
                  ? locale === 'ar'
                    ? 'medium'
                    : 'semibold'
                  : locale === 'ar'
                    ? 'regular'
                    : 'medium'
              }
              style={{
                color: isSelected ? tint : colors.textMuted,
                fontSize: 11,
                lineHeight: 14,
              }}
            >
              {item.label}
            </AppText>
            <CountUp
              value={item.value}
              variant="heading"
              color={isSelected || item.accent === 'late' ? tint : colors.textPrimary}
              accessibilityLabel={`${item.label}: ${item.value}`}
            />
          </AnimatedPressable>
        );
      })}
    </View>
  );
}
