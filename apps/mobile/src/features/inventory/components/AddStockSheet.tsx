import { useEffect, useMemo, useState } from 'react';
import { ScrollView, useWindowDimensions, View } from 'react-native';
import { can } from '@maher/permissions';
import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { CodeField } from '@/components/forms/CodeField';
import { QtyStepperField } from '@/components/forms/QtyStepperField';
import { TextField } from '@/components/forms/TextField';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';
import type { InventoryItem, Warehouse } from '../api';
import { resolveInventoryScan } from '../resolveInventoryScan';
import { selectInventoryItemCard } from '../selectInventory';
import { useLabelVerifyScan } from '../useLabelVerifyScan';
import { useInventoryOpenReceiptsQuery } from '../query';
import {
  preferWarehouseForIssue,
  preferWarehouseForReceive,
  sortWarehousesForReceive,
  warehousesCompatibleWithItem,
  warehouseTypeForItemClass,
} from '../preferWarehouseForReceive';
import { CreateWarehouseSheet } from './CreateWarehouseSheet';
import { InventorySheetFooter } from './InventorySheetFooter';
import { KnownItemLabelConfirm } from './KnownItemLabelConfirm';
import { ScanInventoryItemAction } from './ScanInventoryItemAction';
import { WarehousePickList } from './WarehousePickList';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import {
  InventoryScanSelectInline,
  type InlineScanSelectMode,
} from './InventoryScanSelectInline';

export type StockMoveMode = 'receive' | 'issue';

export type StockMoveItem = {
  id: string;
  sku: string;
  name: string;
  category: string;
  itemClass?: string | null;
  unit: string;
  imageUrl?: string | null;
  materialType?: string | null;
  onHand?: number;
  reservedQty?: number;
  availableQty?: number;
  balances: Array<{
    warehouseId: string;
    quantityLabel: string;
    availableQty?: number;
    reservedQty?: number;
  }>;
};

export type StockMoveSubmit = {
  inventoryItemId: string;
  warehouseId: string;
  quantity: number;
  notes?: string;
  purchaseOrderId?: string;
  orderedQty?: number;
};

type AddStockSheetProps = {
  open: boolean;
  onClose: () => void;
  warehouses: Warehouse[];
  mode?: StockMoveMode;
  /** Pre-selected material when opened from a row / detail. */
  initialItem?: StockMoveItem | null;
  loading?: boolean;
  onSubmit: (input: StockMoveSubmit) => void;
};

function toMoveItem(item: InventoryItem, locale: string): StockMoveItem {
  const card = selectInventoryItemCard(item, locale);
  return {
    id: card.id,
    sku: card.sku,
    name: card.name,
    category: card.category,
    itemClass: card.itemClass,
    unit: card.unit,
    imageUrl: card.imageUrl,
    materialType: card.materialType,
    onHand: card.onHand,
    reservedQty: card.reservedQty,
    availableQty: card.freeQty,
    balances: card.balances.map((b) => ({
      warehouseId: b.warehouseId,
      quantityLabel: b.quantityLabel,
      availableQty: b.availableQty,
      reservedQty: b.reservedQty,
    })),
  };
}

/**
 * Receive / Issue stock sheet — mirrors admin-web move modal:
 * scan barcode/SKU → item → warehouse → quantity → notes → confirm.
 */
export function AddStockSheet({
  open,
  onClose,
  warehouses,
  mode = 'receive',
  initialItem = null,
  loading,
  onSubmit,
}: AddStockSheetProps) {
  const { t, locale, formatDate } = useLocale();
  const { theme, colors, colorScheme } = useTheme();
  const { user } = useAuth();
  const { height } = useWindowDimensions();
  const sheetHeight = Math.round(height * 0.82);
  const warehouseListHeight = Math.round(height * 0.28);
  const canAddWarehouse = can(user, 'warehouse.manage');

  const [item, setItem] = useState<StockMoveItem | null>(null);
  const [scanCode, setScanCode] = useState('');
  const [lookingUp, setLookingUp] = useState(false);
  const [warehouseId, setWarehouseId] = useState('');
  const [qty, setQty] = useState('1');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [createWarehouseOpen, setCreateWarehouseOpen] = useState(false);
  const [receiptKind, setReceiptKind] = useState<'po' | 'manual'>('po');
  const [selectedPoId, setSelectedPoId] = useState<string | null>(null);
  const [confirmItem, setConfirmItem] = useState<InventoryItem | null>(null);
  const [confirmMode, setConfirmMode] = useState<InlineScanSelectMode>('confirm');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const canReceive = can(user, 'inventory.receive');
  const knownItem = Boolean(initialItem?.id);
  const {
    verifyKind,
    verifyScanned,
    verifyBusy,
    clearLabelVerify,
    resetLabelVerify,
    runLabelVerify,
  } = useLabelVerifyScan(item?.id);

  const openReceiptsQuery = useInventoryOpenReceiptsQuery(
    mode === 'receive' && open && item?.id && canReceive ? item.id : undefined,
    mode === 'receive' && open && Boolean(item?.id) && canReceive,
  );
  const openReceipts = openReceiptsQuery.data ?? [];

  const compatibleWarehouses = useMemo(
    () =>
      warehousesCompatibleWithItem(warehouses, {
        itemClass: item?.itemClass,
        category: item?.category,
      }),
    [warehouses, item?.itemClass, item?.category],
  );

  const preferredId = useMemo(() => {
    if (!item) return '';
    if (mode === 'issue') {
      return preferWarehouseForIssue(compatibleWarehouses, {
        itemClass: item.itemClass,
        category: item.category,
        balances: item.balances.map((b) => ({
          warehouseId: b.warehouseId,
          availableQty: b.availableQty ?? 0,
        })),
      });
    }
    return preferWarehouseForReceive(compatibleWarehouses, {
      itemClass: item.itemClass,
      category: item.category,
      balanceWarehouseIds: item.balances.map((b) => b.warehouseId),
    });
  }, [compatibleWarehouses, item, mode]);

  const orderedWarehouses = useMemo(
    () => sortWarehousesForReceive(compatibleWarehouses, preferredId),
    [compatibleWarehouses, preferredId],
  );

  useEffect(() => {
    if (!open) {
      setCreateWarehouseOpen(false);
      return;
    }
    setItem(initialItem ?? null);
    setScanCode('');
    setLookingUp(false);
    setWarehouseId('');
    setQty('1');
    setNotes('');
    setError(null);
    setReceiptKind('po');
    setSelectedPoId(null);
    setConfirmOpen(false);
    setConfirmItem(null);
    resetLabelVerify();
    // Reset when the sheet opens or the target item / mode changes — not on every parent re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional
  }, [open, mode, initialItem?.id]);

  const receiptKey = `${item?.id ?? ''}:${openReceipts.map((row) => row.purchaseOrderId).join(',')}`;

  useEffect(() => {
    if (!open || mode !== 'receive') return;
    if (openReceipts.length === 1) {
      const only = openReceipts[0]!;
      setSelectedPoId(only.purchaseOrderId);
      setReceiptKind('po');
      if (only.suggestedWarehouseId) {
        setWarehouseId(only.suggestedWarehouseId);
      }
    } else if (openReceipts.length === 0) {
      setSelectedPoId(null);
      setReceiptKind('manual');
    } else {
      setSelectedPoId(null);
      setReceiptKind('po');
    }
    // Receipt rows load after the item is known; key covers id + PO ids.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- receiptKey
  }, [open, mode, receiptKey]);

  useEffect(() => {
    if (!open || !preferredId) return;
    setWarehouseId((current) => current || preferredId);
  }, [open, preferredId, item?.id]);

  const effectiveWarehouseId = warehouseId || preferredId || orderedWarehouses[0]?.id || '';
  const unit = item?.unit || 'pcs';
  const itemLabel = item ? `${item.sku} — ${item.name}` : '—';

  async function lookupCode(codeRaw: string) {
    // Unknown-item path only — known-item uses KnownItemLabelConfirm.
    if (knownItem) return;
    const code = codeRaw.trim();
    if (!code) {
      setError(t('mobile.inventory.scanCodeRequired'));
      return;
    }
    setLookingUp(true);
    setError(null);
    try {
      const resolved = await resolveInventoryScan(code);
      if (resolved.status === 'NOT_FOUND') {
        void haptics.error();
        setConfirmItem(null);
        setConfirmMode('not-found');
        setConfirmOpen(true);
        return;
      }
      if (resolved.status === 'ERROR') {
        void haptics.error();
        setConfirmItem(null);
        setConfirmMode('error');
        setConfirmOpen(true);
        return;
      }
      const found = resolved.item;
      if (!found.isActive || found.archivedAt) {
        setConfirmItem(found);
        setConfirmMode('blocked-inactive');
        setConfirmOpen(true);
        return;
      }
      setConfirmItem(found);
      setConfirmMode('confirm');
      setConfirmOpen(true);
      setScanCode('');
      void haptics.confirmLight();
    } finally {
      setLookingUp(false);
    }
  }

  function clearCodeConfirm() {
    setConfirmOpen(false);
    setConfirmItem(null);
  }

  async function lookup() {
    await lookupCode(scanCode);
  }

  function submit() {
    if (!item) {
      setError(t('mobile.inventory.itemRequired'));
      return;
    }
    const quantity = Number(qty);
    if (!effectiveWarehouseId) {
      setError(t('mobile.inventory.addStockWarehouseRequired'));
      return;
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      setError(t('mobile.inventory.addStockQtyInvalid'));
      return;
    }
    if (mode === 'receive' && openReceipts.length > 0 && receiptKind !== 'manual') {
      if (!selectedPoId) {
        setError(t('mobile.inventory.choosePurchaseOrder'));
        return;
      }
    }
    setError(null);
    const selectedPo = openReceipts.find((row) => row.purchaseOrderId === selectedPoId);
    onSubmit({
      inventoryItemId: item.id,
      warehouseId: effectiveWarehouseId,
      quantity,
      notes: notes.trim() || undefined,
      ...(mode === 'receive' && receiptKind === 'po' && selectedPo
        ? {
            purchaseOrderId: selectedPo.purchaseOrderId,
            orderedQty: Number(selectedPo.orderedQty),
          }
        : {}),
    });
  }

  const title =
    mode === 'issue' ? t('mobile.inventory.issueStock') : t('mobile.inventory.receiveStock');

  return (
    <>
    <BottomSheet open={open} onClose={onClose} title={title} sheetHeight={sheetHeight}>
      <View style={{ flex: 1, gap: theme.spacing.md }}>
        {error ? (
          <AppText variant="caption" style={{ color: colors.error }}>
            {error}
          </AppText>
        ) : null}

        <ScrollView
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
          showsVerticalScrollIndicator={false}
          style={{ flex: 1 }}
          contentContainerStyle={{ gap: theme.spacing.md, paddingBottom: theme.spacing.md }}
        >
          <View style={{ gap: theme.spacing.sm }}>
            {knownItem && item ? (
              <KnownItemLabelConfirm
                current={{
                  id: item.id,
                  sku: item.sku,
                  name: item.name,
                  unit: item.unit,
                  imageUrl: item.imageUrl,
                  materialType: item.materialType,
                }}
                disabled={lookingUp || loading || verifyBusy}
                scanning={verifyBusy}
                allowChangeItem
                resultKind={verifyKind}
                resultScanned={verifyScanned}
                onScanPress={() => void runLabelVerify()}
                onClearResult={clearLabelVerify}
                onScanAgain={() => void runLabelVerify()}
                onUseScanned={(found) => {
                  setItem(toMoveItem(found, locale));
                  clearLabelVerify();
                  setError(null);
                }}
              />
            ) : (
              <>
                <ScanInventoryItemAction
                  disabled={lookingUp || loading}
                  onItemSelected={(found) => {
                    setItem(toMoveItem(found, locale));
                    setError(null);
                  }}
                />
                <CodeField
                  label={t('mobile.inventory.scanBarcode')}
                  value={scanCode}
                  onChangeText={(text) => {
                    setScanCode(text);
                    if (error) setError(null);
                  }}
                  placeholder={t('mobile.inventory.scanBarcodeHint')}
                  returnKeyType="search"
                  onSubmitEditing={() => void lookup()}
                  onScanned={(code) => {
                    setError(null);
                    void lookupCode(code);
                  }}
                />
                <AnimatedPressable
                  variant="button"
                  accessibilityRole="button"
                  disabled={lookingUp || loading}
                  onPress={() => void lookup()}
                  style={{
                    minHeight: theme.sizes.touch.min,
                    paddingHorizontal: theme.spacing.md,
                    borderRadius: theme.radius.xl,
                    borderWidth: 1,
                    borderColor: colors.borderStrong,
                    backgroundColor: colors.surface,
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: lookingUp || loading ? 0.6 : 1,
                    ...orderBoardShadow(colorScheme),
                  }}
                >
                  <AppText variant="label" weight="semibold" color="brand">
                    {lookingUp ? t('mobile.inventory.lookingUp') : t('mobile.inventory.lookup')}
                  </AppText>
                </AnimatedPressable>
                {confirmOpen ? (
                  <InventoryScanSelectInline
                    mode={confirmMode}
                    item={confirmItem}
                    onCancel={clearCodeConfirm}
                    onScanAgain={() => {
                      clearCodeConfirm();
                      void lookup();
                    }}
                    onUseMaterial={
                      confirmMode === 'confirm' && confirmItem
                        ? () => {
                            setItem(toMoveItem(confirmItem, locale));
                            setError(null);
                            clearCodeConfirm();
                          }
                        : undefined
                    }
                  />
                ) : null}
              </>
            )}
          </View>

          {!knownItem ? (
          <View
            style={{
              borderRadius: theme.radius.xl,
              borderWidth: 1,
              borderColor: colors.borderStrong,
              backgroundColor: colors.surface,
              padding: theme.spacing.md,
              gap: theme.spacing.xs,
              ...orderBoardShadow(colorScheme),
            }}
          >
            <AppText
              variant="caption"
              color="muted"
              style={{
                letterSpacing: 0.6,
                textTransform: 'uppercase',
                fontSize: 11,
                lineHeight: 14,
              }}
            >
              {t('mobile.inventory.stockMoveItem')}
            </AppText>
            <AppText variant="body" weight="semibold">
              {itemLabel}
            </AppText>
            {mode === 'issue' && item ? (
              <AppText variant="caption" color="muted" dir="ltr">
                {t('mobile.inventory.available')}: {item.availableQty ?? 0} {unit}
                {' · '}
                {t('mobile.inventory.reservedLabel')}: {item.reservedQty ?? 0} {unit}
              </AppText>
            ) : null}
          </View>
          ) : mode === 'issue' && item ? (
            <AppText variant="caption" color="muted" dir="ltr">
              {t('mobile.inventory.available')}: {item.availableQty ?? 0} {unit}
              {' · '}
              {t('mobile.inventory.reservedLabel')}: {item.reservedQty ?? 0} {unit}
              {' · '}
              {t('mobile.inventory.onHand')}: {item.onHand ?? 0} {unit}
            </AppText>
          ) : null}

          {mode === 'receive' && item && canReceive && openReceipts.length > 0 ? (
            <View style={{ gap: theme.spacing.sm }}>
              {openReceipts.map((row) => {
                const selected = receiptKind === 'po' && selectedPoId === row.purchaseOrderId;
                const supplier =
                  locale === 'ar'
                    ? row.supplierNameAr || row.supplierName
                    : locale === 'he'
                      ? row.supplierNameHe || row.supplierName
                      : row.supplierName;
                const expected = row.expectedDeliveryDate
                  ? formatDate(row.expectedDeliveryDate)
                  : null;
                return (
                  <AnimatedPressable
                    variant="button"
                    key={row.purchaseOrderId}
                    accessibilityRole="button"
                    onPress={() => {
                      void haptics.selection();
                      setReceiptKind('po');
                      setSelectedPoId(row.purchaseOrderId);
                      if (row.suggestedWarehouseId) setWarehouseId(row.suggestedWarehouseId);
                      setError(null);
                    }}
                    style={{
                      borderWidth: 1,
                      borderColor: selected ? colors.brand : colors.borderStrong,
                      backgroundColor: selected ? colors.brandSoft : colors.surface,
                      borderRadius: theme.radius.xl,
                      padding: theme.spacing.md,
                      gap: theme.spacing.xs,
                    }}
                  >
                    <AppText variant="caption" color="muted">
                      {t('mobile.inventory.receiveAgainstPo')}
                    </AppText>
                    <AppText variant="body" weight="semibold">
                      {row.purchaseOrderNumber}
                    </AppText>
                    <AppText variant="caption" color="muted">
                      {supplier}
                    </AppText>
                    <AppText variant="caption" color="muted" dir="ltr">
                      {t('mobile.inventory.remaining')}: {Number(row.remainingQty)} {row.unit}
                    </AppText>
                    {expected ? (
                      <AppText variant="caption" color="muted">
                        {t('mobile.inventory.expected')}: {expected}
                      </AppText>
                    ) : null}
                  </AnimatedPressable>
                );
              })}
              <AnimatedPressable
                variant="button"
                accessibilityRole="button"
                onPress={() => {
                  void haptics.selection();
                  setReceiptKind('manual');
                  setSelectedPoId(null);
                  setError(null);
                }}
                style={{
                  borderWidth: 1,
                  borderColor: receiptKind === 'manual' ? colors.brand : colors.borderStrong,
                  backgroundColor: receiptKind === 'manual' ? colors.brandSoft : colors.surface,
                  borderRadius: theme.radius.xl,
                  padding: theme.spacing.md,
                }}
              >
                <AppText variant="body" weight="semibold">
                  {t('mobile.inventory.manualReceipt')}
                </AppText>
              </AnimatedPressable>
            </View>
          ) : null}

          <WarehousePickList
            warehouses={orderedWarehouses}
            selectedId={effectiveWarehouseId}
            onSelect={(id) => {
              setWarehouseId(id);
              setError(null);
            }}
            label={t('mobile.inventory.warehouse')}
            balances={item?.balances ?? []}
            listHeight={warehouseListHeight}
            resetToken={`${open}-${mode}-${item?.id ?? 'none'}`}
            onAddWarehouse={
              canAddWarehouse ? () => setCreateWarehouseOpen(true) : undefined
            }
          />

          <QtyStepperField
            label={t('mobile.inventory.quantity', { unit })}
            value={qty}
            onChangeText={(text) => {
              setQty(text);
              if (error) setError(null);
            }}
            min={0.01}
            placeholder="1"
          />

          <TextField
            label={t('mobile.inventory.notes')}
            value={notes}
            onChangeText={setNotes}
            placeholder={t('mobile.inventory.notesPlaceholder')}
            multiline
          />
        </ScrollView>

        <InventorySheetFooter
          primaryLabel={t('mobile.inventory.confirm')}
          onPrimary={submit}
          onSecondary={onClose}
          loading={loading}
          disabled={loading || lookingUp}
        />
      </View>
    </BottomSheet>
    <CreateWarehouseSheet
      overlay
      open={createWarehouseOpen}
      onClose={() => setCreateWarehouseOpen(false)}
      defaultType={warehouseTypeForItemClass(item?.itemClass, item?.category)}
      onCreated={(warehouse) => {
        const allowed = warehousesCompatibleWithItem([warehouse], {
          itemClass: item?.itemClass,
          category: item?.category,
        });
        if (allowed[0]) setWarehouseId(allowed[0].id);
        setError(null);
      }}
    />
    </>
  );
}
