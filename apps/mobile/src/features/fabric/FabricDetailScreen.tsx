import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { can } from '@maher/permissions';
import { isApiError } from '@/api/errors';
import { toastMessageForError } from '@/api/queryClient';
import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { ProductThumb } from '@/components/desk/ProductThumb';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { OfflineBanner } from '@/components/feedback/OfflineBanner';
import { useToast, toastCopy } from '@/components/feedback/Toast';
import { QtyStepperField } from '@/components/forms/QtyStepperField';
import { TextField } from '@/components/forms/TextField';
import { AppScreen } from '@/components/layout/AppScreen';
import { useNetwork } from '@/components/network/NetworkProvider';
import { ConfirmationSheet } from '@/components/sheets/ConfirmationSheet';
import { PurchasingSupplierSheet } from '@/features/purchasing/components/PurchasingSupplierSheet';
import {
  useFabricProcurementActions,
  useFabricProcurementByCodeQuery,
  useFabricProcurementQuery,
  useSuppliersQuery,
} from '@/features/purchasing/query';
import { CreateWarehouseSheet } from '@/features/inventory/components/CreateWarehouseSheet';
import { HoldingLocationBox, type HoldingLocationOption } from '@/features/inventory/components/HoldingLocationBox';
import { HoldingLocationFormSheet } from '@/features/inventory/components/HoldingLocationFormSheet';
import {
  flattenInventoryItemPages,
  useDeleteWarehouseLocationMutation,
  useInventoryItemsInfiniteQuery,
  useWarehousesQuery,
} from '@/features/inventory/query';
import { selectInventoryItemCard } from '@/features/inventory/selectInventory';
import { openFabricLotQrLabelPdf } from '@/features/inventory/api';
import { usePdfDownload } from '@/features/pdf/usePdfDownload';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics, ListItemEnter } from '@/motion';
import { SURFACE_TAB_BAR_CLEARANCE } from '@/navigation/tabBarClearance';
import { useTheme } from '@/theme';
import { resolveFabricStageLabel, resolveFabricStatusLabel } from './fabricCopy';
import { FabricActionSheet, FabricInset } from './FabricActionSheet';
import {
  fabricActionSet,
  SUPPLIER_REPLY_STATES,
  type FabricActionId,
  type FabricSheetKind,
  type SupplierReplyState,
} from './fabricActionSet';
import {
  fabricAwaitsSupply,
  fabricRemainingNeed,
  fabricStatusKind,
  fabricStockCoverage,
  fabricToneForKind,
  formatFabricQty,
  selectFabricTrackerRow,
} from './selectFabricTracker';
import { resolveFabricTone } from './fabricToneVisuals';

type Props = {
  procurementId?: string;
  code?: string;
  backFallback?: Href;
};

const pill = (radius: number, min: number) =>
  ({
    borderRadius: radius,
    minHeight: min,
    paddingVertical: 0,
  }) as const;

export function FabricDetailScreen({ procurementId, code, backFallback }: Props) {
  const { user } = useAuth();
  const { t, locale, formatDate, formatNumber, formatCurrency, isRTL } = useLocale();
  const { theme, colors } = useTheme();
  const { showOfflineBanner } = useNetwork();
  const { showToast } = useToast();
  const { pickPdfOptions, pdfDownloadSheet } = usePdfDownload();
  const router = useRouter();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const fallback =
    backFallback ??
    (code
      ? ('/(app)/(admin)/inventory/fabric' as Href)
      : ('/(app)/(admin)/purchasing?tab=fabric' as Href));

  const canProcurement = can(user, 'fabric.procurement.read');
  const canInventory = can(user, 'inventory.read');
  const canManage = can(user, 'fabric.procurement.manage');
  const canOverride = can(user, 'production.fabric.override');
  const canReceive = can(user, 'inventory.receive');
  const canOpenOrder = can(user, 'sales-order.read');
  const canOpenPo = can(user, 'purchase-order.read');
  const canReadSupplier = can(user, 'supplier.read');
  const canCost = can(user, 'inventory.cost.read');
  const canPrint = canInventory || canProcurement;
  const canManageLocations = canReceive || can(user, 'warehouse.manage');
  const canAddWarehouse = can(user, 'warehouse.manage');

  const byCodeQuery = useFabricProcurementByCodeQuery(code, Boolean(code) && (canProcurement || canInventory));
  const idFromCode = byCodeQuery.data?.id;
  const resolvedId = procurementId || idFromCode;
  const byIdQuery = useFabricProcurementQuery(
    resolvedId,
    Boolean(resolvedId) && (canProcurement || canInventory) && !code,
  );
  const query = code ? byCodeQuery : byIdQuery;
  const item = query.data ?? null;
  const row = useMemo(() => (item ? selectFabricTrackerRow(item) : null), [item]);
  const actions = useFabricProcurementActions(resolvedId ?? '');
  const suppliersQuery = useSuppliersQuery(canReadSupplier, { status: 'ACTIVE' });
  const warehousesQuery = useWarehousesQuery(canReceive || canManage);
  const stockQuery = useInventoryItemsInfiniteQuery(
    { categoryGroup: 'fabric' },
    canManage,
  );
  const stockItems = useMemo(
    () => flattenInventoryItemPages(stockQuery.data).map((raw) => selectInventoryItemCard(raw, locale)),
    [stockQuery.data, locale],
  );

  const [sheet, setSheet] = useState<FabricSheetKind | null>(null);
  const [whatsappBody, setWhatsappBody] = useState('');
  const [draftSupplierId, setDraftSupplierId] = useState<string | null>(null);
  const [waitNote, setWaitNote] = useState('');
  const [waitEta, setWaitEta] = useState('');
  const [replyState, setReplyState] = useState<SupplierReplyState>('SUPPLIER_CONFIRMED');
  const [replyNote, setReplyNote] = useState('');
  const [overrideReason, setOverrideReason] = useState('');
  const [arriveQty, setArriveQty] = useState('');
  const [arriveLocationId, setArriveLocationId] = useState<string | null>(null);
  const [stockItemId, setStockItemId] = useState<string | null>(null);
  const [stockQty, setStockQty] = useState('');
  const [printing, setPrinting] = useState(false);
  const [supplierPicker, setSupplierPicker] = useState<'ask' | 'redirect' | null>(null);
  const [holdingEditor, setHoldingEditor] = useState<'create' | 'edit' | null>(null);
  const [editingHolding, setEditingHolding] = useState<HoldingLocationOption | null>(null);
  const [removingHolding, setRemovingHolding] = useState<HoldingLocationOption | null>(null);
  const [createWarehouseOpen, setCreateWarehouseOpen] = useState(false);
  const [pendingWarehouseId, setPendingWarehouseId] = useState<string | null>(null);
  const deleteLocation = useDeleteWarehouseLocationMutation();

  const kind = row ? fabricStatusKind(row) : 'WAITING';
  const actionIds = row
    ? fabricActionSet({
        kind,
        storedState: row.storedState,
        expectedQty: row.expectedQty,
        arrivedQty: row.arrivedQty,
        hasLot: row.lots.length > 0,
        purchaseOrderId: row.purchaseOrderId,
        supplierInvoiceId: row.supplierInvoiceId,
        salesOrderId: row.salesOrderId,
        overridden: row.overridden,
        canPrint,
        canOpenOrder,
        canOpenPo,
        canManage,
        canReceive,
        canOverride,
      })
    : [];

  const rawWarehouses = useMemo(
    () => (warehousesQuery.data ?? []).filter((w) => !w.type || w.type === 'RAW_MATERIALS'),
    [warehousesQuery.data],
  );
  const locations = useMemo(() => {
    const out: HoldingLocationOption[] = [];
    for (const w of rawWarehouses) {
      const wName = locale === 'ar' ? w.nameAr || w.nameEn : w.nameEn || w.nameAr;
      for (const loc of w.locations ?? []) {
        out.push({
          id: loc.id,
          warehouseId: w.id,
          code: loc.code,
          name: loc.name,
          label: loc.name?.trim() || loc.code || wName,
          warehouseLabel: wName,
        });
      }
    }
    return out;
  }, [rawWarehouses, locale]);

  const supplierOptions = (suppliersQuery.data?.data ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    code: s.code,
  }));

  useEffect(() => {
    if (sheet !== 'arrive') return;
    if (arriveLocationId && locations.some((loc) => loc.id === arriveLocationId)) return;
    const fromLot = row?.lots[0]?.locationId;
    const next =
      (fromLot && locations.some((loc) => loc.id === fromLot) ? fromLot : null) ??
      locations[0]?.id ??
      null;
    if (next) setArriveLocationId(next);
  }, [sheet, locations, arriveLocationId, row]);

  function fail(err: unknown, fallbackMsg: string) {
    void haptics.error();
    showToast({
      variant: 'error',
      message: isApiError(err) ? toastMessageForError(err) : fallbackMsg,
    });
  }

  function succeed(message: string, close = true) {
    void haptics.confirmLight();
    showToast({ variant: 'success', message });
    if (close) setSheet(null);
  }

  async function runPrint() {
    const lot = row?.lots.find((l) => l.qrCode) ?? row?.lots[0];
    if (!lot?.id || printing) {
      if (!lot?.id) {
        showToast({
          variant: 'error',
          message: toastCopy(t('mobile.inventory.labelPdfFailedTitle'), t('mobile.inventory.labelPdfFailedBody')),
        });
      }
      return;
    }
    const opts = await pickPdfOptions();
    if (!opts) return;
    setPrinting(true);
    try {
      await openFabricLotQrLabelPdf(lot.id, lot.qrCode ?? undefined, opts);
      void haptics.confirmLight();
    } catch {
      void haptics.error();
      showToast({
        variant: 'error',
        message: toastCopy(t('mobile.inventory.labelPdfFailedTitle'), t('mobile.inventory.labelPdfFailedBody')),
      });
    } finally {
      setPrinting(false);
    }
  }

  function openSheet(next: FabricSheetKind) {
    if (next === 'ask') {
      const supplierId = item?.supplier?.id ?? supplierOptions[0]?.id ?? null;
      setDraftSupplierId(supplierId);
      if (!supplierId) {
        showToast({ variant: 'error', message: t('mobile.purchasing.fabricNoSupplier') });
        setSupplierPicker('ask');
        return;
      }
      actions.draftWhatsApp.mutate(
        { ids: [resolvedId!], supplierId },
        {
          onSuccess: (draft) => {
            setWhatsappBody(draft.body);
            setSheet('ask');
          },
          onError: (err) => fail(err, t('mobile.purchasing.createFailed')),
        },
      );
      return;
    }
    if (next === 'arrive') {
      const remaining =
        row?.expectedQty != null ? Math.max(0, row.expectedQty - row.arrivedQty) : row?.expectedQty ?? 0;
      setArriveQty(remaining > 0 ? String(remaining) : '');
      setArriveLocationId(
        row?.lots[0]?.locationId ?? locations[0]?.id ?? null,
      );
    }
    if (next === 'stock') {
      const first = stockItems.find((s) => s.freeQty > 0);
      setStockItemId(row?.inventoryItemId ?? first?.id ?? null);
      const need =
        row?.expectedQty != null ? Math.max(0, row.expectedQty - row.arrivedQty) : 0;
      setStockQty(need > 0 ? String(need) : '');
    }
    if (next === 'replied') {
      setReplyState('SUPPLIER_CONFIRMED');
      setReplyNote('');
    }
    if (next === 'wait') {
      setWaitNote('');
      setWaitEta('');
    }
    if (next === 'override') setOverrideReason('');
    setSheet(next);
  }

  function onAction(id: FabricActionId) {
    if (id === 'print') {
      void runPrint();
      return;
    }
    if (id === 'openOrder' && row?.salesOrderId) {
      router.push(`/(app)/(admin)/orders/${row.salesOrderId}` as Href);
      return;
    }
    if (id === 'openPo' && row?.purchaseOrderId) {
      router.push(`/(app)/(admin)/purchasing/${row.purchaseOrderId}` as Href);
      return;
    }
    if (id === 'openInvoice' && row?.supplierInvoiceId) {
      router.push(`/(app)/(admin)/purchasing/supplier-invoices/${row.supplierInvoiceId}` as Href);
      return;
    }
    const map: Record<string, FabricSheetKind> = {
      askSupplier: 'ask',
      takeFromStock: 'stock',
      supplierReplied: 'replied',
      wait: 'wait',
      redirect: 'redirect',
      confirmArrival: 'arrive',
      override: 'override',
    };
    const next = map[id];
    if (next) openSheet(next);
  }

  if (!canProcurement && !canInventory) {
    return (
      <AppScreen backFallback={fallback}>
        <EmptyState title={t('mobile.noModules')} description={t('mobile.noModulesHint')} />
      </AppScreen>
    );
  }

  if (query.isError && !query.data) {
    return (
      <AppScreen backFallback={fallback}>
        {showOfflineBanner ? <OfflineBanner /> : null}
        <ErrorState
          title={t('mobile.purchasing.errorTitle')}
          description={t('mobile.purchasing.errorBody')}
          retryLabel={t('mobile.purchasing.retry')}
          onRetry={() => void query.refetch()}
        />
      </AppScreen>
    );
  }

  if (!row || !item) {
    return (
      <AppScreen backFallback={fallback}>
        <EmptyState title={t('mobile.purchasing.fabricLoading')} />
      </AppScreen>
    );
  }

  const statusLabel = resolveFabricStatusLabel(t, row, 'desk');
  const stageLabel = resolveFabricStageLabel(t, row.stageCode);
  const tone = resolveFabricTone(fabricToneForKind(kind), colors);
  const qr = row.qrCodes[0] ?? null;
  const remaining =
    row.expectedQty != null ? Math.max(0, row.expectedQty - row.arrivedQty) : null;
  const stockHint = (() => {
    if (!fabricAwaitsSupply(row) || !row.inventoryItemId) return null;
    const free = stockItems.find((s) => s.id === row.inventoryItemId)?.freeQty ?? 0;
    if (!(free > 0)) return null;
    const need = fabricRemainingNeed(row);
    const cover = fabricStockCoverage({ need, free });
    if (cover === 'partial' && need != null) {
      return t('mobile.inventory.fabricCoversPartial', { free, need, unit: row.unit });
    }
    return t('mobile.inventory.fabricInGeneralStock');
  })();
  const selectedStock = stockItems.find((s) => s.id === stockItemId);
  const stockMax =
    selectedStock != null
      ? remaining != null
        ? Math.min(selectedStock.freeQty, remaining)
        : selectedStock.freeQty
      : undefined;
  const catalogCost =
    row.resolvedUnitCost != null && row.resolvedUnitCost > 0 ? row.resolvedUnitCost : null;
  const costReady = canCost ? catalogCost != null : row.costOnFile;
  const arriveValid = Number(arriveQty) > 0 && Boolean(arriveLocationId) && costReady;
  const overrideValid = overrideReason.trim().length >= 3;
  const stockValid = Boolean(stockItemId) && Number(stockQty) > 0;
  const askValid = Boolean(draftSupplierId) && whatsappBody.trim().length > 0;
  const busy = (fn: { isPending?: boolean }) => Boolean(fn.isPending);

  const actionLabel: Record<FabricActionId, string> = {
    print: t('mobile.inventory.fabricPrintLabel'),
    openOrder: t('mobile.inventory.fabricOpenOrder'),
    openPo: t('mobile.purchasing.fabricOpenPo'),
    openInvoice: t('mobile.purchasing.fabricOpenInvoice'),
    askSupplier: t('mobile.purchasing.fabricAskSupplier'),
    takeFromStock: t('mobile.purchasing.fabricTakeFromStock'),
    supplierReplied: t('mobile.purchasing.fabricSupplierReplied'),
    wait: t('mobile.purchasing.fabricWait'),
    redirect: t('mobile.purchasing.fabricRedirect'),
    confirmArrival: t('mobile.purchasing.fabricConfirmArrival'),
    override: t('mobile.purchasing.fabricOverride'),
  };

  return (
    <AppScreen backFallback={fallback}>
      {showOfflineBanner ? <OfflineBanner /> : null}
      <ScrollView
        contentContainerStyle={{
          gap: theme.spacing.md,
          paddingBottom: theme.spacing['3xl'] + SURFACE_TAB_BAR_CLEARANCE,
        }}
      >
        <ListItemEnter index={0}>
          <Board accent={tone.rail}>
            <HeaderBand
              title={t('mobile.inventory.fabricBundleEyebrow')}
              trailing={statusLabel}
              trailingColor={tone.chipInk}
            />
            <View style={{ padding: theme.spacing.lg, gap: theme.spacing.sm, ...railPad(isRTL, theme.spacing.lg) }}>
              <AppText weight={titleWeight} style={{ textAlign: isRTL ? 'right' : 'left' }}>
                {row.label}
              </AppText>
              {row.role ? (
                <AppText variant="caption" color="muted" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                  {row.role}
                </AppText>
              ) : null}
              {stageLabel ? (
                <AppText variant="caption" color="muted" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                  {t('mobile.inventory.fabricRequiredFor')}: {stageLabel}
                </AppText>
              ) : null}
              {stockHint ? (
                <AppText variant="caption" style={{ color: colors.brand, textAlign: isRTL ? 'right' : 'left' }}>
                  {stockHint}
                </AppText>
              ) : null}
            </View>
          </Board>
        </ListItemEnter>

        <ListItemEnter index={1}>
          <Board>
            <HeaderBand title={t('mobile.purchasing.fabricTrackerTitle')} />
            <View
              style={{
                padding: theme.spacing.lg,
                gap: theme.spacing.md,
                flexDirection: isRTL ? 'row-reverse' : 'row',
                alignItems: 'center',
                ...railPad(isRTL, theme.spacing.lg),
              }}
            >
              <ProductThumb uri={row.productImageUrl ?? row.imageUrl} size={64} radius={theme.radius.lg} />
              <View style={{ flex: 1, gap: 4 }}>
                {row.orderNumber ? (
                  <AppText weight={titleWeight} dir="ltr">
                    {row.orderNumber}
                  </AppText>
                ) : null}
                {row.productName ? (
                  <AppText variant="caption" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                    {row.productName}
                  </AppText>
                ) : null}
                {row.dealerName ? (
                  <AppText variant="caption" color="muted" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                    {row.dealerName}
                  </AppText>
                ) : null}
              </View>
            </View>
          </Board>
        </ListItemEnter>

        <ListItemEnter index={2}>
          <Board>
            <HeaderBand title={t('mobile.purchasing.fabricQtyArrived')} />
            <View style={{ padding: theme.spacing.lg, ...railPad(isRTL, theme.spacing.lg) }}>
              <FabricInset>
                <Fact label={t('mobile.purchasing.fabricQtyNeeded')} value={formatFabricQty(row)} ltr />
                <Fact
                  label={t('mobile.purchasing.fabricLocation')}
                  value={row.locationLabel ?? t('mobile.inventory.fabricBundleNoLocation')}
                />
                {qr ? <Fact label={t('mobile.inventory.fabricQr')} value={qr} ltr /> : null}
                {canCost && row.lots[0]?.unitCost != null ? (
                  <Fact
                    label={t('mobile.purchasing.unitCost')}
                    value={formatCurrency(Number(row.lots[0].unitCost))}
                    ltr
                  />
                ) : null}
              </FabricInset>
            </View>
          </Board>
        </ListItemEnter>

        <ListItemEnter index={3}>
          <Board>
            <HeaderBand title={t('mobile.purchasing.supplier')} />
            <View style={{ padding: theme.spacing.lg, gap: theme.spacing.sm, ...railPad(isRTL, theme.spacing.lg) }}>
              <AppText style={{ textAlign: isRTL ? 'right' : 'left' }}>
                {row.supplierName ?? t('mobile.purchasing.fabricNoSupplier')}
              </AppText>
              {row.expectedAvailableAt ? (
                <AppText variant="caption" color="muted">
                  {t('mobile.purchasing.fabricEta')}: {formatDate(row.expectedAvailableAt)}
                </AppText>
              ) : null}
              {row.purchaseOrderNumber ? (
                <AppText variant="caption" dir="ltr">
                  {t('mobile.purchasing.fabricPoNumber')}: {row.purchaseOrderNumber}
                </AppText>
              ) : null}
              {row.supplierInvoiceNumber ? (
                <AppText variant="caption" dir="ltr">
                  {t('mobile.purchasing.fabricInvoice')}: {row.supplierInvoiceNumber}
                </AppText>
              ) : null}
              {row.overridden ? (
                <AppText variant="caption" style={{ color: colors.warning }}>
                  {t('mobile.purchasing.fabricOverriddenNote')}
                </AppText>
              ) : null}
            </View>
          </Board>
        </ListItemEnter>

        {(item.events ?? []).length > 0 ? (
          <ListItemEnter index={4}>
            <Board>
              <HeaderBand title={t('mobile.purchasing.fabricHistory')} />
              <View style={{ padding: theme.spacing.lg, gap: theme.spacing.sm, ...railPad(isRTL, theme.spacing.lg) }}>
                {(item.events ?? []).map((ev) => {
                  const key = `mobile.fabricEvent.${ev.kind}`;
                  const label = t(key);
                  return (
                    <View key={ev.id} style={{ gap: 2 }}>
                      <AppText variant="caption" weight={titleWeight}>
                        {label === key ? ev.kind.replace(/_/g, ' ') : label}
                      </AppText>
                      {ev.note ? (
                        <AppText variant="caption" color="muted">
                          {ev.note}
                        </AppText>
                      ) : null}
                      <AppText variant="caption" color="muted" dir="ltr">
                        {formatDate(ev.createdAt)}
                      </AppText>
                    </View>
                  );
                })}
              </View>
            </Board>
          </ListItemEnter>
        ) : null}

        {actionIds.length > 0 ? (
          <ListItemEnter index={5}>
            <View style={{ gap: theme.spacing.sm }}>
              {actionIds.map((id) => {
                const primary =
                  id === 'askSupplier' ||
                  id === 'confirmArrival' ||
                  id === 'print' ||
                  id === 'takeFromStock';
                const Btn = primary ? PrimaryButton : SecondaryButton;
                return (
                  <Btn
                    key={id}
                    label={actionLabel[id]}
                    loading={id === 'print' ? printing : false}
                    onPress={() => {
                      void haptics.selection();
                      onAction(id);
                    }}
                    style={pill(theme.radius.full, theme.sizes.touch.min)}
                  />
                );
              })}
            </View>
          </ListItemEnter>
        ) : null}
      </ScrollView>

      <FabricActionSheet
        open={sheet === 'ask'}
        onClose={() => setSheet(null)}
        title={t('mobile.purchasing.fabricAskSupplier')}
        icon="chatbubble-ellipses-outline"
        primaryLabel={t('mobile.purchasing.fabricSendWhatsApp')}
        primaryDisabled={!askValid}
        primaryLoading={busy(actions.sendWhatsApp) || busy(actions.draftWhatsApp)}
        onPrimary={() => {
          if (!draftSupplierId || !askValid || actions.sendWhatsApp.isPending) return;
          actions.sendWhatsApp.mutate(
            { ids: [resolvedId!], supplierId: draftSupplierId, body: whatsappBody },
            {
              onSuccess: () => succeed(t('mobile.purchasing.fabricSendSuccess')),
              onError: (err) => fail(err, t('mobile.purchasing.createFailed')),
            },
          );
        }}
      >
        <AppText variant="caption" color="muted" style={{ textAlign: isRTL ? 'right' : 'left' }}>
          {item.supplier?.name ?? supplierOptions.find((s) => s.id === draftSupplierId)?.name}
        </AppText>
        <FabricInset>
          <TextField
            label={t('mobile.purchasing.fabricWhatsAppBody')}
            value={whatsappBody}
            onChangeText={setWhatsappBody}
            multiline
            growMinHeight={140}
          />
        </FabricInset>
        <SecondaryButton
          label={t('mobile.purchasing.pickSupplier')}
          onPress={() => setSupplierPicker('ask')}
          style={pill(theme.radius.full, theme.sizes.touch.min)}
        />
      </FabricActionSheet>

      <FabricActionSheet
        open={sheet === 'replied'}
        onClose={() => setSheet(null)}
        title={t('mobile.purchasing.fabricSupplierReplied')}
        icon="return-down-back-outline"
        primaryLabel={t('mobile.purchasing.confirm')}
        primaryLoading={busy(actions.setState)}
        onPrimary={() => {
          if (actions.setState.isPending) return;
          actions.setState.mutate(
            { state: replyState, note: replyNote.trim() || undefined },
            {
              onSuccess: () => succeed(t('mobile.purchasing.updateSuccess')),
              onError: (err) => fail(err, t('mobile.purchasing.updateFailed')),
            },
          );
        }}
      >
        <View style={{ gap: theme.spacing.sm }}>
          {SUPPLIER_REPLY_STATES.map((state) => {
            const active = replyState === state;
            return (
              <AnimatedPressable
                key={state}
                variant="button"
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => {
                  void haptics.selection();
                  setReplyState(state);
                }}
                style={{
                  minHeight: theme.sizes.touch.min,
                  borderRadius: theme.radius.lg,
                  borderWidth: 1,
                  borderColor: active ? colors.brand : colors.border,
                  backgroundColor: active ? colors.brandSoft : colors.surfaceSecondary,
                  paddingHorizontal: theme.spacing.md,
                  justifyContent: 'center',
                }}
              >
                <AppText weight={titleWeight} style={{ color: active ? colors.brand : colors.textPrimary }}>
                  {t(`mobile.purchasing.fabricReply.${state}`)}
                </AppText>
              </AnimatedPressable>
            );
          })}
        </View>
        <TextField
          label={t('mobile.purchasing.notes')}
          value={replyNote}
          onChangeText={setReplyNote}
        />
      </FabricActionSheet>

      <FabricActionSheet
        open={sheet === 'wait'}
        onClose={() => setSheet(null)}
        title={t('mobile.purchasing.fabricWait')}
        icon="hourglass-outline"
        primaryLabel={t('mobile.purchasing.fabricWait')}
        primaryLoading={busy(actions.wait)}
        onPrimary={() => {
          if (actions.wait.isPending) return;
          actions.wait.mutate(
            { note: waitNote.trim() || undefined, expectedAvailableAt: waitEta.trim() || undefined },
            {
              onSuccess: () => succeed(t('mobile.purchasing.fabricWaitSuccess')),
              onError: (err) => fail(err, t('mobile.purchasing.updateFailed')),
            },
          );
        }}
      >
        <TextField label={t('mobile.purchasing.fabricWaitNote')} value={waitNote} onChangeText={setWaitNote} />
        <TextField
          label={t('mobile.purchasing.fabricEta')}
          value={waitEta}
          onChangeText={setWaitEta}
          placeholder="YYYY-MM-DD"
          autoCapitalize="none"
        />
      </FabricActionSheet>

      <FabricActionSheet
        open={sheet === 'redirect'}
        onClose={() => setSheet(null)}
        title={t('mobile.purchasing.fabricRedirect')}
        icon="swap-horizontal-outline"
        primaryLabel={t('mobile.purchasing.fabricRedirect')}
        primaryDisabled={!draftSupplierId}
        primaryLoading={busy(actions.redirect)}
        onPrimary={() => {
          if (!draftSupplierId || actions.redirect.isPending) return;
          actions.redirect.mutate(
            { supplierId: draftSupplierId },
            {
              onSuccess: () => succeed(t('mobile.purchasing.fabricRedirectSuccess')),
              onError: (err) => fail(err, t('mobile.purchasing.updateFailed')),
            },
          );
        }}
      >
        <AppText style={{ textAlign: isRTL ? 'right' : 'left' }}>
          {supplierOptions.find((s) => s.id === draftSupplierId)?.name ?? t('mobile.purchasing.pickSupplier')}
        </AppText>
        <SecondaryButton
          label={t('mobile.purchasing.pickSupplier')}
          onPress={() => setSupplierPicker('redirect')}
          style={pill(theme.radius.full, theme.sizes.touch.min)}
        />
      </FabricActionSheet>

      <FabricActionSheet
        open={sheet === 'arrive'}
        onClose={() => setSheet(null)}
        title={t('mobile.purchasing.fabricConfirmArrival')}
        icon="cube-outline"
        primaryLabel={t('mobile.purchasing.fabricConfirmArrival')}
        primaryDisabled={!arriveValid}
        primaryLoading={busy(actions.receive)}
        onPrimary={() => {
          if (!arriveValid || !arriveLocationId || actions.receive.isPending) return;
          actions.receive.mutate(
            {
              qty: Number(arriveQty),
              locationId: arriveLocationId,
              idempotencyKey: `fabric-receive:${resolvedId}:${Date.now()}`,
            },
            {
              onSuccess: () => succeed(t('mobile.purchasing.fabricReceiveSuccess')),
              onError: (err) => fail(err, t('mobile.purchasing.updateFailed')),
            },
          );
        }}
      >
        {remaining != null ? (
          <AppText variant="caption" color="muted">
            {t('mobile.purchasing.fabricQtyNeeded')}: {formatNumber(remaining)} {row.unit}
          </AppText>
        ) : null}
        <QtyStepperField
          label={t('mobile.purchasing.fabricArrivalQty')}
          value={arriveQty}
          onChangeText={setArriveQty}
          min={0}
          max={remaining ?? undefined}
          step={0.5}
          unit={row.unit}
        />
        <HoldingLocationBox
          locations={locations}
          selectedId={arriveLocationId}
          canManage={canManageLocations}
          hasWarehouse={rawWarehouses.length > 0}
          onSelect={setArriveLocationId}
          onAdd={() => {
            setEditingHolding(null);
            setHoldingEditor('create');
          }}
          onEdit={(row) => {
            setEditingHolding(row);
            setHoldingEditor('edit');
          }}
          onRemove={setRemovingHolding}
          onAddWarehouse={canAddWarehouse ? () => setCreateWarehouseOpen(true) : undefined}
        />
        {canCost && catalogCost != null ? (
          <View
            style={{
              borderRadius: theme.radius.lg,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.surfaceSecondary,
              padding: theme.spacing.md,
              gap: 4,
            }}
          >
            <View
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                justifyContent: 'space-between',
                gap: theme.spacing.sm,
              }}
            >
              <AppText variant="caption" color="muted">
                {t('mobile.purchasing.fabricUnitCost')}
              </AppText>
              <AppText weight={titleWeight} dir="ltr">
                {formatCurrency(catalogCost)}
              </AppText>
            </View>
            <AppText
              variant="caption"
              color="muted"
              style={{ textAlign: isRTL ? 'right' : 'left' }}
            >
              {t('mobile.purchasing.unitCostFromInventory')}
            </AppText>
          </View>
        ) : !row.costOnFile ? (
          <AppText variant="caption" color="error">
            {t('mobile.purchasing.fabricNoPriceYet')}
          </AppText>
        ) : null}
      </FabricActionSheet>

      <FabricActionSheet
        open={sheet === 'stock'}
        onClose={() => setSheet(null)}
        title={t('mobile.purchasing.fabricTakeFromStock')}
        icon="file-tray-outline"
        primaryLabel={t('mobile.purchasing.fabricTakeFromStock')}
        primaryDisabled={!stockValid}
        primaryLoading={busy(actions.allocateFromStock)}
        onPrimary={() => {
          if (!stockItemId || !stockValid || actions.allocateFromStock.isPending) return;
          actions.allocateFromStock.mutate(
            { inventoryItemId: stockItemId, qty: Number(stockQty) },
            {
              onSuccess: () => succeed(t('mobile.purchasing.fabricAllocateSuccess')),
              onError: (err) => fail(err, t('mobile.purchasing.updateFailed')),
            },
          );
        }}
      >
        <View style={{ gap: theme.spacing.sm }}>
          {stockItems.filter((s) => s.freeQty > 0).map((s) => {
            const active = stockItemId === s.id;
            return (
              <AnimatedPressable
                key={s.id}
                variant="button"
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => {
                  void haptics.selection();
                  setStockItemId(s.id);
                }}
                style={{
                  minHeight: theme.sizes.touch.min,
                  borderRadius: theme.radius.lg,
                  borderWidth: 1,
                  borderColor: active ? colors.brand : colors.border,
                  backgroundColor: active ? colors.brandSoft : colors.surfaceSecondary,
                  padding: theme.spacing.md,
                  gap: 2,
                }}
              >
                <AppText weight={titleWeight} style={{ color: active ? colors.brand : colors.textPrimary }}>
                  {s.name}
                </AppText>
                <AppText variant="caption" color="muted" dir="ltr">
                  {formatNumber(s.freeQty)} {s.unit} {t('mobile.inventory.available')}
                </AppText>
              </AnimatedPressable>
            );
          })}
        </View>
        <QtyStepperField
          label={t('mobile.purchasing.quantity')}
          value={stockQty}
          onChangeText={setStockQty}
          min={0}
          max={stockMax}
          step={0.5}
          unit={row.unit}
        />
      </FabricActionSheet>

      <FabricActionSheet
        open={sheet === 'override'}
        onClose={() => setSheet(null)}
        title={t('mobile.purchasing.fabricOverride')}
        icon="shield-checkmark-outline"
        primaryLabel={t('mobile.purchasing.fabricOverride')}
        primaryDisabled={!overrideValid}
        primaryLoading={busy(actions.override)}
        onPrimary={() => {
          if (!overrideValid || actions.override.isPending) return;
          actions.override.mutate(overrideReason.trim(), {
            onSuccess: () => succeed(t('mobile.purchasing.fabricOverrideSuccess')),
            onError: (err) => fail(err, t('mobile.purchasing.updateFailed')),
          });
        }}
      >
        <TextField
          label={t('mobile.purchasing.fabricOverrideReason')}
          value={overrideReason}
          onChangeText={setOverrideReason}
          error={
            overrideReason.length > 0 && !overrideValid
              ? t('mobile.purchasing.fabricOverrideTooShort')
              : undefined
          }
        />
      </FabricActionSheet>

      {pdfDownloadSheet}

      <HoldingLocationFormSheet
        open={holdingEditor != null}
        overlay
        warehouses={rawWarehouses}
        editing={holdingEditor === 'edit' ? editingHolding : null}
        defaultWarehouseId={
          pendingWarehouseId ??
          editingHolding?.warehouseId ??
          rawWarehouses.find((w) => w.isDefault)?.id ??
          rawWarehouses[0]?.id
        }
        onClose={() => {
          setHoldingEditor(null);
          setEditingHolding(null);
          setPendingWarehouseId(null);
        }}
        onSaved={(id) => setArriveLocationId(id)}
      />

      <CreateWarehouseSheet
        open={createWarehouseOpen}
        overlay
        defaultType="RAW_MATERIALS"
        onClose={() => setCreateWarehouseOpen(false)}
        onCreated={(wh) => {
          setCreateWarehouseOpen(false);
          setPendingWarehouseId(wh.id);
          setEditingHolding(null);
          setHoldingEditor('create');
        }}
      />

      <ConfirmationSheet
        open={removingHolding != null}
        overlay
        destructive
        title={t('mobile.purchasing.fabricHoldingRemove')}
        message={t('mobile.purchasing.fabricHoldingRemoveBody', {
          name: removingHolding?.label ?? '',
        })}
        confirmLabel={t('mobile.purchasing.fabricHoldingRemove')}
        cancelLabel={t('mobile.purchasing.cancel')}
        onClose={() => setRemovingHolding(null)}
        onConfirm={() => {
          if (!removingHolding || deleteLocation.isPending) return;
          const target = removingHolding;
          deleteLocation.mutate(
            { warehouseId: target.warehouseId, locationId: target.id },
            {
              onSuccess: () => {
                if (arriveLocationId === target.id) setArriveLocationId(null);
                succeed(t('mobile.purchasing.fabricHoldingRemoved'), false);
              },
              onError: (err) => fail(err, t('mobile.purchasing.updateFailed')),
            },
          );
        }}
      />

      <PurchasingSupplierSheet
        open={supplierPicker != null}
        overlay
        allowNone={false}
        onClose={() => setSupplierPicker(null)}
        suppliers={supplierOptions}
        selectedId={draftSupplierId}
        onConfirm={(s) => {
          setDraftSupplierId(s?.id ?? null);
          setSupplierPicker(null);
          if (supplierPicker === 'ask' && s?.id && resolvedId) {
            actions.draftWhatsApp.mutate(
              { ids: [resolvedId], supplierId: s.id },
              {
                onSuccess: (draft) => {
                  setWhatsappBody(draft.body);
                  setSheet('ask');
                },
                onError: (err) => fail(err, t('mobile.purchasing.createFailed')),
              },
            );
          }
        }}
      />
    </AppScreen>
  );
}

function Board({ children, accent }: { children: ReactNode; accent?: string }) {
  const { isRTL } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const rail = accent ?? colors.brand;
  return (
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
          width: 3,
          backgroundColor: rail,
          opacity: 0.55,
          ...(isRTL ? { right: 0 } : { left: 0 }),
        }}
      />
      {children}
    </View>
  );
}

function HeaderBand({
  title,
  trailing,
  trailingColor,
}: {
  title: string;
  trailing?: string;
  trailingColor?: string;
}) {
  const { isRTL, locale } = useLocale();
  const { colors, theme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  return (
    <View
      style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: theme.spacing.sm,
        paddingHorizontal: theme.spacing.lg,
        paddingVertical: theme.spacing.md,
        ...(isRTL ? { paddingRight: theme.spacing.lg + 4 } : { paddingLeft: theme.spacing.lg + 4 }),
        backgroundColor: colors.surfaceSecondary,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
      }}
    >
      <AppText
        variant="caption"
        weight={titleWeight}
        style={{
          color: colors.brand,
          textTransform: locale === 'ar' ? 'none' : 'uppercase',
          letterSpacing: locale === 'ar' ? 0 : 0.5,
        }}
      >
        {title}
      </AppText>
      {trailing ? (
        <AppText variant="caption" weight={titleWeight} style={{ color: trailingColor ?? colors.textMuted }}>
          {trailing}
        </AppText>
      ) : null}
    </View>
  );
}

function Fact({ label, value, ltr }: { label: string; value: string; ltr?: boolean }) {
  const { isRTL } = useLocale();
  return (
    <View style={{ gap: 2 }}>
      <AppText variant="caption" color="muted" style={{ textAlign: isRTL ? 'right' : 'left' }}>
        {label}
      </AppText>
      <AppText dir={ltr ? 'ltr' : undefined} style={{ textAlign: isRTL ? 'right' : 'left' }}>
        {value}
      </AppText>
    </View>
  );
}

function railPad(isRTL: boolean, base: number) {
  return isRTL ? { paddingRight: base + 4 } : { paddingLeft: base + 4 };
}
