import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { can } from '@maher/permissions';
import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { QtyStepperField } from '@/components/forms/QtyStepperField';
import { TextField } from '@/components/forms/TextField';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { useLocale } from '@/i18n';
import { haptics } from '@/motion';
import { useTheme } from '@/theme';
import type { CreateInventoryStockCountInput, InventoryItem, Warehouse } from '../api';
import type { InventoryLifecycle } from '../preferWarehouseForReceive';
import { CreateWarehouseSheet } from './CreateWarehouseSheet';
import { InventoryItemPickPanel } from './InventoryItemPickPanel';
import { InventorySheetFooter } from './InventorySheetFooter';
import { InventorySheetSectionLabel } from './InventorySheetBody';
import { WarehousePickList } from './WarehousePickList';
import { KnownItemLabelConfirm } from './KnownItemLabelConfirm';
import {
  ScanInventoryItemAction,
  type ScanInventoryItemActionHandle,
} from './ScanInventoryItemAction';
import { warehouseTypeForLifecycle } from '../preferWarehouseForReceive';
import { selectInventoryItemCard } from '../selectInventory';
import { useLabelVerifyScan } from '../useLabelVerifyScan';
import { inventoryPickCopyKey } from '../selectInventoryPick';

type Props = {
  open: boolean;
  onClose: () => void;
  lifecycle: InventoryLifecycle;
  warehouses: Warehouse[];
  loading?: boolean;
  initialItem?: InventoryItem | null;
  initialWarehouseId?: string | null;
  onSubmit: (body: CreateInventoryStockCountInput) => void;
};

/**
 * Count sheet owns form + SELECT state.
 * Pick panel overlays the form; ScanInventoryItemAction stays mounted underneath.
 */
export function CreateStockCountSheet({
  open,
  onClose,
  lifecycle,
  warehouses,
  loading,
  initialItem = null,
  initialWarehouseId = null,
  onSubmit,
}: Props) {
  const { t, locale, isRTL } = useLocale();
  const { theme, colors } = useTheme();
  const { user } = useAuth();
  const { height } = useWindowDimensions();
  const sheetHeight = Math.round(height * 0.78);
  const warehouseListHeight = Math.round(height * 0.28);
  const canAddWarehouse = can(user, 'warehouse.manage');
  const copy = inventoryPickCopyKey(lifecycle);
  const defaultWarehouseType = warehouseTypeForLifecycle(lifecycle);
  const scanRef = useRef<ScanInventoryItemActionHandle>(null);

  const [warehouseId, setWarehouseId] = useState('');
  const [kind, setKind] = useState<'PERIODIC' | 'SURPRISE'>('PERIODIC');
  const [item, setItem] = useState<InventoryItem | null>(null);
  const [qty, setQty] = useState('');
  const [notes, setNotes] = useState('');
  const [pickOpen, setPickOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createWarehouseOpen, setCreateWarehouseOpen] = useState(false);
  const {
    verifyKind,
    verifyScanned,
    verifyBusy,
    clearLabelVerify,
    resetLabelVerify,
    runLabelVerify,
  } = useLabelVerifyScan(item?.id);

  useEffect(() => {
    if (!open) {
      setCreateWarehouseOpen(false);
      return;
    }
    setWarehouseId('');
    setKind('PERIODIC');
    setItem(initialItem ?? null);
    setQty('');
    setNotes('');
    setError(null);
    setPickOpen(false);
    resetLabelVerify();
  }, [open, lifecycle, initialItem?.id, initialWarehouseId]);

  useEffect(() => {
    if (!open) return;
    const preferred =
      initialWarehouseId && warehouses.some((wh) => wh.id === initialWarehouseId)
        ? initialWarehouseId
        : '';
    setWarehouseId((id) => {
      if (preferred) return preferred;
      return id && warehouses.some((wh) => wh.id === id) ? id : warehouses[0]?.id || '';
    });
  }, [open, warehouses, initialWarehouseId]);

  function requestScanFromPick() {
    setPickOpen(false);
    requestAnimationFrame(() => {
      scanRef.current?.startScan();
    });
  }

  function submit() {
    const countedQty = Number(qty);
    if (!warehouseId || !item || !Number.isFinite(countedQty)) {
      setError(t(copy.countRequired));
      return;
    }
    setError(null);
    const noteParts = [kind, notes.trim()].filter(Boolean);
    onSubmit({
      warehouseId,
      notes: noteParts.length ? noteParts.join(' — ') : undefined,
      lines: [{ inventoryItemId: item.id, countedQty }],
    });
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
        title={pickOpen ? undefined : t('mobile.inventory.newCount')}
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
                <InventorySheetSectionLabel label={t('mobile.inventory.countKindLabel')} />
                <View
                  style={{
                    flexDirection: isRTL ? 'row-reverse' : 'row',
                    gap: theme.spacing.sm,
                  }}
                >
                  {(['PERIODIC', 'SURPRISE'] as const).map((k) => {
                    const selectedKind = kind === k;
                    return (
                      <Pressable
                        key={k}
                        onPress={() => {
                          void haptics.selection();
                          setKind(k);
                        }}
                        style={{
                          flex: 1,
                          minHeight: theme.sizes.touch.min,
                          borderWidth: 1,
                          borderColor: selectedKind ? colors.brand : colors.borderStrong,
                          borderRadius: theme.radius.xl,
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: selectedKind
                            ? colors.brandSoft
                            : colors.surface,
                          ...theme.elevation.card,
                        }}
                      >
                        <AppText
                          variant="label"
                          weight="semibold"
                          color={selectedKind ? 'brand' : 'primary'}
                        >
                          {t(`mobile.inventory.countKind.${k}`)}
                        </AppText>
                      </Pressable>
                    );
                  })}
                </View>

                <WarehousePickList
                  warehouses={warehouses}
                  selectedId={warehouseId}
                  onSelect={(id) => {
                    if (id !== warehouseId) setItem(null);
                    setWarehouseId(id);
                  }}
                  label={t('mobile.inventory.warehouse')}
                  listHeight={warehouseListHeight}
                  resetToken={open ? `count-${lifecycle}` : 'count-closed'}
                  onAddWarehouse={
                    canAddWarehouse ? () => setCreateWarehouseOpen(true) : undefined
                  }
                />

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
                      disabled={!warehouseId || loading || verifyBusy}
                      scanning={verifyBusy}
                      allowChangeItem
                      resultKind={verifyKind}
                      resultScanned={verifyScanned}
                      onScanPress={() => void runLabelVerify()}
                      onClearResult={clearLabelVerify}
                      onScanAgain={() => void runLabelVerify()}
                      onUseScanned={(picked) => {
                        setItem(picked);
                        clearLabelVerify();
                        setError(null);
                      }}
                    />
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => setPickOpen(true)}
                      style={{
                        alignSelf: isRTL ? 'flex-end' : 'flex-start',
                        paddingVertical: 4,
                      }}
                    >
                      <AppText variant="caption" color="brand" weight="semibold">
                        {t(copy.pickItem)}
                      </AppText>
                    </Pressable>
                  </>
                ) : (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setPickOpen(true)}
                    style={{
                      minHeight: theme.sizes.touch.min,
                      borderWidth: 1,
                      borderColor: colors.brand,
                      borderRadius: theme.radius.xl,
                      paddingHorizontal: theme.spacing.md,
                      justifyContent: 'center',
                      backgroundColor: colors.brandSoft,
                      ...theme.elevation.card,
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
                  </Pressable>
                )}

                <ScanInventoryItemAction
                  ref={scanRef}
                  showTrigger={!item}
                  disabled={!warehouseId || loading}
                  onBeforeScan={() => setPickOpen(false)}
                  onItemSelected={(picked) => {
                    setItem(picked);
                    setPickOpen(false);
                    setError(null);
                  }}
                />

                <QtyStepperField
                  label={t('mobile.inventory.countedQty')}
                  value={qty}
                  onChangeText={setQty}
                  min={0}
                  placeholder="0"
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
                primaryLabel={t('mobile.inventory.confirmCount')}
                onPrimary={submit}
                onSecondary={onClose}
                loading={loading}
              />
            </View>
          </View>

          {pickOpen ? (
            <View style={[StyleSheet.absoluteFillObject, { backgroundColor: colors.surface }]}>
              <InventoryItemPickPanel
                key={`${lifecycle}:${warehouseId}`}
                lifecycle={lifecycle}
                warehouseId={warehouseId}
                mode="count"
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
        open={createWarehouseOpen}
        onClose={() => setCreateWarehouseOpen(false)}
        defaultType={defaultWarehouseType}
        onCreated={(warehouse) => {
          setWarehouseId(warehouse.id);
          setItem(null);
          setError(null);
        }}
      />
    </>
  );
}
