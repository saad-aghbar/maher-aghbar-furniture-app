import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { can } from '@maher/permissions';
import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { QtyStepperField } from '@/components/forms/QtyStepperField';
import { TextField } from '@/components/forms/TextField';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';
import type { CreateWarehouseTransferInput, InventoryItem, Warehouse } from '../api';
import type { InventoryLifecycle } from '../preferWarehouseForReceive';
import { CreateWarehouseSheet } from './CreateWarehouseSheet';
import { InventoryItemPickPanel } from './InventoryItemPickPanel';
import { InventorySheetFooter } from './InventorySheetFooter';
import { InventorySheetSectionLabel } from './InventorySheetBody';
import { WarehousePickList } from './WarehousePickList';
import {
  locationsForWarehouse,
  WarehouseBinStrip,
} from './WarehouseBinBoard';
import { pickDefaultLocationId, pickerViewportHeights } from '../pickDefaultLocation';
import { useMaherLayout } from '@/adaptive/useMaherLayout';
import { useScanWarehouseBin } from '../useScanWarehouseBin';
import { KnownItemLabelConfirm } from './KnownItemLabelConfirm';
import {
  ScanInventoryItemAction,
  type ScanInventoryItemActionHandle,
} from './ScanInventoryItemAction';
import { warehouseTypeForLifecycle } from '../preferWarehouseForReceive';
import { selectInventoryItemCard } from '../selectInventory';
import { useLabelVerifyScan } from '../useLabelVerifyScan';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import {
  formatPickQty,
  inventoryPickCopyKey,
  transferableQty,
} from '../selectInventoryPick';

type Props = {
  open: boolean;
  onClose: () => void;
  lifecycle: InventoryLifecycle;
  warehouses: Warehouse[];
  loading?: boolean;
  initialItem?: InventoryItem | null;
  /** Prefill source warehouse (e.g. FG lot bay). */
  initialFromWarehouseId?: string | null;
  /** Prefill transfer quantity. */
  initialQty?: number | null;
  onSubmit: (body: CreateWarehouseTransferInput) => void;
};

/**
 * Transfer sheet owns form + SELECT state.
 * Pick panel overlays the form; ScanInventoryItemAction stays mounted underneath.
 * Confirmation is inline (no nested confirm Modal).
 */
export function CreateTransferSheet({
  open,
  onClose,
  lifecycle,
  warehouses,
  loading,
  initialItem = null,
  initialFromWarehouseId = null,
  initialQty = null,
  onSubmit,
}: Props) {
  const { t, locale, isRTL } = useLocale();
  const { theme, colors, colorScheme } = useTheme();
  const { user } = useAuth();
  const { height } = useWindowDimensions();
  const { isDesk } = useMaherLayout();
  const pickerHeights = pickerViewportHeights(height, isDesk);
  const sheetHeight = Math.round(height * 0.82);
  const warehouseListHeight = pickerHeights.warehouse;
  const canAddWarehouse = can(user, 'warehouse.manage');
  const copy = inventoryPickCopyKey(lifecycle);
  const defaultWarehouseType = warehouseTypeForLifecycle(lifecycle);
  const scanRef = useRef<ScanInventoryItemActionHandle>(null);
  const scanWarehouseBin = useScanWarehouseBin();

  const [fromId, setFromId] = useState('');
  const [toId, setToId] = useState('');
  const [fromLocationId, setFromLocationId] = useState('');
  const [toLocationId, setToLocationId] = useState('');
  const [item, setItem] = useState<InventoryItem | null>(null);
  const [qty, setQty] = useState('1');
  const [notes, setNotes] = useState('');
  const [pickOpen, setPickOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createWarehouseFor, setCreateWarehouseFor] = useState<'from' | 'to' | null>(
    null,
  );
  const {
    verifyKind,
    verifyScanned,
    verifyFabric,
    verifyBusy,
    clearLabelVerify,
    resetLabelVerify,
    runLabelVerify,
  } = useLabelVerifyScan(item?.id);

  useEffect(() => {
    if (!open) {
      setCreateWarehouseFor(null);
      return;
    }
    setFromId('');
    setToId('');
    setFromLocationId('');
    setToLocationId('');
    setItem(initialItem ?? null);
    setQty(
      initialQty != null && Number.isFinite(initialQty) && initialQty > 0
        ? String(initialQty)
        : '1',
    );
    setNotes('');
    setError(null);
    setPickOpen(false);
    resetLabelVerify();
  }, [open, lifecycle, initialItem?.id, initialFromWarehouseId, initialQty]);

  useEffect(() => {
    if (!open) return;
    const preferred =
      initialFromWarehouseId && warehouses.some((wh) => wh.id === initialFromWarehouseId)
        ? initialFromWarehouseId
        : '';
    const source = preferred || warehouses[0]?.id || '';
    const dest = warehouses.find((wh) => wh.id !== source)?.id || '';
    setFromId((id) => {
      if (preferred) return preferred;
      return id && warehouses.some((wh) => wh.id === id) ? id : source;
    });
    setToId((id) =>
      id && warehouses.some((wh) => wh.id === id) && id !== source ? id : dest,
    );
  }, [open, warehouses, initialFromWarehouseId]);

  function requestScanFromPick() {
    setPickOpen(false);
    requestAnimationFrame(() => {
      scanRef.current?.startScan();
    });
  }

  function submit() {
    const quantity = Number(qty);
    if (!fromId || !toId || !item || !Number.isFinite(quantity) || quantity <= 0) {
      setError(t(copy.transferRequired));
      return;
    }
    if (
      fromId === toId &&
      (!effectiveFromLoc || !effectiveToLoc || effectiveFromLoc === effectiveToLoc)
    ) {
      setError(t('mobile.inventory.transferSameWarehouse'));
      return;
    }
    const available = transferableQty(item, fromId);
    if (quantity > available) {
      setError(
        t('mobile.inventory.transferQtyExceeds', {
          qty: formatPickQty(available),
          unit: item.unit || 'pcs',
        }),
      );
      return;
    }
    setError(null);
    onSubmit({
      fromWarehouseId: fromId,
      toWarehouseId: toId,
      notes: notes.trim() || undefined,
      lines: [
        {
          inventoryItemId: item.id,
          quantity,
          fromLocationId: effectiveFromLoc || undefined,
          toLocationId: effectiveToLoc || undefined,
        },
      ],
    });
  }

  const available = item ? transferableQty(item, fromId) : undefined;
  const fromWarehouse = warehouses.find((wh) => wh.id === fromId);
  const toWarehouse = warehouses.find((wh) => wh.id === toId);
  const fromBins = locationsForWarehouse(fromWarehouse);
  const toBins = locationsForWarehouse(toWarehouse);
  const effectiveFromLoc = pickDefaultLocationId(fromBins, fromLocationId);
  const effectiveToLoc = pickDefaultLocationId(toBins, toLocationId);

  async function applyScannedBin(side: 'from' | 'to') {
    const bin = await scanWarehouseBin();
    if (!bin) return;
    const whId = bin.warehouse?.id ?? bin.warehouseId;
    if (!whId) return;
    if (side === 'from') {
      setFromId(whId);
      setFromLocationId(bin.id);
    } else {
      setToId(whId);
      setToLocationId(bin.id);
    }
  }

  return (
    <>
      <BottomSheet
        open={open}
        onClose={() => {
          if (pickOpen) {
            setPickOpen(false);
            return;
          }
          onClose();
        }}
        title={pickOpen ? undefined : t('mobile.inventory.newTransfer')}
        sheetHeight={sheetHeight}
      >
        <View style={{ flex: 1 }}>
          <View
            style={[StyleSheet.absoluteFillObject, { opacity: pickOpen ? 0 : 1 }]}
            pointerEvents={pickOpen ? 'none' : 'auto'}
            collapsable={false}
          >
            <View style={{ flex: 1, gap: theme.spacing.md }}>
              {error ? (
                <AppText variant="caption" style={{ color: colors.error }}>
                  {error}
                </AppText>
              ) : null}
              <ScrollView
                keyboardShouldPersistTaps="handled"
                nestedScrollEnabled
                style={{ flex: 1 }}
                contentContainerStyle={{
                  gap: theme.spacing.md,
                  paddingBottom: theme.spacing.md,
                }}
              >
                <WarehousePickList
                  warehouses={warehouses}
                  selectedId={fromId}
                  onSelect={(id) => {
                    if (id !== fromId) {
                      setItem((current) =>
                        current && transferableQty(current, id) > 0 ? current : null,
                      );
                    }
                    setFromId(id);
                    setFromLocationId(
                      pickDefaultLocationId(locationsForWarehouse(warehouses.find((wh) => wh.id === id))),
                    );
                  }}
                  label={t('mobile.inventory.fromWarehouse')}
                  listHeight={warehouseListHeight}
                  resetToken={open ? `from-${lifecycle}` : 'from-closed'}
                  onAddWarehouse={
                    canAddWarehouse ? () => setCreateWarehouseFor('from') : undefined
                  }
                />
                {fromBins.length > 0 ? (
                  <WarehouseBinStrip
                    locations={fromBins}
                    selectedId={effectiveFromLoc}
                    onSelect={setFromLocationId}
                    label={t('mobile.inventory.binShelf')}
                    listHeight={pickerHeights.bin}
                    onScanPress={() => void applyScannedBin('from')}
                  />
                ) : null}

                <WarehousePickList
                  warehouses={warehouses}
                  selectedId={toId}
                  onSelect={(id) => {
                    setToId(id);
                    setToLocationId(
                      pickDefaultLocationId(locationsForWarehouse(warehouses.find((wh) => wh.id === id))),
                    );
                  }}
                  label={t('mobile.inventory.toWarehouse')}
                  listHeight={warehouseListHeight}
                  resetToken={open ? `to-${lifecycle}` : 'to-closed'}
                  onAddWarehouse={
                    canAddWarehouse ? () => setCreateWarehouseFor('to') : undefined
                  }
                />
                {toBins.length > 0 ? (
                  <WarehouseBinStrip
                    locations={toBins}
                    selectedId={effectiveToLoc}
                    onSelect={setToLocationId}
                    label={t('mobile.inventory.binShelf')}
                    listHeight={pickerHeights.bin}
                    onScanPress={() => void applyScannedBin('to')}
                  />
                ) : null}

                <InventorySheetSectionLabel label={t(copy.item)} />
                {item ? (
                  <>
                    <KnownItemLabelConfirm
                      current={{
                        id: item.id,
                        sku: item.sku,
                        name: selectInventoryItemCard(item, locale).name,
                        unit: item.unit,
                        imageUrl: item.imageUrl,
                        materialType: item.materialType,
                      }}
                      disabled={!fromId || loading || verifyBusy}
                      scanning={verifyBusy}
                      allowChangeItem
                      resultKind={verifyKind}
                      resultScanned={verifyScanned}
                      resultFabric={verifyFabric}
                      onScanPress={() => void runLabelVerify()}
                      onTypedCode={(code) => void runLabelVerify(undefined, code)}
                      onClearResult={clearLabelVerify}
                      onScanAgain={() => void runLabelVerify()}
                      onUseScanned={(picked) => {
                        setItem(picked);
                        clearLabelVerify();
                        setError(null);
                      }}
                    />
                    <AnimatedPressable
                      variant="button"
                      accessibilityRole="button"
                      onPress={() => {
                        void haptics.selection();
                        setPickOpen(true);
                      }}
                      style={{
                        alignSelf: isRTL ? 'flex-end' : 'flex-start',
                        paddingVertical: 4,
                      }}
                    >
                      <AppText variant="caption" color="brand" weight="semibold">
                        {t(copy.pickItem)}
                      </AppText>
                    </AnimatedPressable>
                  </>
                ) : (
                  <AnimatedPressable
                    variant="button"
                    accessibilityRole="button"
                    onPress={() => {
                      void haptics.selection();
                      setPickOpen(true);
                    }}
                    style={{
                      minHeight: theme.sizes.touch.min,
                      borderWidth: 1,
                      borderColor: colors.brand,
                      borderRadius: theme.radius.xl,
                      paddingHorizontal: theme.spacing.md,
                      justifyContent: 'center',
                      backgroundColor: colors.brandSoft,
                      ...orderBoardShadow(colorScheme),
                    }}
                  >
                    <AppText
                      variant="body"
                      weight="semibold"
                      color="brand"
                      style={{ textAlign: isRTL ? 'right' : 'left' }}
                    >
                      {t(copy.pickItem)}
                    </AppText>
                  </AnimatedPressable>
                )}

                <ScanInventoryItemAction
                  ref={scanRef}
                  showTrigger={!item}
                  disabled={!fromId || loading}
                  onBeforeScan={() => setPickOpen(false)}
                  onItemSelected={(picked) => {
                    setItem(picked);
                    setPickOpen(false);
                    setError(null);
                  }}
                />

                <QtyStepperField
                  label={t('mobile.inventory.transferQty')}
                  value={qty}
                  onChangeText={setQty}
                  min={0.01}
                  max={available != null && available > 0 ? available : undefined}
                  placeholder="1"
                />
                {item && fromId ? (
                  <AppText
                    variant="caption"
                    color="muted"
                    style={{ textAlign: isRTL ? 'right' : 'left', marginTop: -theme.spacing.sm }}
                  >
                    {t('mobile.inventory.transferAvailable', {
                      qty: formatPickQty(available ?? 0),
                      unit: item.unit || 'pcs',
                    })}
                  </AppText>
                ) : null}
                <TextField
                  label={t('mobile.inventory.notes')}
                  value={notes}
                  onChangeText={setNotes}
                  placeholder={t('mobile.inventory.notesPlaceholder')}
                  multiline
                />
              </ScrollView>
              <InventorySheetFooter
                primaryLabel={t('mobile.inventory.confirmTransfer')}
                onPrimary={submit}
                onSecondary={onClose}
                loading={loading}
              />
            </View>
          </View>

          {pickOpen ? (
            <View style={[StyleSheet.absoluteFillObject, { backgroundColor: colors.surface }]}>
              <InventoryItemPickPanel
                key={`${lifecycle}:${fromId}`}
                lifecycle={lifecycle}
                warehouseId={fromId}
                mode="transfer"
                onPick={(picked) => {
                  setItem(picked);
                  setPickOpen(false);
                  setError(null);
                }}
                onCancel={() => setPickOpen(false)}
                onRequestScan={requestScanFromPick}
              />
            </View>
          ) : null}
        </View>
      </BottomSheet>
      <CreateWarehouseSheet
        overlay
        open={createWarehouseFor !== null}
        onClose={() => setCreateWarehouseFor(null)}
        defaultType={defaultWarehouseType}
        onCreated={(warehouse) => {
          if (createWarehouseFor === 'to') setToId(warehouse.id);
          else {
            setFromId(warehouse.id);
            setItem(null);
          }
          setError(null);
        }}
      />
    </>
  );
}
