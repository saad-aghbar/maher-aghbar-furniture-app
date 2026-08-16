import { type ReactNode, useEffect, useMemo, useState } from 'react';
import {
  Linking,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';
import Animated, {
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { can } from '@maher/permissions';
import { openInvoicePdf } from '@/api/modules/invoices';
import { usePdfDownload } from '@/features/pdf/usePdfDownload';
import {
  listCustomerAddresses,
  type CustomerAddress,
} from '@/api/modules/customers';
import { resolveDocumentUrl } from '@/api/modules/uploads';
import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { BackButton } from '@/components/BackButton';
import { StatusBadge } from '@/components/badges/StatusBadge';
import { DestructiveButton } from '@/components/buttons/DestructiveButton';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { OfflineBanner } from '@/components/feedback/OfflineBanner';
import { useToast, toastCopy } from '@/components/feedback/Toast';
import { DatePickerField } from '@/components/calendar';
import { LockedTextField } from '@/components/forms/LockedTextField';
import { CopyNotesButton } from '@/components/forms/CopyNotesButton';
import { AppScreen } from '@/components/layout/AppScreen';
import { useNetwork } from '@/components/network/NetworkProvider';
import { ActionSheet, type ActionSheetItem } from '@/components/sheets/ActionSheet';
import { ConfirmationSheet } from '@/components/sheets/ConfirmationSheet';
import { useLocale } from '@/i18n';
import { haptics, ListItemEnter } from '@/motion';
import { SURFACE_TAB_BAR_CLEARANCE } from '@/navigation/tabBarClearance';
import { useTheme } from '@/theme';
import {
  adminOrderFlowHref,
  dealerOrderFlowHref,
} from '@/features/production-flow/flowRoutes';
import { WorkflowProgressHit } from '@/features/production-flow/components/WorkflowProgressHit';
import { DeliveryFavoriteSummary } from '@/features/requests/components/DeliveryFavoriteSummary';
import {
  canCancelSalesOrder,
  canHoldSalesOrder,
  type SalesOrderDetail,
} from './api';
import { ImageCarousel } from './components/ImageCarousel';
import { resolveOrderMediaUri } from './components/OrderCardMedia';
import {
  costEditFromMaterials,
  costEditToPayload,
  emptyCostBreakdownEdit,
  ManufacturingCostEditor,
  type CostBreakdownEdit,
} from './components/ManufacturingCostEditor';
import {
  OrderBoardCard,
  OrderSectionHeader,
} from './components/OrderBoardCard';
import { LinkedTablePanel } from './components/LinkedTablePanel';
import { OrderDetailSkeleton } from './components/OrderDetailSkeleton';
import { orderBoardShadow } from './components/orderFloorStyle';
import { useSalesOrderActions, useSalesOrderQuery } from './query';
import {
  selectOrderDetail,
  type OrderDetailViewModel,
  type OrderLineItemView,
} from './selectOrderDetail';
import type { OrdersListVariant } from './selectOrderCard';
import { isOwnOrderSchedule } from '@/api/modules/scheduling';
import { useDealerDateChangeMutation, useOrderScheduleQuery } from '@/features/scheduling/query';
import { ChangeDeliveryDateSheet } from './components/ChangeDeliveryDateSheet';
import { OrderScheduleCard } from './components/OrderScheduleCard';
import { selectChangeDateCta } from './selectSchedulePromise';

type OrderDetailScreenProps = {
  orderId: string;
  variant: OrdersListVariant;
  forceState?: 'loading' | 'error' | 'offline' | 'success';
  fixture?: SalesOrderDetail;
};

type ConfirmKind = 'confirm' | 'hold' | 'cancel' | null;

export function OrderDetailScreen({
  orderId,
  variant,
  forceState,
  fixture,
}: OrderDetailScreenProps) {
  const { user } = useAuth();
  const { t, formatCurrency, formatDate, isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const insets = useSafeAreaInsets();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const { showOfflineBanner } = useNetwork();
  const { showToast } = useToast();
  const { pickPdfOptions, pdfDownloadSheet } = usePdfDownload();
  const router = useRouter();
  const allowed = can(user, 'sales-order.read');
  const canUpdate = can(user, 'sales-order.update');
  const canInvoice = can(user, 'invoice.read');
  const canDocument = can(user, 'document.read');

  const query = useSalesOrderQuery(orderId, allowed && !forceState);
  const actions = useSalesOrderActions(orderId);
  const refreshing = query.isRefetching && !query.isLoading;

  const [sheetOpen, setSheetOpen] = useState(false);
  const [confirmKind, setConfirmKind] = useState<ConfirmKind>(null);
  const [changeDateSheetOpen, setChangeDateSheetOpen] = useState(false);
  const [dateChangeError, setDateChangeError] = useState<string | null>(null);
  const [galleryUris, setGalleryUris] = useState<string[]>([]);
  const scrollY = useSharedValue(0);

  const [editNotes, setEditNotes] = useState('');
  const [editProject, setEditProject] = useState('');
  const [editDealerPo, setEditDealerPo] = useState('');
  const [editDeliveryDate, setEditDeliveryDate] = useState('');
  const [editDeliveryAddress, setEditDeliveryAddress] = useState('');
  const [costEdit, setCostEdit] = useState<CostBreakdownEdit>(emptyCostBreakdownEdit);
  const [savedAddresses, setSavedAddresses] = useState<CustomerAddress[]>([]);

  const raw: SalesOrderDetail | undefined =
    forceState === 'success' || forceState === 'offline' ? fixture : query.data;

  const addressCustomerId = user?.customerId ?? raw?.customer?.id ?? null;
  const canReadAddresses = Boolean(
    variant === 'dealer' && addressCustomerId && can(user, 'customer.read'),
  );

  useEffect(() => {
    if (!canReadAddresses || !addressCustomerId) {
      setSavedAddresses([]);
      return;
    }
    let cancelled = false;
    void listCustomerAddresses(addressCustomerId)
      .then((rows) => {
        if (!cancelled) setSavedAddresses(rows);
      })
      .catch(() => {
        if (!cancelled) setSavedAddresses([]);
      });
    return () => {
      cancelled = true;
    };
  }, [canReadAddresses, addressCustomerId]);

  const vm: OrderDetailViewModel | null = useMemo(
    () => (raw ? selectOrderDetail(raw, variant, locale) : null),
    [locale, raw, variant],
  );

  const scheduledProductionOrderId = vm?.productionOrders[0]?.id;
  const showSchedule = variant === 'dealer' && Boolean(scheduledProductionOrderId) && !forceState;
  const scheduleQuery = useOrderScheduleQuery(scheduledProductionOrderId, showSchedule);
  const ownSchedule =
    scheduleQuery.data && isOwnOrderSchedule(scheduleQuery.data) ? scheduleQuery.data : null;
  const dealerDateChange = useDealerDateChangeMutation(scheduledProductionOrderId ?? '');
  const changeDateCta = selectChangeDateCta(ownSchedule);

  const costSyncKey = useMemo(() => {
    if (!vm) return '';
    return JSON.stringify({
      id: vm.id,
      costs: vm.costMaterials,
      mfg: vm.manufacturingCost,
    });
  }, [vm]);

  useEffect(() => {
    if (!vm?.canEdit) return;
    setEditNotes(vm.notes ?? '');
    setEditProject(vm.projectName ?? '');
    setEditDealerPo(vm.customerRef ?? '');
    setEditDeliveryDate(vm.deliveryDate?.slice(0, 10) ?? '');
    setEditDeliveryAddress(vm.deliveryAddress ?? '');
    setCostEdit(costEditFromMaterials(vm.costMaterials));
    // Sync from server payload only — not on every local cost keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- costSyncKey captures materials
  }, [costSyncKey, vm?.canEdit]);

  useEffect(() => {
    if (!vm || vm.canEdit) return;
    setCostEdit(costEditFromMaterials(vm.costMaterials));
  }, [costSyncKey, vm?.canEdit]);

  const galleryDocIds = useMemo(
    () =>
      (vm?.documents ?? [])
        .filter((d) => d.isImage)
        .map((d) => d.id)
        .join('|'),
    [vm?.documents],
  );
  const galleryHeroKey = useMemo(
    () => (vm?.heroImageUrls ?? []).join('|'),
    [vm?.heroImageUrls],
  );

  useEffect(() => {
    let cancelled = false;
    async function loadGallery(model: OrderDetailViewModel) {
      const uris = model.heroImageUrls
        .map((u) => resolveOrderMediaUri(u))
        .filter((u): u is string => Boolean(u));
      if (canDocument || forceState) {
        for (const doc of model.documents) {
          if (!doc.isImage) continue;
          if (forceState) continue;
          try {
            const url = await resolveDocumentUrl(doc.id);
            if (!uris.includes(url)) uris.push(url);
          } catch {
            // skip failed signed URLs
          }
        }
      }
      if (cancelled) return;
      setGalleryUris((prev) => {
        if (prev.length === uris.length && prev.every((u, i) => u === uris[i])) {
          return prev;
        }
        return uris;
      });
    }
    if (vm) void loadGallery(vm);
    else setGalleryUris((prev) => (prev.length === 0 ? prev : []));
    return () => {
      cancelled = true;
    };
  }, [canDocument, forceState, galleryDocIds, galleryHeroKey, vm]);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollY.value = e.contentOffset.y;
    },
  });

  const headerFade = useAnimatedStyle(() => ({
    opacity: Math.max(0.35, 1 - scrollY.value / 140),
  }));

  const showAdminActions = variant === 'admin' && canUpdate && !forceState && vm;
  const showStickyActions = Boolean(
    showAdminActions &&
      (vm.isDraft || canHoldSalesOrder(vm.status) || canCancelSalesOrder(vm.status)),
  );
  /** Lift sticky bar above floating tab bar; leave room in the scroll. */
  const stickyBottom = SURFACE_TAB_BAR_CLEARANCE;
  const hasProductionWorkflow = (vm?.productionOrders?.length ?? 0) > 0;
  /** Extra beige clearance so dock / last boards clear the tab bar. */
  const stickyPad = showStickyActions
    ? stickyBottom + 148
    : theme.spacing['3xl'] +
      SURFACE_TAB_BAR_CLEARANCE +
      Math.max(insets.bottom, 0) +
      (variant === 'dealer' ? 56 : 24);

  const actionsSheet: ActionSheetItem[] = useMemo(() => {
    if (!vm) return [];
    const items: ActionSheetItem[] = [];
    if (canInvoice && vm.invoices[0]) {
      items.push({
        label: t('mobile.orderDetail.downloadInvoice'),
        icon: 'download-outline',
        onPress: () => {
          void (async () => {
            const opts = await pickPdfOptions();
            if (!opts) return;
            try {
              await openInvoicePdf(vm.invoices[0]!.id, opts);
            } catch {
              showToast({
                variant: 'error',
                message: toastCopy(
                  t('mobile.orderDetail.invoiceErrorTitle'),
                  t('mobile.orderDetail.invoiceErrorBody'),
                ),
              });
            }
          })();
        },
      });
    }
    if (canDocument && vm.documents[0]) {
      items.push({
        label: t('mobile.orderDetail.openAttachment'),
        icon: 'attach-outline',
        onPress: () => {
          void resolveDocumentUrl(vm.documents[0]!.id)
            .then((url) => Linking.openURL(url))
            .catch(() => {
              showToast({
                variant: 'error',
                message: toastCopy(
                  t('mobile.orderDetail.attachmentErrorTitle'),
                  t('mobile.orderDetail.attachmentErrorBody'),
                ),
              });
            });
        },
      });
    }
    return items;
  }, [vm, canInvoice, canDocument, t, pickPdfOptions, showToast]);

  function runStatusAction(kind: ConfirmKind, reason?: string) {
    if (!kind || forceState) return;
    const opts = {
      onSuccess: () => {
        void haptics.confirmMedium();
        showToast({
          variant: 'success',
          message: t(
            kind === 'confirm'
              ? 'mobile.orderDetail.confirmBanner'
              : kind === 'hold'
                ? 'mobile.orderDetail.holdBanner'
                : 'mobile.orderDetail.cancelBanner',
          ),
        });
      },
      onError: () =>
        showToast({ variant: 'error', message: t('mobile.orderDetail.actionFailed') }),
    };
    if (kind === 'confirm') actions.confirm.mutate(undefined, opts);
    else if (kind === 'hold') actions.hold.mutate(reason, opts);
    else if (kind === 'cancel') actions.cancel.mutate(reason, opts);
  }

  function saveDraftEdits() {
    if (!vm?.canEdit || forceState) return;
    const costs = costEditToPayload(costEdit);
    actions.update.mutate(
      {
        notes: editNotes,
        projectName: editProject,
        externalOrderNumber: editDealerPo,
        requiredDeliveryDate: editDeliveryDate || null,
        deliveryAddress: editDeliveryAddress,
        manufacturingCost: costs.manufacturingCost,
        costBreakdown: costs.costBreakdown,
      },
      {
        onSuccess: () => {
          void haptics.confirmMedium();
          showToast({
            variant: 'success',
            message: t('mobile.orderDetail.saveSuccess'),
          });
        },
        onError: () =>
          showToast({
            variant: 'error',
            message: t('mobile.orderDetail.saveFailed'),
          }),
      },
    );
  }

  if (forceState === 'loading' || (allowed && query.isLoading && !query.data && !forceState)) {
    return (
      <AppScreen edges={{ top: true, bottom: false }} style={{ paddingHorizontal: 0 }}>
        <DetailNav onBack={() => router.back()} title={t('mobile.orderDetail.title')} />
        <OrderDetailSkeleton />
      </AppScreen>
    );
  }

  if (!allowed && !forceState) {
    return (
      <AppScreen>
        <DetailNav onBack={() => router.back()} title={t('mobile.orderDetail.title')} />
        <EmptyState title={t('mobile.noModules')} description={t('mobile.noModulesHint')} />
      </AppScreen>
    );
  }

  if (forceState === 'error' || (query.isError && !query.data && !forceState)) {
    return (
      <AppScreen>
        {showOfflineBanner ? <OfflineBanner /> : null}
        <DetailNav onBack={() => router.back()} title={t('mobile.orderDetail.title')} />
        <ErrorState
          title={t('mobile.orderDetail.errorTitle')}
          description={t('mobile.orderDetail.errorBody')}
          retryLabel={t('mobile.orderDetail.retry')}
          onRetry={() => void query.refetch()}
        />
      </AppScreen>
    );
  }

  if (!vm) {
    return (
      <AppScreen>
        <DetailNav onBack={() => router.back()} title={t('mobile.orderDetail.title')} />
        <EmptyState
          title={t('mobile.orderDetail.errorTitle')}
          description={t('mobile.orderDetail.errorBody')}
        />
      </AppScreen>
    );
  }

  let section = 0;
  const nextIndex = () => {
    const i = section;
    section += 1;
    return i;
  };

  return (
    <AppScreen edges={{ top: true, bottom: false }} style={{ paddingHorizontal: 0 }}>
      {showOfflineBanner || forceState === 'offline' ? (
        <View style={{ paddingHorizontal: theme.spacing.lg }}>
          <OfflineBanner />
        </View>
      ) : null}
      <Animated.View style={[{ paddingHorizontal: theme.spacing.lg }, headerFade]}>
        <DetailNav
          onBack={() => router.back()}
          title={vm.number}
          subtitle={vm.showCosts ? vm.dealerName : null}
          trailing={<StatusBadge status={vm.status} dot />}
          onMore={actionsSheet.length ? () => setSheetOpen(true) : undefined}
        />
      </Animated.View>

      <Animated.ScrollView
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        refreshControl={
          forceState ? undefined : (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void query.refetch()}
              tintColor={colors.brand}
            />
          )
        }
        contentContainerStyle={{ paddingBottom: stickyPad }}
      >
        <ImageCarousel uris={galleryUris} height={260} />

        <View
          style={{
            paddingHorizontal: theme.spacing.lg,
            gap: theme.spacing.md,
            marginTop: theme.spacing.md,
          }}
        >
          <ListItemEnter index={nextIndex()}>
            <OrderBoardCard accent={colors.brand}>
              <AppText variant="title" weight={titleWeight}>
                {vm.title ?? vm.number}
              </AppText>
              <AppText
                variant="caption"
                color="secondary"
                dir="ltr"
                style={{ letterSpacing: 0.2 }}
              >
                {vm.number}
              </AppText>
              {vm.showCosts === false && vm.customerRef ? (
                <AppText variant="caption" color="muted">
                  {t('mobile.orderDetail.customerRef')}: {vm.customerRef}
                </AppText>
              ) : null}
              {vm.showCosts && vm.dealerName ? (
                <AppText variant="caption" color="muted">
                  {t('mobile.orders.dealer')}: {vm.dealerName}
                </AppText>
              ) : null}
            </OrderBoardCard>
          </ListItemEnter>

          {vm.showCosts ? (
            <ListItemEnter index={nextIndex()}>
              <View
                style={{
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  gap: theme.spacing.sm,
                }}
              >
                <OrderBoardCard style={{ flex: 1 }}>
                  <AppText variant="caption" color="muted">
                    {t('mobile.orderDetail.systemOrderNumber')}
                  </AppText>
                  <AppText variant="label" weight="semibold" dir="ltr">
                    {vm.number}
                  </AppText>
                </OrderBoardCard>
                <OrderBoardCard style={{ flex: 1 }}>
                  {vm.canEdit ? (
                    <LockedTextField
                      label={
                        variant === 'dealer'
                          ? t('mobile.dealerAccount.yourOrderNumber')
                          : t('mobile.orderDetail.dealerOrderNumber')
                      }
                      value={editDealerPo}
                      onChangeText={setEditDealerPo}
                      locked={false}
                    />
                  ) : (
                    <>
                      <AppText variant="caption" color="muted">
                        {variant === 'dealer'
                          ? t('mobile.dealerAccount.yourOrderNumber')
                          : t('mobile.orderDetail.dealerOrderNumber')}
                      </AppText>
                      <AppText variant="label" weight="semibold">
                        {vm.customerRef ?? '—'}
                      </AppText>
                    </>
                  )}
                </OrderBoardCard>
              </View>
            </ListItemEnter>
          ) : null}

          {vm.showCosts && vm.productionOrders.length > 0 ? (
            <ListItemEnter index={nextIndex()}>
              <LinkedTablePanel
                title={t('mobile.orderDetail.linkedProduction')}
                icon="construct-outline"
                rows={vm.productionOrders.map((po) => ({
                  id: po.id,
                  number: po.number,
                  status: po.status,
                  details:
                    po.progressPercent != null
                      ? `${Math.round(po.progressPercent)}%`
                      : '—',
                }))}
              />
            </ListItemEnter>
          ) : null}

          {hasProductionWorkflow || vm.progressPercent > 0 ? (
            <ListItemEnter index={nextIndex()}>
              <OrderBoardCard accent={colors.brand}>
                <OrderSectionHeader
                  icon="analytics-outline"
                  label={t('mobile.orderDetail.progress')}
                  accent={colors.brand}
                />
                <View
                  style={{
                    flexDirection: isRTL ? 'row-reverse' : 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: theme.spacing.sm,
                  }}
                >
                  <AppText
                    variant="caption"
                    color="secondary"
                    numberOfLines={1}
                    style={{ flex: 1 }}
                  >
                    {vm.progressLabel?.trim() || t('mobile.orders.progress')}
                  </AppText>
                  <AppText
                    variant="caption"
                    weight="semibold"
                    style={{ color: colors.brand }}
                    dir="ltr"
                  >
                    {`${Math.round(vm.progressPercent)}%`}
                  </AppText>
                </View>
                <WorkflowProgressHit
                  progressPercent={vm.progressPercent}
                  height={6}
                  accessibilityLabel={
                    hasProductionWorkflow
                      ? t('mobile.productionFlow.openWorkflow')
                      : undefined
                  }
                  onPress={
                    hasProductionWorkflow
                      ? () => {
                          void haptics.selection();
                          router.push(
                            variant === 'admin'
                              ? adminOrderFlowHref(vm.id)
                              : dealerOrderFlowHref(vm.id),
                          );
                        }
                      : undefined
                  }
                />
                {hasProductionWorkflow ? (
                  <AppText variant="caption" color="brand" weight="medium">
                    {t('mobile.productionFlow.openWorkflow')}
                  </AppText>
                ) : null}
              </OrderBoardCard>
            </ListItemEnter>
          ) : null}

          {showSchedule ? (
            <ListItemEnter index={nextIndex()}>
              <OrderScheduleCard
                schedule={ownSchedule}
                isLoading={scheduleQuery.isLoading}
                onChangeDate={() => {
                  setDateChangeError(null);
                  void haptics.selection();
                  setChangeDateSheetOpen(true);
                }}
              />
            </ListItemEnter>
          ) : null}

          {vm.showCosts ? (
            <ListItemEnter index={nextIndex()}>
              <View
                style={{
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  flexWrap: 'wrap',
                  gap: theme.spacing.sm,
                }}
              >
                <MoneyChip
                  label={t('mobile.orderDetail.sellerPrice')}
                  value={vm.sellerPrice}
                  formatCurrency={formatCurrency}
                  footnote={(() => {
                    const v = t('sales.autoCalculated');
                    return v === 'sales.autoCalculated' ? 'Auto-calculated' : v;
                  })()}
                />
                <MoneyChip
                  label={t('mobile.orderDetail.productionPrice')}
                  value={vm.manufacturingCost}
                  formatCurrency={formatCurrency}
                  footnote={(() => {
                    const v = t('sales.fromInventoryCosts');
                    return v === 'sales.fromInventoryCosts'
                      ? 'Auto from inventory material prices'
                      : v;
                  })()}
                />
                <MoneyChip
                  label={t('mobile.orderDetail.profit')}
                  value={vm.profit}
                  formatCurrency={formatCurrency}
                  emphasize
                />
              </View>
            </ListItemEnter>
          ) : vm.sellerPrice != null ? (
            <ListItemEnter index={nextIndex()}>
              <OrderBoardCard>
                <OrderSectionHeader
                  icon="pricetag-outline"
                  label={t('mobile.orderDetail.sellingPrice')}
                />
                <AppText variant="label" weight="semibold" dir="ltr">
                  {formatCurrency(vm.sellerPrice)}
                </AppText>
              </OrderBoardCard>
            </ListItemEnter>
          ) : null}

          {vm.showEndCustomer ? (
            <ListItemEnter index={nextIndex()}>
              <OrderBoardCard>
                <OrderSectionHeader
                  icon="person-outline"
                  label={t('mobile.orderDetail.customerOrder')}
                  trailing={
                    vm.requestSource ? (
                      <StatusBadge status={vm.requestSource} dot />
                    ) : undefined
                  }
                />
                <FieldRow label={t('mobile.orderDetail.endCustomer')} value={vm.endCustomerName} />
                <FieldRow label={t('mobile.orderDetail.phone')} value={vm.phone} ltr />
                <FieldRow label={t('mobile.orderDetail.fax')} value={vm.fax} ltr />
                {vm.canEdit ? (
                  <>
                    <DatePickerField
                      label={t('mobile.orderDetail.deliveryDate')}
                      value={editDeliveryDate}
                      onChange={setEditDeliveryDate}
                    />
                    <LockedTextField
                      label={t('mobile.orderDetail.deliveryAddress')}
                      value={editDeliveryAddress}
                      onChangeText={setEditDeliveryAddress}
                      locked={false}
                      multiline
                    />
                    <LockedTextField
                      label={t('mobile.orderDetail.project')}
                      value={editProject}
                      onChangeText={setEditProject}
                      locked={false}
                    />
                  </>
                ) : (
                  <>
                    <FieldRow
                      label={t('mobile.orderDetail.deliveryDate')}
                      value={vm.deliveryDate ? formatDate(vm.deliveryDate) : null}
                      ltr
                    />
                    <FieldRow
                      label={t('mobile.orderDetail.deliveryAddress')}
                      value={vm.deliveryAddress}
                    />
                    <FieldRow label={t('mobile.orderDetail.project')} value={vm.projectName} />
                  </>
                )}
              </OrderBoardCard>
            </ListItemEnter>
          ) : (
            <ListItemEnter index={nextIndex()}>
              <OrderBoardCard>
                <OrderSectionHeader
                  icon="navigate-outline"
                  label={t('mobile.orders.expectedDelivery')}
                />
                {vm.deliveryDate ? (
                  <AppText variant="body">{formatDate(vm.deliveryDate)}</AppText>
                ) : (
                  <AppText variant="caption" color="muted">
                    —
                  </AppText>
                )}
                <DeliveryFavoriteSummary
                  deliveryAddress={vm.deliveryAddress}
                  savedAddresses={savedAddresses}
                />
              </OrderBoardCard>
            </ListItemEnter>
          )}

          {vm.showCosts || vm.items.length > 0 ? (
            <ListItemEnter index={nextIndex()}>
              <OrderBoardCard>
                <OrderSectionHeader
                  icon="cube-outline"
                  label={t('mobile.orderDetail.whatTheyOrdered')}
                />
                {vm.items.length === 0 ? (
                  <AppText variant="caption" color="muted">
                    {t('mobile.orderDetail.noCustomerItems')}
                  </AppText>
                ) : (
                  vm.items.map((item) => <LineItemCard key={item.id} item={item} t={t} />)
                )}
              </OrderBoardCard>
            </ListItemEnter>
          ) : null}

          {vm.showEndCustomer &&
          (vm.translatedText || vm.originalText || vm.canEdit) ? (
            <ListItemEnter index={nextIndex()}>
              <OrderBoardCard>
                <OrderSectionHeader
                  icon="document-text-outline"
                  label={t('mobile.orderDetail.customerNotes')}
                />
                {vm.detectedLanguage ? (
                  <AppText variant="caption" color="muted">
                    {t('mobile.orderDetail.detectedLanguage')}: {vm.detectedLanguage}
                    {vm.targetLanguage ? ` → ${vm.targetLanguage}` : ''}
                  </AppText>
                ) : null}
                {vm.canEdit ? (
                  <LockedTextField
                    label={t('mobile.orderDetail.internalNotes')}
                    value={editNotes}
                    onChangeText={setEditNotes}
                    locked={false}
                    multiline
                    copyable
                  />
                ) : vm.translatedText ? (
                  <View style={{ gap: theme.spacing.xs }}>
                    <View
                      style={{
                        flexDirection: isRTL ? 'row-reverse' : 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <AppText variant="label" color="secondary" style={{ flex: 1 }}>
                        {t('mobile.orderDetail.internalNotes')}
                      </AppText>
                      <CopyNotesButton
                        value={vm.translatedText}
                        label={t('mobile.orderDetail.internalNotes')}
                      />
                    </View>
                    <AppText variant="body">{vm.translatedText}</AppText>
                  </View>
                ) : null}
                {vm.originalText && vm.originalText !== vm.translatedText ? (
                  <View style={{ gap: 4 }}>
                    <AppText variant="caption" color="muted">
                      {t('mobile.orderDetail.originalHandwriting')}
                    </AppText>
                    <AppText variant="caption" color="secondary">
                      {vm.originalText}
                    </AppText>
                  </View>
                ) : null}
              </OrderBoardCard>
            </ListItemEnter>
          ) : vm.notes || vm.fabricSummary ? (
            <ListItemEnter index={nextIndex()}>
              <OrderBoardCard>
                <OrderSectionHeader
                  icon="document-text-outline"
                  label={t('mobile.orderDetail.notes')}
                />
                {vm.notes ? <AppText variant="body">{vm.notes}</AppText> : null}
                {vm.fabricSummary ? (
                  <View style={{ gap: theme.spacing.xs }}>
                    <AppText variant="caption" color="muted">
                      {t('mobile.orderDetail.fabric')}
                    </AppText>
                    <AppText variant="body">{vm.fabricSummary}</AppText>
                  </View>
                ) : null}
              </OrderBoardCard>
            </ListItemEnter>
          ) : null}

          {vm.showCosts ? (
            <ListItemEnter index={nextIndex()}>
              <ManufacturingCostEditor
                edit={costEdit}
                onChange={setCostEdit}
                editable={vm.canEdit}
                formatCurrency={formatCurrency}
              />
            </ListItemEnter>
          ) : null}

          {vm.canEdit ? (
            <ListItemEnter index={nextIndex()}>
              <PrimaryButton
                label={t('mobile.orderDetail.saveChanges')}
                onPress={saveDraftEdits}
                loading={actions.update.isPending}
              />
            </ListItemEnter>
          ) : null}

          {vm.showStages ? (
            <ListItemEnter index={nextIndex()}>
              <OrderBoardCard accent={colors.brand}>
                <OrderSectionHeader
                  icon="git-network-outline"
                  label={t('mobile.orderDetail.productionJourney')}
                  accent={colors.brand}
                />
                {vm.assignedWorkerName ? (
                  <AppText variant="caption" color="secondary">
                    {t('mobile.orderDetail.assignedWorker')}: {vm.assignedWorkerName}
                  </AppText>
                ) : null}
                {vm.productionOrders.length === 0 && vm.stages.length === 0 ? (
                  <AppText variant="caption" color="muted">
                    {t('mobile.orderDetail.noProductionYet')}
                  </AppText>
                ) : (
                  <SecondaryButton
                    label={t('mobile.productionFlow.openWorkflow')}
                    onPress={() => {
                      void haptics.selection();
                      router.push(
                        variant === 'admin'
                          ? adminOrderFlowHref(vm.id)
                          : dealerOrderFlowHref(vm.id),
                      );
                    }}
                  />
                )}
              </OrderBoardCard>
            </ListItemEnter>
          ) : null}

          {vm.documents.length ? (
            <ListItemEnter index={nextIndex()}>
              <OrderBoardCard>
                <OrderSectionHeader
                  icon="attach-outline"
                  label={t('mobile.orderDetail.attachments')}
                />
                {vm.documents.map((doc) => (
                  <Pressable
                    key={doc.id}
                    disabled={!canDocument && !forceState}
                    onPress={() => {
                      if (!canDocument && !forceState) return;
                      void resolveDocumentUrl(doc.id)
                        .then((url) => Linking.openURL(url))
                        .catch(() => {
                          showToast({
                            variant: 'error',
                            message: toastCopy(
                              t('mobile.orderDetail.attachmentErrorTitle'),
                              t('mobile.orderDetail.attachmentErrorBody'),
                            ),
                          });
                        });
                    }}
                    style={{ minHeight: theme.sizes.touch.min, justifyContent: 'center' }}
                  >
                    <AppText variant="body" color="brand">
                      {doc.fileName}
                    </AppText>
                  </Pressable>
                ))}
              </OrderBoardCard>
            </ListItemEnter>
          ) : null}

          {vm.invoices.length ? (
            <ListItemEnter index={nextIndex()}>
              <LinkedTablePanel
                title={t('mobile.orderDetail.invoices')}
                icon="receipt-outline"
                rows={vm.invoices.map((inv) => ({
                  id: inv.id,
                  number: inv.number,
                  status: inv.status,
                  details:
                    inv.total != null ? formatCurrency(inv.total) : '—',
                  onPress:
                    canInvoice || forceState
                      ? () => {
                          const href =
                            variant === 'admin'
                              ? (`/(app)/(admin)/invoices/${inv.id}` as Href)
                              : (`/(app)/(customer)/invoices/${inv.id}` as Href);
                          router.push(href);
                        }
                      : undefined,
                }))}
              />
            </ListItemEnter>
          ) : null}

          {vm.showCosts ? (
            <ListItemEnter index={nextIndex()}>
              <LinkedTablePanel
                title={t('mobile.orderDetail.deliveries')}
                icon="car-outline"
                empty={t('mobile.orderDetail.noLinkedDeliveries')}
                rows={vm.deliveries.map((d) => ({
                  id: d.id,
                  number: d.number,
                  status: d.status,
                  details: d.deliveryDate
                    ? formatDate(d.deliveryDate)
                    : '—',
                }))}
              />
            </ListItemEnter>
          ) : null}

          {vm.returns.length || variant === 'dealer' || vm.showCosts ? (
            <ListItemEnter index={nextIndex()}>
              <LinkedTablePanel
                title={t('mobile.orderDetail.returns')}
                icon="return-down-back-outline"
                empty={t('mobile.orderDetail.noLinkedReturns')}
                rows={vm.returns.map((r) => ({
                  id: r.id,
                  number: r.number,
                  status: r.status,
                  details: r.productDesc ?? r.reason ?? '—',
                  onPress: () => {
                    const href =
                      variant === 'admin'
                        ? (`/(app)/(admin)/returns/${r.id}` as Href)
                        : (`/(app)/(customer)/returns/${r.id}` as Href);
                    router.push(href);
                  },
                }))}
              />
              {variant === 'dealer' ? (
                <SecondaryButton
                  label={t('mobile.returns.newReturn')}
                  onPress={() =>
                    router.push('/(app)/(customer)/returns/create' as Href)
                  }
                  style={{ marginTop: theme.spacing.sm, borderRadius: theme.radius.xl }}
                />
              ) : null}
            </ListItemEnter>
          ) : null}

          {!vm.canEdit && vm.showCosts && !vm.isDraft ? (
            <AppText variant="caption" color="muted" style={{ textAlign: 'center' }}>
              {t('mobile.orderDetail.editLocked')}
            </AppText>
          ) : null}
        </View>
      </Animated.ScrollView>

      {showStickyActions ? (
        <View
          pointerEvents="box-none"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: stickyBottom,
            paddingHorizontal: theme.spacing.lg,
            paddingTop: theme.spacing.sm,
            paddingBottom: theme.spacing.md,
          }}
        >
          <View
            style={{
              borderRadius: theme.radius.xl,
              borderWidth: 1,
              borderColor: colors.borderStrong,
              backgroundColor: colors.surface,
              padding: theme.spacing.md,
              gap: theme.spacing.sm,
              ...orderBoardShadow(colorScheme),
            }}
          >
            {vm.isDraft ? (
              <View
                style={{
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  gap: theme.spacing.sm,
                }}
              >
                {canCancelSalesOrder(vm.status) ? (
                  <View style={{ flex: 1 }}>
                    <DestructiveButton
                      label={t('mobile.orderDetail.cancelOrder')}
                      onPress={() => setConfirmKind('cancel')}
                    />
                  </View>
                ) : null}
                <View style={{ flex: 1 }}>
                  <PrimaryButton
                    label={t('mobile.orderDetail.confirm')}
                    onPress={() => setConfirmKind('confirm')}
                    loading={actions.confirm.isPending}
                  />
                </View>
              </View>
            ) : (
              <View
                style={{
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  gap: theme.spacing.sm,
                }}
              >
                {canHoldSalesOrder(vm.status) ? (
                  <View style={{ flex: 1 }}>
                    <SecondaryButton
                      label={t('mobile.orderDetail.hold')}
                      onPress={() => setConfirmKind('hold')}
                    />
                  </View>
                ) : null}
                {canCancelSalesOrder(vm.status) ? (
                  <View style={{ flex: 1 }}>
                    <DestructiveButton
                      label={t('mobile.orderDetail.cancelOrder')}
                      onPress={() => setConfirmKind('cancel')}
                    />
                  </View>
                ) : null}
              </View>
            )}
          </View>
        </View>
      ) : null}

      <ActionSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={t('mobile.orderDetail.actions')}
        actions={actionsSheet}
        cancelLabel={t('mobile.orderDetail.cancel')}
      />
      {pdfDownloadSheet}

      <ConfirmationSheet
        open={confirmKind === 'confirm'}
        onClose={() => setConfirmKind(null)}
        title={t('mobile.orderDetail.confirm')}
        message={t('mobile.orderDetail.confirmDescription')}
        confirmLabel={t('mobile.orderDetail.confirm')}
        cancelLabel={t('mobile.orderDetail.cancel')}
        onConfirm={() => runStatusAction('confirm')}
      />
      <ConfirmationSheet
        open={confirmKind === 'hold'}
        onClose={() => setConfirmKind(null)}
        title={t('mobile.orderDetail.hold')}
        message={t('mobile.orderDetail.holdDescription')}
        confirmLabel={t('mobile.orderDetail.hold')}
        cancelLabel={t('mobile.orderDetail.cancel')}
        reasonLabel={t('mobile.orderDetail.reasonOptional')}
        reasonPlaceholder={t('mobile.orderDetail.reasonPlaceholder')}
        onConfirm={(reason) => runStatusAction('hold', reason)}
      />
      <ConfirmationSheet
        open={confirmKind === 'cancel'}
        onClose={() => setConfirmKind(null)}
        title={t('mobile.orderDetail.cancelOrder')}
        message={t('mobile.orderDetail.cancelDescription')}
        confirmLabel={t('mobile.orderDetail.cancelOrder')}
        cancelLabel={t('mobile.orderDetail.cancel')}
        destructive
        reasonLabel={t('mobile.orderDetail.reasonOptional')}
        reasonPlaceholder={t('mobile.orderDetail.reasonPlaceholder')}
        onConfirm={(reason) => runStatusAction('cancel', reason)}
      />

      {showSchedule ? (
        <ChangeDeliveryDateSheet
          open={changeDateSheetOpen}
          onClose={() => setChangeDateSheetOpen(false)}
          mode={changeDateCta.mode}
          current={ownSchedule?.requestedDeliveryDate}
          availabilityItems={(
            raw?.customerRequest?.items ??
            raw?.orderedItems ??
            []
          )
            .filter((item): item is typeof item & { productId: string } =>
              Boolean(item.productId),
            )
            .map((item) => ({
              productId: item.productId,
              quantity: Number(item.quantity ?? 1) || 1,
            }))}
          loading={dealerDateChange.isPending}
          errorMessage={dateChangeError}
          onSubmit={(isoDate) => {
            dealerDateChange.mutate(
              { requestedDeliveryDate: isoDate },
              {
                onSuccess: (res) => {
                  void haptics.confirmMedium();
                  setChangeDateSheetOpen(false);
                  showToast({
                    variant: 'success',
                    message: t(
                      res.action === 'updated'
                        ? 'mobile.orderDetail.schedule.dateUpdated'
                        : 'mobile.orderDetail.schedule.dateRequestSent',
                    ),
                  });
                },
                onError: () => setDateChangeError(t('mobile.orderDetail.schedule.dateChangeFailed')),
              },
            );
          }}
        />
      ) : null}
    </AppScreen>
  );
}

function MoneyChip({
  label,
  value,
  formatCurrency,
  emphasize,
  footnote,
}: {
  label: string;
  value: number | null;
  formatCurrency: (n: number) => string;
  emphasize?: boolean;
  footnote?: string;
}) {
  const { colors } = useTheme();

  return (
    <OrderBoardCard
      accent={emphasize ? colors.brand : undefined}
      style={{ flexGrow: 1, flexBasis: '30%', minWidth: 100 }}
    >
      <AppText variant="caption" color="muted">
        {label}
      </AppText>
      <AppText variant={emphasize ? 'label' : 'body'} weight="semibold" dir="ltr">
        {value != null ? formatCurrency(value) : '—'}
      </AppText>
      {footnote ? (
        <AppText variant="caption" color="muted" style={{ fontSize: 10, lineHeight: 13 }}>
          {footnote}
        </AppText>
      ) : null}
    </OrderBoardCard>
  );
}

function FieldRow({
  label,
  value,
  ltr,
}: {
  label: string;
  value: string | null | undefined;
  ltr?: boolean;
}) {
  return (
    <View style={{ gap: 2 }}>
      <AppText variant="caption" color="muted">
        {label}
      </AppText>
      <AppText variant="body" style={ltr ? { writingDirection: 'ltr' } : undefined}>
        {value?.trim() ? value : '—'}
      </AppText>
    </View>
  );
}

function LineItemCard({
  item,
  t,
}: {
  item: OrderLineItemView;
  t: (key: string) => string;
}) {
  const { colors, theme } = useTheme();
  const bits = [
    item.dimensions,
    item.fabricType
      ? `${t('mobile.orderDetail.fabric')}: ${item.fabricType}${
          item.fabricColor ? ` / ${item.fabricColor}` : ''
        }`
      : null,
    item.material
      ? `${t('mobile.orderDetail.material')}: ${item.material}`
      : null,
    item.woodType,
    item.foamDensity,
    item.finish,
    item.accessories,
  ].filter(Boolean);

  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: theme.radius.lg,
        padding: theme.spacing.sm,
        gap: theme.spacing.xs,
        backgroundColor: colors.surfaceSecondary,
        overflow: 'hidden',
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          gap: theme.spacing.sm,
        }}
      >
        <AppText variant="body" weight="semibold" style={{ flex: 1 }}>
          {item.productName}
        </AppText>
        {item.quantity != null ? (
          <AppText variant="caption" color="secondary">
            × {item.quantity}
          </AppText>
        ) : null}
      </View>
      {item.description ? (
        <AppText variant="caption" color="secondary">
          {item.description}
        </AppText>
      ) : null}
      {bits.length ? (
        <AppText variant="caption" color="muted">
          {bits.join(' · ')}
        </AppText>
      ) : null}
      {item.notes ? (
        <AppText variant="caption" color="secondary">
          {item.notes}
        </AppText>
      ) : null}
    </View>
  );
}

function DetailNav({
  onBack,
  title,
  subtitle,
  trailing,
  onMore,
}: {
  onBack: () => void;
  title: string;
  subtitle?: string | null;
  trailing?: ReactNode;
  onMore?: () => void;
}) {
  const { t, isRTL } = useLocale();
  const { theme, colors, colorScheme } = useTheme();

  const moreFill = colorScheme === 'dark' ? colors.brand : colors.brandSoft;
  const moreInk = colorScheme === 'dark' ? colors.onBrand : colors.brand;

  return (
    <View
      style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        gap: theme.spacing.sm,
        minHeight: theme.sizes.touch.min,
        marginBottom: theme.spacing.sm,
      }}
    >
      <BackButton onPress={onBack} label={t('mobile.orderDetail.back')} />
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <AppText
          variant="title"
          weight="semibold"
          numberOfLines={1}
          dir="ltr"
          style={{ textAlign: isRTL ? 'right' : 'left' }}
        >
          {title}
        </AppText>
        {subtitle ? (
          <AppText
            variant="caption"
            color="secondary"
            numberOfLines={1}
            style={{ textAlign: isRTL ? 'right' : 'left' }}
          >
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {trailing ? (
        <View
          style={{
            justifyContent: 'center',
            alignItems: 'center',
            maxWidth: '42%',
          }}
        >
          <View style={{ alignSelf: 'center' }}>{trailing}</View>
        </View>
      ) : null}
      {onMore ? (
        <Pressable
          onPress={() => {
            void haptics.selection();
            onMore();
          }}
          accessibilityRole="button"
          accessibilityLabel={t('mobile.orderDetail.actions')}
          hitSlop={8}
          style={{
            minWidth: theme.sizes.touch.min,
            minHeight: theme.sizes.touch.min,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: moreFill,
              borderWidth: 1,
              borderColor: colors.brand,
              alignItems: 'center',
              justifyContent: 'center',
              ...theme.elevation.raised,
            }}
          >
            <Ionicons name="ellipsis-horizontal" size={18} color={moreInk} />
          </View>
        </Pressable>
      ) : null}
    </View>
  );
}
