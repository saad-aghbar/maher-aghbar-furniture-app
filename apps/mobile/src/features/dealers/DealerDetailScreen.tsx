import { useMemo, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import type { Href } from 'expo-router';
import { useRouter } from 'expo-router';
import { can } from '@maher/permissions';
import { localizedName } from '@maher/i18n';
import { useAuth } from '@/auth/AuthProvider';
import { listAdminProducts } from '@/api/modules/catalogAdmin';
import { listInvoices, openInvoicePdf } from '@/api/modules/invoices';
import { getStatement, listPayments, openPaymentPdf, openStatementPdf } from '@/api/modules/payments';
import { listSalesOrders } from '@/api/modules/sales-orders';
import { queryKeys } from '@/api/queryKeys';
import { AppText } from '@/components/AppText';
import { BackButton } from '@/components/BackButton';
import { StatusBadge } from '@/components/badges/StatusBadge';
import { DestructiveButton } from '@/components/buttons/DestructiveButton';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { OfflineBanner } from '@/components/feedback/OfflineBanner';
import { useToast } from '@/components/feedback/Toast';
import { usePdfDownload } from '@/features/pdf/usePdfDownload';
import { formatPhoneForDisplay } from '@/components/forms/countryDialCodes';
import { ScrollableScreen } from '@/components/layout/ScrollableScreen';
import { Divider } from '@/components/layout/Divider';
import { useNetwork } from '@/components/network/NetworkProvider';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { ListItemEnter, AnimatedPressable, haptics } from '@/motion';
import { useSmartBack } from '@/navigation/useSmartBack';
import { useTheme } from '@/theme';
import {
  AddAddressSheet,
  AddContactSheet,
  AddNoteSheet,
  AddPriceSheet,
  EditAddressSheet,
  ViewNoteSheet,
} from './components/DealerCrmSheets';
import type { CustomerAddress } from '@/api/modules/customers';
import { DealerBoard } from './components/DealerBoard';
import { DeleteDealerSheet } from './components/DeleteDealerSheet';
import { DealerEmptyPanel } from './components/DealerEmptyPanel';
import { DealerInvoicesList } from './components/DealerInvoicesList';
import { DealerOrderCard } from './components/DealerOrderCard';
import { DealerPaymentsList } from './components/DealerPaymentsList';
import { DealerPriceList } from './components/DealerPriceList';
import { DealerSummaryRail } from './components/DealerSummaryRail';
import { EditDealerSheet } from './components/EditDealerSheet';
import { dealerIdentitySubtitle, hasVisibleContact } from './dealerDetailDisplay';
import {
  dealerTypeLabel,
  filterCompletedOrders,
  filterProductionOrders,
  filterWaitingOrders,
} from './orderBuckets';
import {
  useDealerDetailQuery,
  useDealerNotesQuery,
  useDealerPricesQuery,
  useDeleteDealerPriceMutation,
} from './query';

type DealerTab =
  | 'orders'
  | 'production'
  | 'completed'
  | 'soa'
  | 'payments'
  | 'invoices'
  | 'priceList';

type Props = { dealerId: string };

/**
 * Dealer detail — floor boards: identity hero, metrics, money, profile, CRM, summary tabs.
 */
export function DealerDetailScreen({ dealerId }: Props) {
  const { user } = useAuth();
  const { t, locale, isRTL, formatCurrency, formatDate } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const { showToast } = useToast();
  const { pickPdfOptions, pdfDownloadSheet } = usePdfDownload();
  const { showOfflineBanner } = useNetwork();
  const router = useRouter();
  const onBack = useSmartBack('/(app)/(admin)/dealers' as Href);
  const allowed = can(user, 'customer.read');
  const canUpdate = can(user, 'customer.update');
  const canDelete = can(user, 'customer.delete');
  const canContact = can(user, 'contact.manage');
  const canAddress = can(user, 'address.manage');
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  const [tab, setTab] = useState<DealerTab>('orders');
  const [editOpen, setEditOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [addressOpen, setAddressOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<CustomerAddress | null>(null);
  const [noteOpen, setNoteOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [priceOpen, setPriceOpen] = useState(false);
  const [viewNote, setViewNote] = useState<{
    body: string;
    noteId?: string | null;
    dateLabel?: string | null;
    authorLabel?: string | null;
    kind?: 'profile' | 'note';
  } | null>(null);

  const detailQuery = useDealerDetailQuery(dealerId);
  const notesQuery = useDealerNotesQuery(dealerId);
  const pricesQuery = useDealerPricesQuery(dealerId);
  const deletePrice = useDeleteDealerPriceMutation(dealerId);

  const ordersQuery = useQuery({
    queryKey: queryKeys.salesOrders.list({ customerId: dealerId, pageSize: 100 }),
    queryFn: () => listSalesOrders({ customerId: dealerId, page: 1, pageSize: 100 }),
    enabled: allowed,
  });

  const paymentsQuery = useQuery({
    queryKey: queryKeys.payments.list({ customerId: dealerId }),
    queryFn: () => listPayments({ customerId: dealerId, page: 1, pageSize: 50 }),
    enabled: allowed && (tab === 'payments' || tab === 'soa'),
  });

  const invoicesQuery = useQuery({
    queryKey: queryKeys.invoices.list({ customerId: dealerId }),
    queryFn: () => listInvoices({ customerId: dealerId, page: 1, pageSize: 50 }),
    enabled: allowed && tab === 'invoices',
  });

  const statementQuery = useQuery({
    queryKey: queryKeys.statements.detail(dealerId),
    queryFn: () => getStatement(dealerId),
    enabled: allowed && tab === 'soa',
  });

  const productsQuery = useQuery({
    queryKey: ['products-pick'],
    queryFn: () => listAdminProducts({ pageSize: 200, isActive: 'true' }),
    enabled: allowed && (tab === 'priceList' || priceOpen),
  });

  const dealer = detailQuery.data;
  const salesOrders = ordersQuery.data?.data ?? [];
  const waiting = useMemo(() => filterWaitingOrders(salesOrders), [salesOrders]);
  const inProd = useMemo(() => filterProductionOrders(salesOrders), [salesOrders]);
  const completed = useMemo(() => filterCompletedOrders(salesOrders), [salesOrders]);

  const tabs: Array<{ key: DealerTab; label: string; count?: number }> = [
    { key: 'orders', label: t('navigation.orders'), count: waiting.length },
    { key: 'production', label: t('customers.inProduction'), count: inProd.length },
    { key: 'completed', label: t('customers.completedOrders'), count: completed.length },
    { key: 'soa', label: t('navigation.statement') },
    { key: 'payments', label: t('navigation.payments') },
    { key: 'invoices', label: t('navigation.invoices') },
    { key: 'priceList', label: t('customers.priceList') },
  ];

  const downloadStatementPdf = async () => {
    void haptics.selection();
    const opts = await pickPdfOptions();
    if (!opts) return;
    try {
      await openStatementPdf(dealerId, opts);
    } catch {
      showToast({ variant: 'error', message: t('mobile.account.pdfFailed') });
    }
  };

  const downloadInvoicePdf = (id: string) => {
    void (async () => {
      const opts = await pickPdfOptions();
      if (!opts) return;
      try {
        await openInvoicePdf(id, opts);
      } catch {
        showToast({ variant: 'error', message: t('mobile.invoices.pdfFailed') });
      }
    })();
  };

  const downloadPaymentPdf = (id: string) => {
    void (async () => {
      const opts = await pickPdfOptions();
      if (!opts) return;
      try {
        await openPaymentPdf(id, opts);
      } catch {
        showToast({
          variant: 'error',
          message: t('mobile.account.paymentPdfFailed'),
        });
      }
    })();
  };

  const refetchAll = () => {
    void detailQuery.refetch();
    void ordersQuery.refetch();
    void notesQuery.refetch();
    void pricesQuery.refetch();
  };

  if (!allowed) {
    return (
      <ScrollableScreen>
        <BackButton onPress={onBack} />
        <EmptyState title={t('mobile.noModules')} description={t('mobile.noModulesHint')} />
      </ScrollableScreen>
    );
  }

  if (detailQuery.isLoading && !dealer) {
    return (
      <ScrollableScreen>
        <BackButton onPress={onBack} />
        <ActivityIndicator color={colors.brand} />
      </ScrollableScreen>
    );
  }

  if (detailQuery.isError && !dealer) {
    return (
      <ScrollableScreen>
        <BackButton onPress={onBack} />
        {showOfflineBanner ? <OfflineBanner /> : null}
        <ErrorState
          title={t('mobile.dealers.detailErrorTitle')}
          description={t('mobile.dealers.errorBody')}
          retryLabel={t('mobile.dealers.retry')}
          onRetry={() => void detailQuery.refetch()}
        />
      </ScrollableScreen>
    );
  }

  if (!dealer) return null;

  const name = localizedName(locale, dealer, dealer.code || '—');
  const initial = (name || dealer.code || '?').trim().charAt(0).toUpperCase();
  const identitySubtitle = dealerIdentitySubtitle(
    name,
    dealer.companyName,
    dealerTypeLabel(String(dealer.customerType), t),
  );
  const phoneDisplay = hasVisibleContact(dealer.phone)
    ? formatPhoneForDisplay(dealer.phone)
    : null;
  const faxDisplay = hasVisibleContact(dealer.fax)
    ? formatPhoneForDisplay(dealer.fax)
    : null;
  const emailRaw = dealer.email?.trim() ?? '';
  const emailDisplay = hasVisibleContact(emailRaw) ? emailRaw : null;
  const contacts = dealer.contacts ?? [];
  const addresses = dealer.addresses ?? [];
  const notes = notesQuery.data ?? [];
  const prices = pricesQuery.data ?? [];
  const outstanding = Number(dealer.outstandingTotal ?? 0);
  const paid = Number(dealer.paidTotal ?? 0);
  const hasBalance = outstanding > 0.009;
  const status = String(dealer.status || 'ACTIVE');
  const code = dealer.code?.trim() || '';

  const orderRows =
    tab === 'orders' ? waiting : tab === 'production' ? inProd : tab === 'completed' ? completed : [];

  const orderMetrics = [
    {
      key: 'w',
      label: t('customers.ordersWaiting'),
      value: dealer.waitingOrdersCount ?? waiting.length,
      icon: 'time-outline' as const,
    },
    {
      key: 'i',
      label: t('customers.ordersInWork'),
      value: dealer.inWorkOrdersCount ?? inProd.length,
      icon: 'construct-outline' as const,
    },
    {
      key: 'd',
      label: t('customers.ordersDone'),
      value: dealer.doneOrdersCount ?? completed.length,
      icon: 'checkmark-circle-outline' as const,
    },
  ];

  return (
    <ScrollableScreen
      scrollProps={{
        keyboardShouldPersistTaps: 'handled',
        refreshControl: (
          <RefreshControl
            refreshing={detailQuery.isRefetching}
            onRefresh={refetchAll}
            tintColor={colors.brand}
          />
        ),
      }}
    >
      <DealerDetailTitle onBack={onBack} titleWeight={titleWeight} />
      {showOfflineBanner ? <OfflineBanner /> : null}

      {/* Identity hero */}
      <ListItemEnter index={0}>
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
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'center',
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
            <StatusBadge status={status} dot />
            {code ? (
              <AppText
                variant="caption"
                weight="semibold"
                dir="ltr"
                numberOfLines={1}
                style={{ color: colors.brand, flexShrink: 1 }}
              >
                {code}
              </AppText>
            ) : null}
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
                alignItems: 'flex-start',
                gap: theme.spacing.md,
              }}
            >
              <View
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 28,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: colors.brandSoft,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <AppText
                  weight="semibold"
                  style={{ color: colors.brand, fontSize: 22, lineHeight: 26 }}
                >
                  {initial}
                </AppText>
              </View>
              <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                <AppText
                  variant="title"
                  weight={titleWeight}
                  numberOfLines={2}
                  style={{
                    textAlign: isRTL ? 'right' : 'left',
                    fontSize: 20,
                    lineHeight: 26,
                    letterSpacing: -0.3,
                  }}
                >
                  {name}
                </AppText>
                {identitySubtitle ? (
                  <AppText
                    variant="caption"
                    color="secondary"
                    numberOfLines={1}
                    style={{ textAlign: isRTL ? 'right' : 'left' }}
                  >
                    {identitySubtitle}
                  </AppText>
                ) : null}
              </View>
            </View>

            {phoneDisplay || faxDisplay || emailDisplay ? (
              <View
                style={{
                  borderRadius: theme.radius.lg,
                  backgroundColor: colors.surfaceSecondary,
                  borderWidth: 1,
                  borderColor: colors.border,
                  overflow: 'hidden',
                }}
              >
                {phoneDisplay ? (
                  <MetaRow
                    icon="call-outline"
                    label={t('customers.phone')}
                    value={phoneDisplay}
                    valueLtr
                  />
                ) : null}
                {faxDisplay ? (
                  <>
                    {phoneDisplay ? <Divider compact /> : null}
                    <MetaRow
                      icon="print-outline"
                      label={t('customers.fax')}
                      value={faxDisplay}
                      valueLtr
                    />
                  </>
                ) : null}
                {emailDisplay ? (
                  <>
                    {phoneDisplay || faxDisplay ? <Divider compact /> : null}
                    <MetaRow
                      icon="mail-outline"
                      label={t('customers.email')}
                      value={emailDisplay}
                      valueLtr
                    />
                  </>
                ) : null}
              </View>
            ) : null}

            <View
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                gap: theme.spacing.sm,
                flexWrap: 'wrap',
              }}
            >
              <SecondaryButton
                label={t('navigation.statement')}
                onPress={() => void downloadStatementPdf()}
                style={{
                  borderRadius: theme.radius.full,
                  flexGrow: 1,
                  minWidth: 120,
                  paddingVertical: 0,
                  minHeight: theme.sizes.touch.min,
                }}
              />
              {canUpdate ? (
                <SecondaryButton
                  label={t('customers.edit')}
                  onPress={() => {
                    void haptics.selection();
                    setEditOpen(true);
                  }}
                  style={{
                    borderRadius: theme.radius.full,
                    flexGrow: 1,
                    minWidth: 120,
                    paddingVertical: 0,
                    minHeight: theme.sizes.touch.min,
                  }}
                />
              ) : null}
            </View>
          </View>
        </View>
      </ListItemEnter>

      {/* Order buckets */}
      <ListItemEnter index={1}>
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            gap: theme.spacing.sm,
          }}
        >
          {orderMetrics.map((m) => (
            <View
              key={m.key}
              style={{
                flex: 1,
                minWidth: 0,
                borderRadius: theme.radius.lg,
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.borderStrong,
                paddingVertical: theme.spacing.md,
                paddingHorizontal: theme.spacing.sm,
                alignItems: 'center',
                gap: 6,
                ...orderBoardShadow(colorScheme),
              }}
            >
              <View
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 14,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: colors.brandSoft,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Ionicons name={m.icon} size={14} color={colors.brand} />
              </View>
              <AppText
                variant="caption"
                color="muted"
                align="center"
                numberOfLines={1}
                style={{
                  fontSize: 11,
                  letterSpacing: locale === 'ar' ? 0 : 0.15,
                }}
              >
                {m.label}
              </AppText>
              <AppText
                weight="semibold"
                align="center"
                dir="ltr"
                style={{ fontSize: 20, lineHeight: 24, letterSpacing: -0.3 }}
              >
                {String(m.value)}
              </AppText>
            </View>
          ))}
        </View>
      </ListItemEnter>

      {/* Money board */}
      <ListItemEnter index={2}>
        <View
          style={{
            borderRadius: theme.radius.xl,
            borderWidth: 1,
            borderColor: hasBalance ? colors.warning : colors.borderStrong,
            backgroundColor: colors.surface,
            overflow: 'hidden',
            ...orderBoardShadow(colorScheme),
          }}
        >
          <View
            style={{
              paddingHorizontal: theme.spacing.lg,
              paddingTop: theme.spacing.lg,
              paddingBottom: theme.spacing.md,
              gap: 4,
              backgroundColor: hasBalance ? colors.warningSoft : colors.surfaceSecondary,
              ...(isRTL
                ? { paddingRight: theme.spacing.lg + 4 }
                : { paddingLeft: theme.spacing.lg + 4 }),
            }}
          >
            <AppText
              variant="caption"
              color="muted"
              style={{
                textTransform: locale === 'ar' ? 'none' : 'uppercase',
                letterSpacing: locale === 'ar' ? 0 : 0.55,
                fontSize: 10,
                textAlign: isRTL ? 'right' : 'left',
              }}
            >
              {t('customers.amountLeft')}
            </AppText>
            <AppText
              weight={titleWeight}
              dir="ltr"
              style={{
                fontSize: hasBalance ? 26 : 22,
                lineHeight: hasBalance ? 30 : 26,
                textAlign: isRTL ? 'right' : 'left',
                color: hasBalance ? colors.warning : colors.textPrimary,
              }}
            >
              {formatCurrency(outstanding)}
            </AppText>
          </View>
          <Divider compact />
          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: theme.spacing.md,
              paddingHorizontal: theme.spacing.lg,
              paddingVertical: theme.spacing.md,
              ...(isRTL
                ? { paddingRight: theme.spacing.lg + 4 }
                : { paddingLeft: theme.spacing.lg + 4 }),
            }}
          >
            <AppText
              variant="caption"
              color="muted"
              style={{
                textTransform: 'uppercase',
                letterSpacing: 0.45,
                fontSize: 10,
                flexShrink: 0,
              }}
            >
              {t('customers.amountPaid')}
            </AppText>
            <AppText
              weight="semibold"
              dir="ltr"
              numberOfLines={1}
              style={{
                flex: 1,
                minWidth: 0,
                textAlign: isRTL ? 'left' : 'right',
                fontSize: 14,
              }}
            >
              {formatCurrency(paid)}
            </AppText>
          </View>
        </View>
      </ListItemEnter>

      {/* Profile facts */}
      <ListItemEnter index={3}>
        <DealerBoard title={t('customers.detail')} titleWeight={titleWeight}>
          <View
            style={{
              borderRadius: theme.radius.lg,
              backgroundColor: colors.surfaceSecondary,
              borderWidth: 1,
              borderColor: colors.border,
              overflow: 'hidden',
            }}
          >
            <MetaRow
              icon="storefront-outline"
              label={t('customers.type')}
              value={dealerTypeLabel(String(dealer.customerType), t)}
            />
            <Divider compact />
            <MetaRow
              icon="business-outline"
              label={t('customers.companyName')}
              value={dealer.companyName?.trim() || '—'}
            />
            <Divider compact />
            <MetaRow
              icon="mail-outline"
              label={t('customers.email')}
              value={emailDisplay || '—'}
              valueLtr
            />
            <Divider compact />
            <MetaRow
              icon="call-outline"
              label={t('customers.phone')}
              value={phoneDisplay || '—'}
              valueLtr
            />
            {faxDisplay ? (
              <>
                <Divider compact />
                <MetaRow
                  icon="print-outline"
                  label={t('customers.fax')}
                  value={faxDisplay}
                  valueLtr
                />
              </>
            ) : null}
          </View>
        </DealerBoard>
      </ListItemEnter>

      {/* Summary tabs */}
      <ListItemEnter index={4}>
        <View style={{ gap: theme.spacing.md }}>
          <AppText
            variant="heading"
            weight={titleWeight}
            style={{ textAlign: isRTL ? 'right' : 'left' }}
          >
            {t('customers.dealerSummary')}
          </AppText>

          <DealerSummaryRail tabs={tabs} value={tab} onChange={setTab} />

          {(tab === 'orders' || tab === 'production' || tab === 'completed') &&
            (orderRows.length === 0 ? (
              <DealerEmptyPanel
                text={
                  tab === 'completed'
                    ? t('customers.noCompletedOrders')
                    : tab === 'production'
                      ? t('customers.noProduction')
                      : t('customers.noOrders')
                }
                icon={
                  tab === 'completed'
                    ? 'checkmark-done-outline'
                    : tab === 'production'
                      ? 'construct-outline'
                      : 'cube-outline'
                }
              />
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{
                  gap: theme.spacing.md,
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  paddingVertical: theme.spacing.xs,
                }}
              >
                {orderRows.map((order, i) => (
                  <ListItemEnter key={order.id} index={i}>
                    <DealerOrderCard
                      order={order}
                      onPress={() =>
                        router.push(`/(app)/(admin)/orders/${order.id}` as Href)
                      }
                    />
                  </ListItemEnter>
                ))}
              </ScrollView>
            ))}

          {tab === 'soa' && (
            <DealerBoard title={t('navigation.statement')} titleWeight={titleWeight}>
              {statementQuery.isLoading ? (
                <ActivityIndicator color={colors.brand} />
              ) : statementQuery.data ? (
                <View style={{ gap: theme.spacing.md }}>
                  <View
                    style={{
                      borderRadius: theme.radius.lg,
                      backgroundColor: colors.surfaceSecondary,
                      borderWidth: 1,
                      borderColor: colors.border,
                      overflow: 'hidden',
                    }}
                  >
                    <MetaRow
                      icon="wallet-outline"
                      label={t('accounting.amountDue')}
                      value={formatCurrency(
                        Number(
                          statementQuery.data.amountDue ??
                            statementQuery.data.outstandingBalance,
                        ),
                      )}
                      valueLtr
                      emphasize
                    />
                    <Divider compact />
                    <MetaRow
                      icon="cash-outline"
                      label={t('accounting.accountCredit')}
                      value={formatCurrency(
                        Number(statementQuery.data.availableCredit ?? 0),
                      )}
                      valueLtr
                    />
                    {Math.abs(Number(statementQuery.data.openingBalance ?? 0)) >
                    0.0005 ? (
                      <>
                        <Divider compact />
                        <MetaRow
                          icon="ellipse-outline"
                          label={t('accounting.openingBalance')}
                          value={formatCurrency(
                            Number(statementQuery.data.openingBalance),
                          )}
                          valueLtr
                        />
                      </>
                    ) : null}
                    <Divider compact />
                    <MetaRow
                      icon="checkmark-circle-outline"
                      label={t('customers.amountPaid')}
                      value={formatCurrency(Number(statementQuery.data.totalPaid))}
                      valueLtr
                    />
                    <Divider compact />
                    <MetaRow
                      icon="document-text-outline"
                      label={t('accounting.closingBalance')}
                      value={formatCurrency(Number(statementQuery.data.closingBalance))}
                      valueLtr
                    />
                  </View>
                  <SecondaryButton
                    label={t('navigation.statement')}
                    onPress={() => void downloadStatementPdf()}
                    style={{ borderRadius: theme.radius.full }}
                  />
                </View>
              ) : (
                <DealerEmptyPanel
                  text={(() => {
                    const v = t('customers.noStatement');
                    return v === 'customers.noStatement' ? 'No statement yet.' : v;
                  })()}
                  icon="document-text-outline"
                  nested
                />
              )}
            </DealerBoard>
          )}

          {tab === 'payments' && (
            <DealerBoard
              title={t('navigation.payments')}
              titleWeight={titleWeight}
              contentStyle={{ padding: 0, gap: 0, paddingLeft: 0, paddingRight: 0 }}
            >
              <DealerPaymentsList
                payments={paymentsQuery.data?.data ?? []}
                emptyLabel={t('customers.noPayments')}
                onPaymentPdf={downloadPaymentPdf}
              />
            </DealerBoard>
          )}

          {tab === 'invoices' && (
            <DealerBoard
              title={t('navigation.invoices')}
              titleWeight={titleWeight}
              contentStyle={{ padding: 0, gap: 0, paddingLeft: 0, paddingRight: 0 }}
            >
              <DealerInvoicesList
                invoices={invoicesQuery.data?.data ?? []}
                emptyLabel={t('customers.noInvoices')}
                onPressInvoice={(id) =>
                  router.push(`/(app)/(admin)/invoices/${id}` as Href)
                }
                onInvoicePdf={downloadInvoicePdf}
              />
            </DealerBoard>
          )}

          {tab === 'priceList' && (
            <DealerBoard
              title={t('customers.priceList')}
              titleWeight={titleWeight}
              contentStyle={{ padding: 0, gap: 0, paddingLeft: 0, paddingRight: 0 }}
            >
              <DealerPriceList
                prices={prices}
                emptyLabel={t('customers.noPrices')}
                canDelete={canUpdate}
                onAdd={
                  canUpdate
                    ? () => {
                        setPriceOpen(true);
                      }
                    : undefined
                }
                onDelete={(priceId) => {
                  void deletePrice.mutateAsync(priceId);
                }}
                productName={(row) =>
                  localizedName(
                    locale,
                    {
                      name: row.product?.nameEn,
                      nameAr: row.product?.nameAr,
                      nameEn: row.product?.nameEn,
                      nameHe: row.product?.nameHe,
                    },
                    '—',
                  )
                }
              />
            </DealerBoard>
          )}
        </View>
      </ListItemEnter>

      {/* Contacts */}
      <ListItemEnter index={5}>
        <CrmSection
          title={t('customers.contacts')}
          addLabel={t('customers.addContact')}
          canAdd={canContact}
          onAdd={() => setContactOpen(true)}
        >
          {contacts.length === 0 ? (
            <EmptyTabHint text="—" />
          ) : (
            contacts.map((c, i) => (
              <View key={c.id}>
                {i > 0 ? <Divider compact /> : null}
                <CrmPersonRow
                  name={c.name}
                  meta={[c.position, c.phone, c.email].filter(Boolean).join(' · ') || '—'}
                  icon="person-outline"
                />
              </View>
            ))
          )}
        </CrmSection>
      </ListItemEnter>

      {/* Addresses */}
      <ListItemEnter index={6}>
        <CrmSection
          title={t('customers.addresses')}
          addLabel={t('customers.addAddress')}
          canAdd={canAddress}
          onAdd={() => setAddressOpen(true)}
        >
          {addresses.length === 0 ? (
            <EmptyTabHint text="—" />
          ) : (
            addresses.map((a, i) => {
              const flags = [
                a.isDefaultDelivery ? t('customers.defaultDelivery') : null,
                a.isDefaultBilling ? t('customers.defaultBilling') : null,
              ].filter(Boolean);
              const coords =
                a.latitude != null && a.longitude != null
                  ? t('mobile.newOrder.coordsLabel', {
                      lat: Number(a.latitude).toFixed(4),
                      lng: Number(a.longitude).toFixed(4),
                    })
                  : null;
              const secondary = [...flags, coords].filter(Boolean).join(' · ') || null;
              return (
                <View key={a.id}>
                  {i > 0 ? <Divider compact /> : null}
                  <CrmPersonRow
                    name={a.label || '—'}
                    meta={
                      [a.street || a.line1, a.city, a.country].filter(Boolean).join(', ') ||
                      '—'
                    }
                    metaSecondary={secondary}
                    icon="location-outline"
                    onPress={
                      canAddress
                        ? () => {
                            void haptics.selection();
                            setEditingAddress(a);
                          }
                        : undefined
                    }
                  />
                </View>
              );
            })
          )}
        </CrmSection>
      </ListItemEnter>

      {/* Notes */}
      <ListItemEnter index={7}>
        <CrmSection
          title={t('customers.communications')}
          addLabel={t('customers.addNote')}
          canAdd={canUpdate}
          onAdd={() => setNoteOpen(true)}
        >
          {dealer.notes?.trim() ? (
            <AnimatedPressable
              variant="card"
              accessibilityRole="button"
              accessibilityLabel={t('customers.profileNotes')}
              onPress={() => {
                void haptics.selection();
                setViewNote({
                  body: dealer.notes!.trim(),
                  kind: 'profile',
                });
              }}
              style={{
                borderRadius: theme.radius.lg,
                backgroundColor: colors.brandSoft,
                borderWidth: 1,
                borderColor: colors.border,
                padding: theme.spacing.md,
                gap: 4,
                marginBottom: notes.length ? theme.spacing.sm : 0,
              }}
            >
              <AppText
                variant="caption"
                color="muted"
                style={{
                  textTransform: locale === 'ar' ? 'none' : 'uppercase',
                  letterSpacing: 0.45,
                  fontSize: 10,
                  textAlign: isRTL ? 'right' : 'left',
                }}
              >
                {t('customers.profileNotes')}
              </AppText>
              <AppText
                variant="body"
                numberOfLines={3}
                style={{ textAlign: isRTL ? 'right' : 'left', lineHeight: 20 }}
              >
                {dealer.notes}
              </AppText>
            </AnimatedPressable>
          ) : null}
          {notes.length === 0 && !dealer.notes?.trim() ? (
            <EmptyTabHint text={t('customers.noNotes')} />
          ) : (
            notes.map((n, i) => {
              const author = [n.employee?.firstName, n.employee?.lastName]
                .filter(Boolean)
                .join(' ')
                .trim();
              const dateLabel =
                n.occurredAt || n.createdAt
                  ? formatDate(n.occurredAt || n.createdAt!)
                  : null;
              return (
                <View key={n.id}>
                  {i > 0 || dealer.notes?.trim() ? <Divider compact /> : null}
                  <CrmPersonRow
                    name={n.summary}
                    nameLines={2}
                    meta={dateLabel || '—'}
                    icon="chatbubble-ellipses-outline"
                    onPress={() => {
                      void haptics.selection();
                      setViewNote({
                        body: n.summary,
                        noteId: n.id,
                        dateLabel,
                        authorLabel: author || null,
                        kind: 'note',
                      });
                    }}
                  />
                </View>
              );
            })
          )}
        </CrmSection>
      </ListItemEnter>

      {canDelete ? (
        <ListItemEnter index={8}>
          <View style={{ paddingTop: theme.spacing.sm, paddingBottom: theme.spacing.xl }}>
            <DestructiveButton
              label={(() => {
                const v = t('customers.deleteDealer');
                return v === 'customers.deleteDealer' ? 'Delete dealer' : v;
              })()}
              onPress={() => {
                void haptics.selection();
                setDeleteOpen(true);
              }}
              style={{
                borderRadius: theme.radius.full,
                minHeight: theme.sizes.touch.min,
                paddingVertical: 0,
              }}
            />
          </View>
        </ListItemEnter>
      ) : null}

      <EditDealerSheet open={editOpen} onClose={() => setEditOpen(false)} dealer={dealer} />
      <DeleteDealerSheet
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        customerId={dealerId}
        dealerName={name}
        onDeleted={() => {
          onBack();
        }}
      />
      <AddContactSheet open={contactOpen} onClose={() => setContactOpen(false)} customerId={dealerId} />
      <AddAddressSheet
        open={addressOpen}
        onClose={() => setAddressOpen(false)}
        customerId={dealerId}
        existingAddresses={addresses.map((a) => ({
          id: a.id,
          label: a.label,
          isDefaultDelivery: a.isDefaultDelivery,
          isDefaultBilling: a.isDefaultBilling,
        }))}
      />
      <EditAddressSheet
        open={Boolean(editingAddress)}
        onClose={() => setEditingAddress(null)}
        customerId={dealerId}
        address={editingAddress}
        existingAddresses={addresses.map((a) => ({
          id: a.id,
          label: a.label,
          isDefaultDelivery: a.isDefaultDelivery,
          isDefaultBilling: a.isDefaultBilling,
        }))}
      />
      <AddNoteSheet open={noteOpen} onClose={() => setNoteOpen(false)} customerId={dealerId} />
      <ViewNoteSheet
        open={Boolean(viewNote)}
        onClose={() => setViewNote(null)}
        customerId={dealerId}
        noteId={viewNote?.noteId}
        body={viewNote?.body ?? ''}
        dateLabel={viewNote?.dateLabel}
        authorLabel={viewNote?.authorLabel}
        kind={viewNote?.kind}
        canEdit={canUpdate}
        onSaved={(next) =>
          setViewNote((prev) => (prev ? { ...prev, body: next } : null))
        }
      />
      <AddPriceSheet
        open={priceOpen}
        onClose={() => setPriceOpen(false)}
        customerId={dealerId}
        products={productsQuery.data?.data ?? []}
        pricedProductIds={prices
          .map((row) => row.productId || row.product?.id)
          .filter((id): id is string => Boolean(id))}
      />
      {pdfDownloadSheet}
    </ScrollableScreen>
  );
}

function DealerDetailTitle({
  onBack,
  titleWeight,
}: {
  onBack: () => void;
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
        <BackButton onPress={onBack} />
      </View>
      <AppText
        variant="largeTitle"
        weight={titleWeight}
        align="center"
        numberOfLines={1}
        style={{ paddingHorizontal: leadSize + theme.spacing.sm }}
      >
        {t('customers.detail')}
      </AppText>
    </View>
  );
}

function MetaRow({
  icon,
  label,
  value,
  valueLtr,
  emphasize,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  valueLtr?: boolean;
  emphasize?: boolean;
}) {
  const { isRTL } = useLocale();
  const { colors, theme } = useTheme();

  return (
    <View
      style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        gap: theme.spacing.md,
        paddingHorizontal: theme.spacing.md,
        paddingVertical: theme.spacing.sm + 2,
        backgroundColor: emphasize ? colors.brandSoft : 'transparent',
      }}
    >
      <View
        style={{
          width: 28,
          height: 28,
          borderRadius: 14,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: emphasize ? colors.surface : colors.brandSoft,
          borderWidth: 1,
          borderColor: emphasize ? colors.brand : colors.border,
        }}
      >
        <Ionicons
          name={icon}
          size={14}
          color={emphasize ? colors.brand : colors.textSecondary}
        />
      </View>
      <AppText
        variant="caption"
        color="muted"
        style={{
          textTransform: 'uppercase',
          letterSpacing: 0.45,
          fontSize: 10,
          flexShrink: 0,
          maxWidth: '34%',
          textAlign: isRTL ? 'right' : 'left',
        }}
      >
        {label}
      </AppText>
      <AppText
        weight={emphasize ? 'semibold' : 'medium'}
        dir={valueLtr ? 'ltr' : undefined}
        numberOfLines={2}
        style={{
          flex: 1,
          minWidth: 0,
          color: emphasize ? colors.brand : colors.textPrimary,
          textAlign: isRTL ? 'left' : 'right',
          fontSize: 13,
        }}
      >
        {value}
      </AppText>
    </View>
  );
}

function CrmPersonRow({
  name,
  meta,
  metaSecondary,
  icon,
  onPress,
  nameLines = 3,
}: {
  name: string;
  meta?: string | null;
  /** Optional third line (e.g. default delivery / billing) — omit when empty. */
  metaSecondary?: string | null;
  icon: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
  nameLines?: number;
}) {
  const { isRTL, locale } = useLocale();
  const { colors, theme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const hasSecondary = Boolean(metaSecondary?.trim());

  const body = (
    <>
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 18,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.brandSoft,
          borderWidth: 1,
          borderColor: colors.border,
          ...(hasSecondary ? { marginTop: 2 } : null),
        }}
      >
        <Ionicons name={icon} size={16} color={colors.brand} />
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <AppText
          weight={titleWeight}
          numberOfLines={nameLines}
          style={{ textAlign: isRTL ? 'right' : 'left', fontSize: 14, lineHeight: 20 }}
        >
          {name}
        </AppText>
        {meta?.trim() ? (
          <AppText
            variant="caption"
            color="secondary"
            style={{ textAlign: isRTL ? 'right' : 'left', lineHeight: 17 }}
          >
            {meta}
          </AppText>
        ) : null}
        {hasSecondary ? (
          <AppText
            variant="caption"
            color="muted"
            style={{ textAlign: isRTL ? 'right' : 'left', lineHeight: 16 }}
          >
            {metaSecondary}
          </AppText>
        ) : null}
      </View>
      {onPress ? (
        <Ionicons
          name={isRTL ? 'chevron-back' : 'chevron-forward'}
          size={18}
          color={colors.textMuted}
        />
      ) : null}
    </>
  );

  const rowStyle = {
    flexDirection: (isRTL ? 'row-reverse' : 'row') as 'row' | 'row-reverse',
    alignItems: (hasSecondary ? 'flex-start' : 'center') as 'flex-start' | 'center',
    gap: theme.spacing.md,
    paddingVertical: hasSecondary ? theme.spacing.sm : theme.spacing.xs + 2,
  };

  if (onPress) {
    return (
      <AnimatedPressable
        variant="button"
        accessibilityRole="button"
        accessibilityLabel={name}
        onPress={onPress}
        style={rowStyle}
      >
        {body}
      </AnimatedPressable>
    );
  }

  return <View style={rowStyle}>{body}</View>;
}

function EmptyTabHint({
  text,
  icon = 'file-tray-outline',
}: {
  text: string;
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  return <DealerEmptyPanel text={text} icon={icon} nested />;
}

function CrmSection({
  title,
  addLabel,
  canAdd,
  onAdd,
  children,
}: {
  title: string;
  addLabel: string;
  canAdd: boolean;
  onAdd: () => void;
  children: ReactNode;
}) {
  const { locale } = useLocale();
  const { theme, colors } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  return (
    <DealerBoard
      title={title}
      titleWeight={titleWeight}
      trailing={
        canAdd ? (
          <AnimatedPressable
            variant="button"
            accessibilityRole="button"
            accessibilityLabel={addLabel}
            onPress={() => {
              void haptics.selection();
              onAdd();
            }}
            style={{
              paddingHorizontal: theme.spacing.md,
              paddingVertical: theme.spacing.sm,
              borderRadius: theme.radius.full,
              backgroundColor: colors.brandSoft,
              borderWidth: 1,
              borderColor: colors.brand,
              minHeight: theme.sizes.touch.min - 8,
              justifyContent: 'center',
            }}
          >
            <AppText variant="caption" weight="semibold" color="brand">
              {`+ ${addLabel}`}
            </AppText>
          </AnimatedPressable>
        ) : undefined
      }
    >
      <View
        style={{
          borderRadius: theme.radius.lg,
          backgroundColor: colors.surfaceSecondary,
          borderWidth: 1,
          borderColor: colors.border,
          paddingHorizontal: theme.spacing.md,
          paddingVertical: theme.spacing.sm,
          overflow: 'hidden',
        }}
      >
        {children}
      </View>
    </DealerBoard>
  );
}
