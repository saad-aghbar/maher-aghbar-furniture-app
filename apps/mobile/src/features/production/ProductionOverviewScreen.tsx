import { useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useRouter, type Href } from 'expo-router';
import { canAny } from '@maher/permissions';
import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { OfflineBanner } from '@/components/feedback/OfflineBanner';
import { TextField } from '@/components/forms/TextField';
import { AppScreen } from '@/components/layout/AppScreen';
import { Divider } from '@/components/layout/Divider';
import { useNetwork } from '@/components/network/NetworkProvider';
import { useLocale } from '@/i18n';
import {
  AnimatedPressable,
  CountUp,
  ListItemEnter,
  haptics,
  useReducedMotion,
} from '@/motion';
import { useTheme } from '@/theme';
import { SURFACE_TAB_BAR_CLEARANCE } from '@/navigation/tabBarClearance';
import type { ProductionListBucket } from './api';
import { ProductionDealerBar } from './components/ProductionDealerBar';
import { ProductionDealerSheet } from './components/ProductionDealerSheet';
import { ProductionFilterChips } from './components/ProductionFilterChips';
import { ProductionOrderCard } from './components/ProductionOrderCard';
import { ProductionListSkeleton } from './components/ProductionSkeleton';
import {
  flattenProductionOrderPages,
  useProductionDealersQuery,
  useProductionOrdersInfiniteQuery,
  useProductionSummaryQuery,
} from './query';
import { selectProductionCard } from './selectProduction';

type MetricAccent = 'brand' | 'info' | 'success' | 'late';

type MetricKey = Exclude<ProductionListBucket, 'all'>;

type MetricDef = {
  key: MetricKey;
  label: string;
  value: number;
  accent?: MetricAccent;
};

export function ProductionOverviewScreen() {
  const { user, refreshUser } = useAuth();
  const { t, locale, isRTL } = useLocale();
  const { theme, colors } = useTheme();
  const { showOfflineBanner } = useNetwork();
  const router = useRouter();
  const reduce = useReducedMotion();
  const listRef = useRef<FlatList>(null);
  const allowed = canAny(user, ['production-order.read', 'production-task.read']);
  const canWorkflow = canAny(user, ['production.workflow.read', 'production-order.update']);

  const [bucket, setBucket] = useState<ProductionListBucket>('in_production');
  const [searchInput, setSearchInput] = useState('');
  const [q, setQ] = useState('');
  const [dealerId, setDealerId] = useState<string | null>(null);
  const [dealerLabel, setDealerLabel] = useState<string | null>(null);
  const [dealerSheetOpen, setDealerSheetOpen] = useState(false);

  // Pick up newly seeded production.workflow.* grants without forcing a full reinstall.
  useEffect(() => {
    if (!allowed) return;
    void refreshUser();
  }, [allowed, refreshUser]);

  useEffect(() => {
    const id = setTimeout(() => setQ(searchInput.trim()), 300);
    return () => clearTimeout(id);
  }, [searchInput]);

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
    !listQuery.isFetchingNextPage;

  const cards = useMemo(
    () =>
      flattenProductionOrderPages(listQuery.data).map((item) =>
        selectProductionCard(item, locale),
      ),
    [listQuery.data, locale],
  );

  const selectBucket = (next: ProductionListBucket) => {
    const isPeriod =
      next === 'daily' || next === 'weekly' || next === 'monthly';
    const resolved =
      isPeriod && next === bucket ? 'all' : next === bucket ? null : next;
    if (resolved == null) return;
    void haptics.selection();
    setBucket(resolved);
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
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
  const HeaderShell = reduce ? View : Animated.View;
  const headerEnter = reduce
    ? {}
    : { entering: FadeInDown.delay(40).duration(220) };

  const topMetrics: MetricDef[] | null = summary
    ? [
        {
          key: 'daily',
          label: t('mobile.production.daily'),
          value: summary.dailyProduction,
        },
        {
          key: 'weekly',
          label: t('mobile.production.weekly'),
          value: summary.weeklyProduction,
        },
        {
          key: 'monthly',
          label: t('mobile.production.monthly'),
          value: summary.monthlyProduction,
        },
      ]
    : null;

  const floorMetrics: MetricDef[] | null = summary
    ? [
        {
          key: 'in_production',
          label: t('mobile.production.inProduction'),
          value: summary.inProduction,
          accent: 'info',
        },
        {
          key: 'late',
          label: t('mobile.production.lateOrders'),
          value: summary.lateOrders,
          accent: summary.lateOrders > 0 ? 'late' : undefined,
        },
        {
          key: 'completed',
          label: t('mobile.production.completed'),
          value: summary.completedOrders,
          accent: 'success',
        },
      ]
    : null;

  const boardShadow = theme.elevation.raised;

  return (
    <AppScreen>
      {showOfflineBanner ? <OfflineBanner /> : null}
      <FlatList
        ref={listRef}
        data={cards}
        keyExtractor={(item) => item.id}
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
          <HeaderShell
            {...headerEnter}
            style={{ gap: theme.spacing.lg, marginBottom: theme.spacing.sm }}
          >
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

            {topMetrics && floorMetrics ? (
              <View style={[{ borderRadius: theme.radius.xl }, boardShadow]}>
                <View
                  style={{
                    borderRadius: theme.radius.xl,
                    borderWidth: StyleSheet.hairlineWidth,
                    borderColor: colors.borderStrong,
                    backgroundColor: colors.surface,
                    overflow: 'hidden',
                  }}
                >
                  <View
                    style={{
                      height: 3,
                      backgroundColor: colors.brand,
                      opacity: 0.55,
                    }}
                  />
                  <MetricRow
                    isRTL={isRTL}
                    items={topMetrics}
                    selected={bucket}
                    onSelect={selectBucket}
                  />
                  <Divider compact />
                  <MetricRow
                    isRTL={isRTL}
                    items={floorMetrics}
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
                  setDealerId(null);
                  setDealerLabel(null);
                  listRef.current?.scrollToOffset({ offset: 0, animated: true });
                }}
              />
              <ProductionFilterChips value={bucket} onChange={selectBucket} />
              <Divider compact />
              <TextField
                value={searchInput}
                onChangeText={setSearchInput}
                placeholder={t('mobile.production.searchPlaceholder')}
                autoCorrect={false}
                autoCapitalize="none"
                returnKeyType="search"
              />
            </View>
          </HeaderShell>
        }
        ListEmptyComponent={
          listQuery.isFetching ? (
            <ProductionListSkeleton />
          ) : (
            <EmptyState
              title={t('mobile.production.emptyTitle')}
              description={
                dealerLabel
                  ? t('mobile.production.emptyDealerBody', { dealer: dealerLabel })
                  : q
                    ? t('mobile.production.emptySearchBody')
                    : t('mobile.production.emptyBody')
              }
            />
          )
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
          <ListItemEnter index={index}>
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
          setDealerId(next?.id ?? null);
          setDealerLabel(next?.name ?? null);
          listRef.current?.scrollToOffset({ offset: 0, animated: true });
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
      }}
    >
      {items.map((item, index) => {
        const isSelected = selected === item.key;
        const tint =
          item.accent === 'late'
            ? colors.error
            : item.accent === 'success'
              ? colors.success
              : item.accent === 'info'
                ? colors.info
                : item.accent === 'brand'
                  ? colors.brand
                  : isSelected
                    ? colors.brand
                    : colors.textPrimary;
        const soft =
          item.accent === 'late' && !isSelected
            ? colors.errorSoft
            : isSelected
              ? colors.brandSoft
              : colors.surface;

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
              paddingVertical: theme.spacing.lg,
              paddingHorizontal: theme.spacing.sm,
              alignItems: 'center',
              justifyContent: 'center',
              gap: theme.spacing.xs,
              minHeight: 92,
              backgroundColor: soft,
              borderLeftWidth:
                !isRTL && index > 0 ? StyleSheet.hairlineWidth : 0,
              borderRightWidth:
                isRTL && index > 0 ? StyleSheet.hairlineWidth : 0,
              borderColor: colors.border,
            }}
          >
            {isSelected ? (
              <View
                style={{
                  position: 'absolute',
                  top: 0,
                  left: theme.spacing.md,
                  right: theme.spacing.md,
                  height: 2,
                  borderRadius: 1,
                  backgroundColor: tint,
                }}
              />
            ) : null}
            <AppText
              variant="caption"
              color={isSelected ? 'brand' : 'muted'}
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
            >
              {item.label}
            </AppText>
            <CountUp
              value={item.value}
              variant="heading"
              color={tint}
              accessibilityLabel={`${item.label}: ${item.value}`}
            />
          </AnimatedPressable>
        );
      })}
    </View>
  );
}
