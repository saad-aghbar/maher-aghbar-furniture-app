import { useEffect, useMemo, useState } from 'react';
import { RefreshControl, SectionList, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { can } from '@maher/permissions';
import { localizedName } from '@maher/i18n';
import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { OfflineBanner } from '@/components/feedback/OfflineBanner';
import { useToast } from '@/components/feedback/Toast';
import { SearchBarShell } from '@/components/forms/SearchBarShell';
import { AppScreen } from '@/components/layout/AppScreen';
import { ScreenBackLead } from '@/components/layout/ScreenBackLead';
import { useNetwork } from '@/components/network/NetworkProvider';
import {
  DealerEmptyState,
  DealerSearchBar,
} from '@/features/dealer-ui';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { SupplierInvoiceBoardCard } from '@/features/purchasing/components/SupplierInvoiceBoardCard';
import {
  flattenSupplierInvoices,
  useSupplierInvoicesInfiniteQuery,
  useSuppliersQuery,
} from '@/features/purchasing/query';
import { selectSupplierInvoiceCard } from '@/features/purchasing/selectPurchase';
import type { SupplierInvoiceCardModel } from '@/features/purchasing/selectPurchase';
import { openInvoicePdf } from './api';
import { usePdfDownload } from '@/features/pdf/usePdfDownload';
import { CreateInvoiceSheet } from './components/CreateInvoiceSheet';
import { InvoiceBoardCard } from './components/InvoiceBoardCard';
import { InvoicePartySheet } from './components/InvoicePartySheet';
import { InvoiceFilterTriggers } from './components/InvoiceFilterTriggers';
import { InvoiceStatusFilterSheet } from './components/InvoiceStatusFilterSheet';
import { InvoicePurchasingRail } from './components/InvoicePurchasingRail';
import { InvoicesTabBar } from './components/InvoicesTabBar';
import {
  invoiceDeskEmptyKeys,
  isInvoiceStatusFilterActive,
  parseInvoiceDeskTab,
  partyFilterFallbackKey,
  partySegmentsForDesk,
  partySelectionAppliesToDesk,
  type InvoiceDealerOption,
  type InvoiceDeskTab,
  type InvoicePartySelection,
  type InvoicePurchasingKind,
  type InvoiceStatusFilter,
} from './invoiceFilters';
import { useLocale } from '@/i18n';
import { haptics, ListItemEnter } from '@/motion';
import { resolveAppFontStyle, useTheme } from '@/theme';
import {
  flattenInvoices,
  useInvoiceCustomersQuery,
  useInvoicesInfiniteQuery,
} from './query';
import { selectInvoiceCard, type InvoiceCardModel } from './selectInvoice';
import { AppTextInput } from '@/components/forms/AppTextInput';
import { useSurfaceClearance } from '@/adaptive/useSurfaceClearance';

type Props = {
  detailHref: (id: string) => Href;
  backFallback?: Href;
  /** When true, show create CTA + dealer filter (admin). */
  adminControls?: boolean;
  /** Admin purchasing invoice detail route. */
  purchasingDetailHref?: (id: string) => Href;
  selectedInvoiceId?: string;
  onSelectInvoice?: (id: string) => void;
};

type SectionItem =
  | { kind: 'order'; card: InvoiceCardModel }
  | { kind: 'purchase'; card: SupplierInvoiceCardModel };

type InvoiceSection = {
  key: 'orders' | 'returns' | 'purchasing';
  title: string;
  data: SectionItem[];
};

function InvoicesScreenTitle({
  backFallback,
  titleWeight,
}: {
  backFallback: Href;
  titleWeight: 'medium' | 'semibold';
}) {
  const { t, isRTL } = useLocale();
  const { theme } = useTheme();
  const leadSize = theme.sizes.touch.min;

  return (
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
        {t('mobile.invoices.title')}
      </AppText>
    </View>
  );
}

export function InvoicesListScreen({
  detailHref,
  backFallback = '/(app)/(admin)/(tabs)' as Href,
  adminControls = false,
  purchasingDetailHref = (id) =>
    `/(app)/(admin)/purchasing/supplier-invoices/${id}` as Href,
  selectedInvoiceId,
  onSelectInvoice,
}: Props) {
  const { user } = useAuth();
  const { t, locale, isRTL } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const insets = useSafeAreaInsets();
  const surfaceClearance = useSurfaceClearance();
  const { showOfflineBanner } = useNetwork();
  const { showToast } = useToast();
  const router = useRouter();
  const params = useLocalSearchParams<{ chip?: string; section?: string }>();
  const allowed = can(user, 'invoice.read');
  const canReadPurchasing = adminControls && can(user, 'supplier-invoice.read');
  const canCreate = adminControls && can(user, 'invoice.create');
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const dealerSurface = !adminControls;

  const [desk, setDesk] = useState<InvoiceDeskTab>('all');
  const [purchasingKind, setPurchasingKind] = useState<InvoicePurchasingKind>('FABRIC');
  const [chip, setChip] = useState<InvoiceStatusFilter>('ALL');
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [party, setParty] = useState<InvoicePartySelection | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [partySheetOpen, setPartySheetOpen] = useState(false);
  const [statusSheetOpen, setStatusSheetOpen] = useState(false);
  const { pickPdfOptions, pdfDownloadSheet } = usePdfDownload();

  useEffect(() => {
    const fromSection = parseInvoiceDeskTab(params.section);
    if (fromSection) {
      if (fromSection === 'purchasing' && !canReadPurchasing) return;
      setDesk(fromSection);
    }
    const raw = String(params.chip ?? '').trim().toUpperCase();
    if (!raw) return;
    const fromChip = parseInvoiceDeskTab(raw.toLowerCase());
    if (fromChip && raw !== 'ALL') {
      if (fromChip === 'purchasing' && !canReadPurchasing) return;
      setDesk(fromChip);
      return;
    }
    if (raw === 'OVERDUE' || raw === 'DRAFT' || raw === 'PAID' || raw === 'ISSUED' || raw === 'PARTIALLY_PAID') {
      setChip(raw as InvoiceStatusFilter);
      return;
    }
    if (raw === 'OPEN') setChip('ISSUED');
    if (raw === 'PARTIAL') setChip('PARTIALLY_PAID');
  }, [canReadPurchasing, params.chip, params.section]);

  useEffect(() => {
    const id = setTimeout(() => setQ(search.trim()), 300);
    return () => clearTimeout(id);
  }, [search]);

  useEffect(() => {
    if (!partySelectionAppliesToDesk(party, desk)) setParty(null);
  }, [desk, party]);

  const customersQuery = useInvoiceCustomersQuery(adminControls);
  const suppliersQuery = useSuppliersQuery(adminControls && canReadPurchasing, {
    status: 'ACTIVE',
  });
  const partySegments = partySegmentsForDesk(desk);
  const partyFallbackKey = partyFilterFallbackKey(desk);
  const hideCustomerSections = party?.kind === 'suppliers';
  const hidePurchasingSection = party?.kind === 'dealers';
  const showCustomerInvoices = desk !== 'purchasing' && !hideCustomerSections;
  const showOrdersQuery = showCustomerInvoices && desk !== 'returns';
  const showReturnsQuery = showCustomerInvoices && desk !== 'orders';
  const showPurchasing =
    canReadPurchasing &&
    (desk === 'all' || desk === 'purchasing') &&
    !hidePurchasingSection;
  const invoiceFilters = {
    q: q || undefined,
    status: chip === 'ALL' || chip === 'OVERDUE' ? undefined : chip,
    overdue: chip === 'OVERDUE' ? true : undefined,
    customerId: party?.kind === 'dealers' ? party.id : undefined,
  };
  const ordersQuery = useInvoicesInfiniteQuery(
    { ...invoiceFilters, kind: 'ORDER' },
    allowed && showOrdersQuery,
  );
  const returnsQuery = useInvoicesInfiniteQuery(
    { ...invoiceFilters, kind: 'RETURN' },
    allowed && showReturnsQuery,
  );
  const purchasingQuery = useSupplierInvoicesInfiniteQuery(
    {
      q: q || undefined,
      status: chip === 'ALL' ? undefined : chip,
      materialKind: desk === 'purchasing' ? purchasingKind : undefined,
      supplierId: party?.kind === 'suppliers' ? party.id : undefined,
    },
    showPurchasing,
  );
  const orderCards = useMemo(
    () =>
      showOrdersQuery
        ? flattenInvoices(ordersQuery.data).map((inv) => selectInvoiceCard(inv, locale))
        : [],
    [locale, ordersQuery.data, showOrdersQuery],
  );
  const returnCards = useMemo(
    () =>
      showReturnsQuery
        ? flattenInvoices(returnsQuery.data).map((inv) => selectInvoiceCard(inv, locale))
        : [],
    [locale, returnsQuery.data, showReturnsQuery],
  );
  const purchaseCards = useMemo(
    () =>
      showPurchasing
        ? flattenSupplierInvoices(purchasingQuery.data).map((inv) =>
            selectSupplierInvoiceCard(inv, locale),
          )
        : [],
    [showPurchasing, purchasingQuery.data, locale],
  );

  const sections: InvoiceSection[] = useMemo(() => {
    const orderSection: InvoiceSection = {
      key: 'orders',
      title: t('mobile.invoices.sectionOrders'),
      data: orderCards.map((card) => ({ kind: 'order' as const, card })),
    };
    const returnSection: InvoiceSection = {
      key: 'returns',
      title: t('mobile.invoices.sectionReturns'),
      data: returnCards.map((card) => ({ kind: 'order' as const, card })),
    };
    const purchaseSection: InvoiceSection = {
      key: 'purchasing',
      title: t('mobile.invoices.sectionPurchasing'),
      data: purchaseCards.map((card) => ({ kind: 'purchase' as const, card })),
    };
    if (desk === 'orders') return [orderSection];
    if (desk === 'returns') return [returnSection];
    if (desk === 'purchasing') return [purchaseSection];
    const next: InvoiceSection[] = [];
    if (!hideCustomerSections) next.push(orderSection, returnSection);
    if (showPurchasing) next.push(purchaseSection);
    return next;
  }, [desk, hideCustomerSections, orderCards, purchaseCards, returnCards, showPurchasing, t]);

  const isEmpty =
    orderCards.length === 0 &&
    returnCards.length === 0 &&
    (!showPurchasing || purchaseCards.length === 0);

  const dealerOptions: InvoiceDealerOption[] = useMemo(() => {
    const rows = customersQuery.data?.data ?? [];
    return rows.map((d) => {
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
      const searchText = [d.name, d.nameEn, d.nameAr, d.nameHe, d.code]
        .filter(Boolean)
        .join(' ');
      return { id: d.id, name, code: d.code, searchText };
    });
  }, [customersQuery.data?.data, locale]);

  const supplierOptions: InvoiceDealerOption[] = useMemo(() => {
    const rows = suppliersQuery.data?.data ?? [];
    return rows.map((d) => {
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
      const searchText = [d.name, d.nameEn, d.nameAr, d.nameHe, d.code]
        .filter(Boolean)
        .join(' ');
      return { id: d.id, name, code: d.code, searchText };
    });
  }, [locale, suppliersQuery.data?.data]);

  const emptyCopy = invoiceDeskEmptyKeys(desk, purchasingKind);

  const statusLabel = isInvoiceStatusFilterActive(chip)
    ? t(`mobile.invoices.chips.${chip}`)
    : t('common.filter');

  if (!allowed) {
    return (
      <AppScreen>
        <InvoicesScreenTitle backFallback={backFallback} titleWeight={titleWeight} />
        <EmptyState title={t('mobile.noModules')} description={t('mobile.noModulesHint')} />
      </AppScreen>
    );
  }

  const customerListQuery = desk === 'returns' ? returnsQuery : ordersQuery;
  if (customerListQuery.isError && !customerListQuery.data) {
    return (
      <AppScreen>
        <InvoicesScreenTitle backFallback={backFallback} titleWeight={titleWeight} />
        {showOfflineBanner ? <OfflineBanner /> : null}
        <ErrorState
          title={t('mobile.invoices.errorTitle')}
          description={t('mobile.invoices.errorBody')}
          retryLabel={t('mobile.invoices.retry')}
          onRetry={() => void customerListQuery.refetch()}
        />
      </AppScreen>
    );
  }

  return (
    <AppScreen>
      {showOfflineBanner ? <OfflineBanner /> : null}
      <SectionList
        sections={sections}
        keyExtractor={(item) => `${item.kind}-${item.card.id}`}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={{
          gap: theme.spacing.md,
          flexGrow: 1,
          paddingBottom: surfaceClearance,
        }}
        refreshControl={
          <RefreshControl
            refreshing={
              (showOrdersQuery && ordersQuery.isRefetching && !ordersQuery.isFetchingNextPage) ||
              (showReturnsQuery &&
                returnsQuery.isRefetching &&
                !returnsQuery.isFetchingNextPage) ||
              (canReadPurchasing &&
                purchasingQuery.isRefetching &&
                !purchasingQuery.isFetchingNextPage)
            }
            onRefresh={() => {
              if (showOrdersQuery) void ordersQuery.refetch();
              if (showReturnsQuery) void returnsQuery.refetch();
              if (canReadPurchasing) void purchasingQuery.refetch();
            }}
            tintColor={colors.brand}
          />
        }
        onEndReached={() => {
          if (showOrdersQuery && ordersQuery.hasNextPage && !ordersQuery.isFetchingNextPage) {
            void ordersQuery.fetchNextPage();
          }
          if (showReturnsQuery && returnsQuery.hasNextPage && !returnsQuery.isFetchingNextPage) {
            void returnsQuery.fetchNextPage();
          }
          if (
            canReadPurchasing &&
            purchasingQuery.hasNextPage &&
            !purchasingQuery.isFetchingNextPage
          ) {
            void purchasingQuery.fetchNextPage();
          }
        }}
        ListHeaderComponent={
          <View style={{ gap: theme.spacing.md, marginBottom: theme.spacing.sm }}>
            <InvoicesScreenTitle backFallback={backFallback} titleWeight={titleWeight} />

            {canCreate ? (
              <PrimaryButton
                label={t('mobile.invoices.createInvoice')}
                onPress={() => {
                  void haptics.selection();
                  setCreateOpen(true);
                }}
                style={{ borderRadius: theme.radius.xl }}
              />
            ) : null}

            {dealerSurface ? (
              <View style={{ gap: theme.spacing.md }}>
                <InvoicesTabBar
                  value={desk}
                  onChange={setDesk}
                  tabs={[
                    { key: 'all', label: t('mobile.invoices.tabs.all') },
                    { key: 'orders', label: t('mobile.invoices.tabs.orders') },
                    { key: 'returns', label: t('mobile.invoices.tabs.returns') },
                  ]}
                />
                <DealerSearchBar
                  value={search}
                  onChangeText={setSearch}
                  placeholder={t('mobile.invoices.search')}
                />
                <InvoiceFilterTriggers
                  showDealers={false}
                  dealerLabel={null}
                  dealersFallbackKey={partyFallbackKey}
                  dealersIcon={desk === 'purchasing' ? 'storefront-outline' : 'people-outline'}
                  onOpenDealers={() => undefined}
                  statusActive={isInvoiceStatusFilterActive(chip)}
                  statusLabel={statusLabel}
                  onOpenStatus={() => setStatusSheetOpen(true)}
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
                <InvoicesTabBar
                  embedded
                  value={desk}
                  onChange={setDesk}
                  tabs={[
                    { key: 'all', label: t('mobile.invoices.tabs.all') },
                    { key: 'orders', label: t('mobile.invoices.tabs.orders') },
                    { key: 'returns', label: t('mobile.invoices.tabs.returns') },
                    ...(canReadPurchasing
                      ? [{ key: 'purchasing' as const, label: t('mobile.invoices.tabs.purchasing') }]
                      : []),
                  ]}
                />
                {desk === 'purchasing' ? (
                  <InvoicePurchasingRail value={purchasingKind} onChange={setPurchasingKind} />
                ) : null}
                <SearchBarShell>
                  <AppTextInput
                    value={search}
                    onChangeText={setSearch}
                    placeholder={t('mobile.invoices.search')}
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

                <InvoiceFilterTriggers
                  showDealers={adminControls}
                  dealerLabel={party?.name ?? null}
                  dealersFallbackKey={partyFallbackKey}
                  dealersIcon={desk === 'purchasing' ? 'storefront-outline' : 'people-outline'}
                  onOpenDealers={() => setPartySheetOpen(true)}
                  onClearDealer={() => setParty(null)}
                  statusActive={isInvoiceStatusFilterActive(chip)}
                  statusLabel={statusLabel}
                  onOpenStatus={() => setStatusSheetOpen(true)}
                />
              </View>
            )}
          </View>
        }
        ListEmptyComponent={
          isEmpty ? (
            dealerSurface ? (
              <DealerEmptyState
                title={t(emptyCopy.title)}
                body={t(emptyCopy.body)}
              />
            ) : (
              <EmptyState
                title={t(emptyCopy.title)}
                description={t(emptyCopy.body)}
              />
            )
          ) : null
        }
        renderSectionHeader={({ section }) =>
          desk === 'all' ? (
            <View
              style={{
                paddingTop: theme.spacing.sm,
                paddingBottom: theme.spacing.xs,
              }}
            >
              <AppText
                variant="caption"
                weight={titleWeight}
                color="brand"
                style={{ textAlign: isRTL ? 'right' : 'left' }}
              >
                {section.title}
              </AppText>
              {section.data.length === 0 ? (
                <AppText
                  variant="caption"
                  color="muted"
                  style={{
                    textAlign: isRTL ? 'right' : 'left',
                    marginTop: 4,
                  }}
                >
                  {section.key === 'purchasing'
                    ? t('mobile.invoices.emptyPurchasing')
                    : section.key === 'returns'
                      ? t('mobile.invoices.emptyReturns')
                      : t('mobile.invoices.emptyOrders')}
                </AppText>
              ) : null}
            </View>
          ) : null
        }
        renderItem={({ item, index }) => (
          <ListItemEnter index={index}>
            {item.kind === 'order' ? (
              <InvoiceBoardCard
                invoice={item.card}
                dealerFacing={dealerSurface}
                onPress={() =>
                  onSelectInvoice
                    ? onSelectInvoice(item.card.id)
                    : router.push(detailHref(item.card.id))
                }
                onPdf={() => {
                  void (async () => {
                    const opts = await pickPdfOptions();
                    if (!opts) return;
                    try {
                      await openInvoicePdf(item.card.id, opts);
                    } catch {
                      showToast({
                        variant: 'error',
                        message: t('mobile.invoices.pdfFailed'),
                      });
                    }
                  })();
                }}
              />
            ) : (
              <SupplierInvoiceBoardCard
                invoice={item.card}
                onPress={() => router.push(purchasingDetailHref(item.card.id))}
              />
            )}
          </ListItemEnter>
        )}
      />

      {canCreate ? (
        <CreateInvoiceSheet
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          includePurchasing={canReadPurchasing}
          onCreated={(id, kind) => {
            if (kind === 'PURCHASING') router.push(purchasingDetailHref(id));
            else router.push(detailHref(id));
          }}
        />
      ) : null}

      {adminControls ? (
        <InvoicePartySheet
          open={partySheetOpen}
          onClose={() => setPartySheetOpen(false)}
          titleKey={partyFallbackKey}
          segments={partySegments}
          dealers={dealerOptions}
          suppliers={supplierOptions}
          selected={party}
          onConfirm={setParty}
        />
      ) : null}

      <InvoiceStatusFilterSheet
        open={statusSheetOpen}
        onClose={() => setStatusSheetOpen(false)}
        status={chip}
        onApply={setChip}
      />
      {pdfDownloadSheet}
    </AppScreen>
  );
}
