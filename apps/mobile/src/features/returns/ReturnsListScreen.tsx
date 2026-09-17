import { useEffect, useMemo, useState } from 'react';
import { FlatList, RefreshControl, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { canAny } from '@maher/permissions';
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
import {
  StatementDateSheet,
  StatementDateTrigger,
} from '@/features/account/components/StatementDateSheet';
import {
  datePresetRange,
  type StatementDatePreset,
  type StatementPdfRange,
} from '@/features/account/selectStatement';
import { useLocale } from '@/i18n';
import { haptics, ListItemEnter, AnimatedPressable } from '@/motion';
import { resolveAppFontStyle, useTheme } from '@/theme';
import { ReturnBoardCard } from './components/ReturnBoardCard';
import { ReturnsDealerSheet } from './components/ReturnsDealerSheet';
import { ReturnsFilterTriggers } from './components/ReturnsFilterTriggers';
import { ReturnsStatusFilterSheet } from './components/ReturnsStatusFilterSheet';
import { ReturnsStatusRail } from './components/ReturnsStatusRail';
import { returnCtaStyle } from './components/returnFloorCta';
import {
  isReturnStatusFilterActive,
  type ReturnStatusFilter,
  type ReturnsDealerOption,
} from './returnFilters';
import { flattenReturns, useReturnsInfiniteQuery } from './query';
import {
  filterDealerReturnCards,
  returnMatchesStatusChip,
  selectDealerReturnHub,
  selectReturnCard,
} from './selectReturn';
import { AppTextInput } from '@/components/forms/AppTextInput';
import { useSurfaceClearance } from '@/adaptive/useSurfaceClearance';

type Props = {
  detailHref: (id: string) => Href;
  createHref?: Href;
  canCreate?: boolean;
  /** Admin: show dealer filter. */
  adminControls?: boolean;
  backFallback?: Href;
  selectedReturnId?: string;
  onSelectReturn?: (id: string) => void;
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
  const subtitle = adminControls ? t('mobile.returns.adminSubtitle') : null;

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
      {subtitle ? (
        <AppText
          variant="caption"
          color="muted"
          align="center"
          style={{ paddingHorizontal: theme.spacing.lg }}
        >
          {subtitle}
        </AppText>
      ) : null}
    </View>
  );
}

export function ReturnsListScreen({
  detailHref,
  createHref,
  canCreate,
  adminControls = false,
  backFallback = '/(app)/(admin)/(tabs)' as Href,
  selectedReturnId,
  onSelectReturn,
}: Props) {
  const { user } = useAuth();
  const { t, locale, isRTL } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const insets = useSafeAreaInsets();
  const surfaceClearance = useSurfaceClearance();
  const { showOfflineBanner } = useNetwork();
  const router = useRouter();
  const params = useLocalSearchParams<{ chip?: string; physical?: string }>();
  const allowed = canAny(user, ['return.read', 'sales-order.read']);
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const dealerSurface = !adminControls;

  const [chip, setChip] = useState<ReturnStatusFilter>('ALL');
  const [physicalPhase, setPhysicalPhase] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [datePreset, setDatePreset] = useState<StatementDatePreset>('all');
  const [customRange, setCustomRange] = useState<StatementPdfRange>({});
  const [dateSheetOpen, setDateSheetOpen] = useState(false);
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

  const dateRange = useMemo(
    () => datePresetRange(datePreset, new Date(), customRange),
    [datePreset, customRange],
  );

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

  const allCards = useMemo(
    () => flattenReturns(query.data).map((r) => selectReturnCard(r, locale)),
    [query.data, locale],
  );
  const datedCards = useMemo(
    () =>
      filterDealerReturnCards(allCards, {
        dateFrom: dateRange.dateFrom,
        dateTo: dateRange.dateTo,
      }),
    [allCards, dateRange.dateFrom, dateRange.dateTo],
  );
  const hub = useMemo(() => selectDealerReturnHub(datedCards), [datedCards]);
  const cards = useMemo(() => {
    const matchChip = physicalPhase ?? chip;
    return datedCards.filter((r) =>
      returnMatchesStatusChip(
        {
          approvalStatus: r.approvalStatus,
          physicalStatus: r.physicalStatus,
          inventoryFate: r.inventoryFate,
        },
        matchChip,
      ),
    );
  }, [datedCards, chip, physicalPhase]);
  const filtersActive =
    chip !== 'ALL' ||
    Boolean(physicalPhase) ||
    datePreset !== 'all' ||
    search.trim().length > 0;

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
            surfaceClearance + theme.spacing['3xl'],
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

            {canCreate && createHref && !dealerSurface ? (
              <PrimaryButton
                label={t('mobile.returns.newReturn')}
                onPress={() => {
                  void haptics.selection();
                  router.push(createHref);
                }}
                style={returnCtaStyle(theme)}
              />
            ) : null}

            {dealerSurface ? (
              <View style={{ gap: theme.spacing.md }}>
                <View
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
                    <AppText
                      variant="caption"
                      weight="semibold"
                      style={{ color: colors.brand }}
                      numberOfLines={1}
                    >
                      {t('mobile.returns.hubEyebrow')}
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
                        gap: theme.spacing.md,
                      }}
                    >
                      <HubStamp
                        label={t('mobile.returns.hubOpen')}
                        value={String(hub.open)}
                        warning={hub.open > 0}
                        selected={chip === 'PENDING'}
                        onPress={() => {
                          void haptics.selection();
                          setPhysicalPhase(null);
                          setChip(chip === 'PENDING' ? 'ALL' : 'PENDING');
                        }}
                      />
                      <HubStamp
                        label={t('mobile.returns.hubInProgress')}
                        value={String(hub.inProgress)}
                        warning={hub.inProgress > 0}
                        selected={chip === 'APPROVED'}
                        onPress={() => {
                          void haptics.selection();
                          setPhysicalPhase(null);
                          setChip(chip === 'APPROVED' ? 'ALL' : 'APPROVED');
                        }}
                      />
                    </View>
                    <AppText
                      variant="caption"
                      color="muted"
                      style={{ textAlign: isRTL ? 'right' : 'left' }}
                    >
                      {t('mobile.returns.hubCaption', { resolved: String(hub.resolved) })}
                    </AppText>
                    <AppText
                      variant="caption"
                      color="muted"
                      style={{ textAlign: isRTL ? 'right' : 'left' }}
                    >
                      {t('mobile.returns.hubHint')}
                    </AppText>
                    {canCreate && createHref ? (
                      <PrimaryButton
                        label={t('mobile.returns.newReturn')}
                        onPress={() => {
                          void haptics.selection();
                          router.push(createHref);
                        }}
                        style={returnCtaStyle(theme)}
                      />
                    ) : null}
                  </View>
                </View>

                <View
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
                    <StatementDateTrigger
                      value={datePreset}
                      customFrom={customRange.from}
                      customTo={customRange.to}
                      onPress={() => setDateSheetOpen(true)}
                    />
                  </View>
                </View>

                <View
                  style={{
                    flexDirection: isRTL ? 'row-reverse' : 'row',
                    alignItems: 'baseline',
                    justifyContent: 'space-between',
                    gap: theme.spacing.sm,
                  }}
                >
                  <AppText variant="label" weight={titleWeight}>
                    {t('mobile.returns.title')}
                  </AppText>
                  <AppText variant="caption" color="muted">
                    {t('mobile.returns.count', { count: String(cards.length) })}
                  </AppText>
                </View>
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
              title={
                filtersActive
                  ? t('mobile.returns.emptyFilter')
                  : t('mobile.returns.emptyTitle')
              }
              body={
                filtersActive
                  ? t('mobile.returns.emptyFilterHint')
                  : t('mobile.returns.emptyBody')
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
              onPress={() =>
                onSelectReturn ? onSelectReturn(item.id) : router.push(detailHref(item.id))
              }
            />
          </ListItemEnter>
        )}
      />

      {dealerSurface ? (
        <StatementDateSheet
          open={dateSheetOpen}
          onClose={() => setDateSheetOpen(false)}
          value={datePreset}
          customFrom={customRange.from}
          customTo={customRange.to}
          onChange={(next, range) => {
            setDatePreset(next);
            setCustomRange(next === 'custom' ? (range ?? {}) : {});
          }}
        />
      ) : null}

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

function HubStamp({
  label,
  value,
  warning,
  selected,
  onPress,
}: {
  label: string;
  value: string;
  warning?: boolean;
  selected?: boolean;
  onPress: () => void;
}) {
  const { locale } = useLocale();
  const { colors, theme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  return (
    <AnimatedPressable
      variant="button"
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={{
        flex: 1,
        minWidth: 0,
        gap: 6,
        padding: theme.spacing.md,
        borderRadius: theme.radius.lg,
        backgroundColor: warning ? colors.warningSoft : colors.surfaceSecondary,
        borderWidth: 1,
        borderColor: selected
          ? colors.brand
          : warning
            ? `${colors.warning}55`
            : colors.border,
        overflow: 'hidden',
      }}
    >
      {selected ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: 3,
            backgroundColor: colors.brand,
          }}
        />
      ) : null}
      <AppText
        variant="caption"
        color="muted"
        style={{
          textTransform: locale === 'ar' ? 'none' : 'uppercase',
          letterSpacing: locale === 'ar' ? 0 : 0.55,
          fontSize: 11,
          textAlign: 'center',
        }}
      >
        {label}
      </AppText>
      <AppText
        weight={titleWeight}
        dir="ltr"
        numberOfLines={1}
        style={{
          textAlign: 'center',
          fontVariant: ['tabular-nums'],
          fontSize: 28,
          lineHeight: locale === 'ar' ? 40 : 32,
          color: warning ? colors.warning : colors.textPrimary,
        }}
      >
        {value}
      </AppText>
    </AnimatedPressable>
  );
}
