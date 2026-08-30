import { useEffect, useMemo, useState } from 'react';
import { FlatList, RefreshControl, View } from 'react-native';
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
import { openInvoicePdf } from './api';
import { usePdfDownload } from '@/features/pdf/usePdfDownload';
import { CreateInvoiceFromSalesOrderSheet } from './components/CreateInvoiceFromSalesOrderSheet';
import { InvoiceBoardCard } from './components/InvoiceBoardCard';
import { InvoiceDealerSheet } from './components/InvoiceDealerSheet';
import { InvoiceFilterTriggers } from './components/InvoiceFilterTriggers';
import { InvoiceStatusFilterSheet } from './components/InvoiceStatusFilterSheet';
import {
  isInvoiceStatusFilterActive,
  type InvoiceDealerOption,
  type InvoiceStatusFilter,
} from './invoiceFilters';
import { useLocale } from '@/i18n';
import { haptics, ListItemEnter } from '@/motion';
import { SURFACE_TAB_BAR_CLEARANCE } from '@/navigation/tabBarClearance';
import { resolveAppFontStyle, useTheme } from '@/theme';
import {
  flattenInvoices,
  useInvoiceCustomersQuery,
  useInvoicesInfiniteQuery,
} from './query';
import { selectInvoiceCard } from './selectInvoice';
import { AppTextInput } from '@/components/forms/AppTextInput';

type Props = {
  detailHref: (id: string) => Href;
  backFallback?: Href;
  /** When true, show create CTA + dealer filter (admin). */
  adminControls?: boolean;
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
}: Props) {
  const { user } = useAuth();
  const { t, locale, isRTL } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const insets = useSafeAreaInsets();
  const { showOfflineBanner } = useNetwork();
  const { showToast } = useToast();
  const router = useRouter();
  const params = useLocalSearchParams<{ chip?: string }>();
  const allowed = can(user, 'invoice.read');
  const canCreate = adminControls && can(user, 'invoice.create');
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const dealerSurface = !adminControls;

  const [chip, setChip] = useState<InvoiceStatusFilter>('ALL');
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [dealerLabel, setDealerLabel] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [dealerSheetOpen, setDealerSheetOpen] = useState(false);
  const [statusSheetOpen, setStatusSheetOpen] = useState(false);
  const { pickPdfOptions, pdfDownloadSheet } = usePdfDownload();

  useEffect(() => {
    const raw = String(params.chip ?? '').trim().toUpperCase();
    if (!raw) return;
    if (raw === 'OVERDUE' || raw === 'OPEN' || raw === 'DRAFT' || raw === 'PARTIAL' || raw === 'PAID') {
      setChip(raw as InvoiceStatusFilter);
    }
  }, [params.chip]);

  useEffect(() => {
    const id = setTimeout(() => setQ(search.trim()), 300);
    return () => clearTimeout(id);
  }, [search]);

  const customersQuery = useInvoiceCustomersQuery(adminControls);
  const query = useInvoicesInfiniteQuery(
    {
      q: q || undefined,
      status: chip === 'ALL' || chip === 'OVERDUE' ? undefined : chip,
      overdue: chip === 'OVERDUE' ? true : undefined,
      customerId: customerId || undefined,
    },
    allowed,
  );
  const cards = useMemo(
    () => flattenInvoices(query.data).map((inv) => selectInvoiceCard(inv, locale)),
    [query.data, locale],
  );

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

  if (query.isError && !query.data) {
    return (
      <AppScreen>
        <InvoicesScreenTitle backFallback={backFallback} titleWeight={titleWeight} />
        {showOfflineBanner ? <OfflineBanner /> : null}
        <ErrorState
          title={t('mobile.invoices.errorTitle')}
          description={t('mobile.invoices.errorBody')}
          retryLabel={t('mobile.invoices.retry')}
          onRetry={() => void query.refetch()}
        />
      </AppScreen>
    );
  }

  return (
    <AppScreen>
      {showOfflineBanner ? <OfflineBanner /> : null}
      <FlatList
        data={cards}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{
          gap: theme.spacing.md,
          flexGrow: 1,
          paddingBottom: insets.bottom + SURFACE_TAB_BAR_CLEARANCE,
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
            <InvoicesScreenTitle backFallback={backFallback} titleWeight={titleWeight} />

            {canCreate ? (
              <PrimaryButton
                label={t('accounting.createFromSalesOrder')}
                onPress={() => {
                  void haptics.selection();
                  setCreateOpen(true);
                }}
                style={{ borderRadius: theme.radius.xl }}
              />
            ) : null}

            {dealerSurface ? (
              <View style={{ gap: theme.spacing.md }}>
                <DealerSearchBar
                  value={search}
                  onChangeText={setSearch}
                  placeholder={t('mobile.invoices.search')}
                />
                <InvoiceFilterTriggers
                  showDealers={false}
                  dealerLabel={null}
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
                <SearchBarShell>
                  <AppTextInput
                    value={search}
                    onChangeText={setSearch}
                    placeholder={t('accounting.searchPlaceholder')}
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
                  dealerLabel={dealerLabel}
                  onOpenDealers={() => setDealerSheetOpen(true)}
                  onClearDealer={() => {
                    setCustomerId(null);
                    setDealerLabel(null);
                  }}
                  statusActive={isInvoiceStatusFilterActive(chip)}
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
              title={t('mobile.invoices.emptyTitle')}
              body={t('mobile.invoices.emptyBody')}
            />
          ) : (
            <EmptyState
              title={t('mobile.invoices.emptyTitle')}
              description={t('mobile.invoices.emptyBody')}
            />
          )
        }
        renderItem={({ item, index }) => (
          <ListItemEnter index={index}>
            <InvoiceBoardCard
              invoice={item}
              dealerFacing={dealerSurface}
              onPress={() => router.push(detailHref(item.id))}
              onPdf={() => {
                void (async () => {
                  const opts = await pickPdfOptions();
                  if (!opts) return;
                  try {
                    await openInvoicePdf(item.id, opts);
                  } catch {
                    showToast({
                      variant: 'error',
                      message: t('mobile.invoices.pdfFailed'),
                    });
                  }
                })();
              }}
            />
          </ListItemEnter>
        )}
      />

      {canCreate ? (
        <CreateInvoiceFromSalesOrderSheet
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          onCreated={(id) => router.push(detailHref(id))}
        />
      ) : null}

      {adminControls ? (
        <InvoiceDealerSheet
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
