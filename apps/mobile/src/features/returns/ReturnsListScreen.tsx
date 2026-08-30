import { useEffect, useMemo, useState } from 'react';
import { FlatList, RefreshControl, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { can } from '@maher/permissions';
import { localizedName } from '@maher/i18n';
import { listCustomers } from '@/api/modules/customers';
import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { OfflineBanner } from '@/components/feedback/OfflineBanner';
import { SearchBarShell } from '@/components/forms/SearchBarShell';
import { AppScreen } from '@/components/layout/AppScreen';
import { ScreenBackLead } from '@/components/layout/ScreenBackLead';
import { useNetwork } from '@/components/network/NetworkProvider';
import { DealerEmptyState, DealerSearchBar } from '@/features/dealer-ui';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { haptics, ListItemEnter } from '@/motion';
import { SURFACE_TAB_BAR_CLEARANCE } from '@/navigation/tabBarClearance';
import { resolveAppFontStyle, useTheme } from '@/theme';
import { ReturnBoardCard } from './components/ReturnBoardCard';
import { ReturnsDealerSheet } from './components/ReturnsDealerSheet';
import { ReturnsFilterTriggers } from './components/ReturnsFilterTriggers';
import { ReturnsStatusFilterSheet } from './components/ReturnsStatusFilterSheet';
import { ReturnsStatusRail } from './components/ReturnsStatusRail';
import {
  isReturnStatusFilterActive,
  type ReturnStatusFilter,
  type ReturnsDealerOption,
} from './returnFilters';
import { flattenReturns, useReturnsInfiniteQuery } from './query';
import { returnMatchesStatusChip, selectReturnCard } from './selectReturn';
import { AppTextInput } from '@/components/forms/AppTextInput';

type Props = {
  detailHref: (id: string) => Href;
  createHref?: Href;
  canCreate?: boolean;
  /** Admin: show dealer filter. */
  adminControls?: boolean;
  backFallback?: Href;
};

function ReturnsScreenTitle({
  backFallback,
  titleWeight,
  adminControls,
}: {
  backFallback: Href;
  titleWeight: 'medium' | 'semibold';
  adminControls?: boolean;
}) {
  const { t, isRTL } = useLocale();
  const { theme } = useTheme();
  const leadSize = theme.sizes.touch.min;
  const title = t('mobile.returns.title');
  const subtitle = adminControls
    ? t('mobile.returns.adminSubtitle')
    : t('mobile.returns.subtitle');

  return (
    <View style={{ gap: theme.spacing.xs }}>
      <View style={{ minHeight: leadSize, justifyContent: 'center' }}>
        <View
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            ...(isRTL ? { right: 0 } : { left: 0 }),
            zIndex: 1,
            justifyContent: 'center',
          }}
        >
          <ScreenBackLead fallback={backFallback} />
        </View>
        <AppText
          variant="largeTitle"
          weight={titleWeight}
          align="center"
          numberOfLines={1}
          style={{ paddingHorizontal: leadSize + theme.spacing.sm }}
        >
          {title}
        </AppText>
      </View>
      <AppText
        variant="caption"
        color="muted"
        align="center"
        style={{ paddingHorizontal: theme.spacing.lg }}
      >
        {subtitle}
      </AppText>
    </View>
  );
}

export function ReturnsListScreen({
  detailHref,
  createHref,
  canCreate,
  adminControls = false,
  backFallback = '/(app)/(admin)/(tabs)' as Href,
}: Props) {
  const { user } = useAuth();
  const { t, locale, isRTL } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const insets = useSafeAreaInsets();
  const { showOfflineBanner } = useNetwork();
  const router = useRouter();
  const params = useLocalSearchParams<{ chip?: string; physical?: string }>();
  const allowed = can(user, 'sales-order.read');
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const dealerSurface = !adminControls;

  const [chip, setChip] = useState<ReturnStatusFilter>('ALL');
  const [physicalPhase, setPhysicalPhase] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [dealerLabel, setDealerLabel] = useState<string | null>(null);
  const [dealerSheetOpen, setDealerSheetOpen] = useState(false);
  const [statusSheetOpen, setStatusSheetOpen] = useState(false);

  useEffect(() => {
    const physical = String(params.physical ?? '').trim();
    const rawChip = String(params.chip ?? '').trim();
    if (physical === 'WAITING_RETURN' || physical === 'RETURNED') {
      setPhysicalPhase(physical);
      setChip('ALL');
      return;
    }
    if (rawChip === 'WAITING_RETURN' || rawChip === 'RETURNED') {
      setPhysicalPhase(rawChip);
      setChip('ALL');
      return;
    }
    if (
      rawChip === 'PENDING' ||
      rawChip === 'APPROVED' ||
      rawChip === 'REJECTED' ||
      rawChip === 'ALL'
    ) {
      setPhysicalPhase(null);
      setChip(rawChip);
    }
  }, [params.chip, params.physical]);

  useEffect(() => {
    const id = setTimeout(() => setQ(search.trim()), 300);
    return () => clearTimeout(id);
  }, [search]);

  const customersQuery = useQuery({
    queryKey: ['returns-customers'],
    queryFn: () => listCustomers({ page: 1, pageSize: 100 }),
    enabled: allowed && adminControls,
  });

  const query = useReturnsInfiniteQuery(
    {
      q: q || undefined,
      customerId: customerId || undefined,
    },
    allowed,
  );

  const cards = useMemo(() => {
    const matchChip = physicalPhase ?? chip;
    return flattenReturns(query.data)
      .filter((r) => returnMatchesStatusChip(r, matchChip))
      .map((r) => selectReturnCard(r, locale));
  }, [query.data, chip, locale, physicalPhase]);

  const dealerOptions: ReturnsDealerOption[] = useMemo(() => {
    return (customersQuery.data?.data ?? []).map((d) => {
      const name = localizedName(
        locale,
        {
          name: d.name,
          nameEn: d.nameEn,
          nameAr: d.nameAr,
          nameHe: d.nameHe,
        },
        d.code,
      );
      return {
        id: d.id,
        name,
        code: d.code,
        searchText: [d.name, d.nameEn, d.nameAr, d.nameHe, d.code]
          .filter(Boolean)
          .join(' '),
      };
    });
  }, [customersQuery.data?.data, locale]);

  const searchPlaceholder = t('mobile.returns.search');

  const statusLabel = physicalPhase
    ? physicalPhase
    : isReturnStatusFilterActive(chip)
      ? dealerSurface
        ? t(`mobile.returns.dealerChips.${chip}`)
        : t(`mobile.returns.chips.${chip}`)
      : t('common.filter');

  if (!allowed) {
    return (
      <AppScreen>
        <ReturnsScreenTitle
          backFallback={backFallback}
          titleWeight={titleWeight}
          adminControls={adminControls}
        />
        <EmptyState title={t('mobile.noModules')} description={t('mobile.noModulesHint')} />
      </AppScreen>
    );
  }

  if (query.isError && !query.data) {
    return (
      <AppScreen>
        <ReturnsScreenTitle
          backFallback={backFallback}
          titleWeight={titleWeight}
          adminControls={adminControls}
        />
        {showOfflineBanner ? <OfflineBanner /> : null}
        <ErrorState
          title={t('mobile.returns.errorTitle')}
          description={t('mobile.returns.errorBody')}
          retryLabel={t('mobile.returns.retry')}
          onRetry={() => void query.refetch()}
        />
      </AppScreen>
    );
  }

  if (query.isLoading && !query.data) {
    return (
      <AppScreen>
        <ReturnsScreenTitle backFallback={backFallback} titleWeight={titleWeight} />
        {showOfflineBanner ? <OfflineBanner /> : null}
        <AppText variant="caption" color="muted" align="center" style={{ marginTop: theme.spacing.xl }}>
          {t('mobile.returns.loading')}
        </AppText>
      </AppScreen>
    );
  }

  return (
    <AppScreen>
      {showOfflineBanner ? <OfflineBanner /> : null}
      <FlatList
        data={cards}
        keyExtractor={(item) => item.id}
        style={{ flex: 1 }}
        contentContainerStyle={{
          gap: theme.spacing.md,
          flexGrow: 1,
          paddingBottom:
            insets.bottom + SURFACE_TAB_BAR_CLEARANCE + theme.spacing['3xl'],
        }}
        refreshControl={
          <RefreshControl
            refreshing={query.isRefetching && !query.isFetchingNextPage}
            onRefresh={() => void query.refetch()}
            tintColor={colors.brand}
          />
        }
        onEndReached={() => {
          if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
        }}
        ListHeaderComponent={
          <View style={{ gap: theme.spacing.md, marginBottom: theme.spacing.sm }}>
            <ReturnsScreenTitle
          backFallback={backFallback}
          titleWeight={titleWeight}
          adminControls={adminControls}
        />

            {canCreate && createHref ? (
              <PrimaryButton
                label={t('mobile.returns.newReturn')}
                onPress={() => {
                  void haptics.selection();
                  router.push(createHref);
                }}
                style={{ borderRadius: theme.radius.xl }}
              />
            ) : null}

            {dealerSurface ? (
              <View style={{ gap: theme.spacing.md }}>
                <DealerSearchBar
                  value={search}
                  onChangeText={setSearch}
                  placeholder={searchPlaceholder}
                />
                <ReturnsStatusRail
                  value={chip}
                  onChange={(next) => {
                    setPhysicalPhase(null);
                    setChip(next);
                  }}
                />
              </View>
            ) : (
              <View
                style={{
                  borderRadius: theme.radius.xl,
                  borderWidth: 1,
                  borderColor: colors.borderStrong,
                  backgroundColor: colors.surface,
                  padding: theme.spacing.md,
                  gap: theme.spacing.md,
                  ...orderBoardShadow(colorScheme),
                }}
              >
                <SearchBarShell>
                  <AppTextInput
                    value={search}
                    onChangeText={setSearch}
                    placeholder={searchPlaceholder}
                    placeholderTextColor={colors.textMuted}
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="search"
                    clearButtonMode="while-editing"
                    style={{
                      flex: 1,
                      minWidth: 0,
                      paddingVertical: theme.spacing.sm,
                      fontSize: 16,
                      color: colors.textPrimary,
                      textAlign: isRTL ? 'right' : 'left',
                      ...resolveAppFontStyle(locale, { variant: 'body' }),
                    }}
                  />
                </SearchBarShell>

                <ReturnsFilterTriggers
                  showDealers={adminControls}
                  dealerLabel={dealerLabel}
                  onOpenDealers={() => setDealerSheetOpen(true)}
                  onClearDealer={() => {
                    setCustomerId(null);
                    setDealerLabel(null);
                  }}
                  statusActive={isReturnStatusFilterActive(chip)}
                  statusLabel={statusLabel}
                  onOpenStatus={() => setStatusSheetOpen(true)}
                />
              </View>
            )}
          </View>
        }
        ListEmptyComponent={
          dealerSurface ? (
            <DealerEmptyState
              title={t('mobile.returns.emptyTitle')}
              body={t('mobile.returns.emptyBody')}
              actionLabel={canCreate && createHref ? t('mobile.returns.newReturn') : undefined}
              onAction={
                canCreate && createHref
                  ? () => router.push(createHref)
                  : undefined
              }
            />
          ) : (
            <EmptyState
              title={t('mobile.returns.emptyTitle')}
              description={
                customerId
                  ? t('mobile.returns.emptyBody')
                  : t('mobile.returns.emptyBody')
              }
            />
          )
        }
        renderItem={({ item, index }) => (
          <ListItemEnter index={index}>
            <ReturnBoardCard
              item={item}
              dealerFacing={dealerSurface}
              onPress={() => router.push(detailHref(item.id))}
            />
          </ListItemEnter>
        )}
      />

      {adminControls ? (
        <ReturnsDealerSheet
          open={dealerSheetOpen}
          onClose={() => setDealerSheetOpen(false)}
          dealers={dealerOptions}
          selectedId={customerId}
          onConfirm={(dealer) => {
            setCustomerId(dealer?.id ?? null);
            setDealerLabel(dealer?.name ?? null);
          }}
        />
      ) : null}

      {adminControls ? (
        <ReturnsStatusFilterSheet
          open={statusSheetOpen}
          onClose={() => setStatusSheetOpen(false)}
          status={chip}
          onApply={(next) => {
            setPhysicalPhase(null);
            setChip(next);
          }}
        />
      ) : null}
    </AppScreen>
  );
}
