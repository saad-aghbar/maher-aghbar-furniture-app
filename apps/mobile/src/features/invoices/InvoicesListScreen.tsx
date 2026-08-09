import { useEffect, useMemo, useState } from 'react';
import { FlatList, RefreshControl, TextInput, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
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
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { openInvoicePdf } from './api';
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
        {t('navigation.invoices')}
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
  const { showOfflineBanner } = useNetwork();
  const { showToast } = useToast();
  const router = useRouter();
  const allowed = can(user, 'invoice.read');
  const canCreate = adminControls && can(user, 'invoice.create');
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  const [chip, setChip] = useState<InvoiceStatusFilter>('ALL');
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [dealerLabel, setDealerLabel] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [dealerSheetOpen, setDealerSheetOpen] = useState(false);
  const [statusSheetOpen, setStatusSheetOpen] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setQ(search.trim()), 300);
    return () => clearTimeout(id);
  }, [search]);

  const customersQuery = useInvoiceCustomersQuery(adminControls);
  const query = useInvoicesInfiniteQuery(
    {
      q: q || undefined,
      status: chip === 'ALL' ? undefined : chip,
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
    : t('accounting.filter');

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
          paddingBottom: theme.spacing['3xl'] + SURFACE_TAB_BAR_CLEARANCE,
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
                <TextInput
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
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            title={t('accounting.empty')}
            description={t('accounting.emptyHint')}
          />
        }
        renderItem={({ item, index }) => (
          <ListItemEnter index={index}>
            <InvoiceBoardCard
              invoice={item}
              onPress={() => router.push(detailHref(item.id))}
              onPdf={() => {
                void openInvoicePdf(item.id).catch(() => {
                  showToast({ variant: 'error', message: t('mobile.invoices.pdfFailed') });
                });
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
    </AppScreen>
  );
}
