import { useEffect, useState } from 'react';
import { Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import { can } from '@maher/permissions';
import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { QtyStepperField } from '@/components/forms/QtyStepperField';
import { TextField } from '@/components/forms/TextField';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';
import type { CreateWarehouseTransferInput, InventoryItem, Warehouse } from '../api';
import type { InventoryLifecycle } from '../preferWarehouseForReceive';
import { CreateWarehouseSheet } from './CreateWarehouseSheet';
import { InventoryItemPickPanel } from './InventoryItemPickPanel';
import { InventorySheetFooter } from './InventorySheetFooter';
import { InventorySheetSectionLabel } from './InventorySheetBody';
import { WarehousePickList } from './WarehousePickList';
import { warehouseTypeForLifecycle } from '../preferWarehouseForReceive';
import {
  formatPickQty,
  inventoryPickCopyKey,
  selectInventoryPickRow,
  warehouseScopedQty,
} from '../selectInventoryPick';

type Props = {
  open: boolean;
  onClose: () => void;
  lifecycle: InventoryLifecycle;
  warehouses: Warehouse[];
  loading?: boolean;
  onSubmit: (body: CreateWarehouseTransferInput) => void;
};

export function CreateTransferSheet({
  open,
  onClose,
  lifecycle,
  warehouses,
  loading,
  onSubmit,
}: Props) {
  const { t, locale, isRTL } = useLocale();
  const { theme, colors } = useTheme();
  const { user } = useAuth();
  const { height } = useWindowDimensions();
  const sheetHeight = Math.round(height * 0.78);
  const warehouseListHeight = Math.round(height * 0.2);
  const canAddWarehouse = can(user, 'warehouse.manage');
  const copy = inventoryPickCopyKey(lifecycle);
  const defaultWarehouseType = warehouseTypeForLifecycle(lifecycle);

  const [fromId, setFromId] = useState('');
  const [toId, setToId] = useState('');
  const [item, setItem] = useState<InventoryItem | null>(null);
  const [qty, setQty] = useState('1');
  const [notes, setNotes] = useState('');
  const [pickOpen, setPickOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createWarehouseFor, setCreateWarehouseFor] = useState<'from' | 'to' | null>(
    null,
  );

  useEffect(() => {
    if (!open) {
      setCreateWarehouseFor(null);
      return;
    }
    setFromId('');
    setToId('');
    setItem(null);
    setQty('1');
    setNotes('');
    setError(null);
    setPickOpen(false);
  }, [open, lifecycle]);

  useEffect(() => {
    if (!open) return;
    const source = warehouses[0]?.id || '';
    const dest = warehouses.find((wh) => wh.id !== source)?.id || '';
    setFromId((id) => (id && warehouses.some((wh) => wh.id === id) ? id : source));
    setToId((id) =>
      id && warehouses.some((wh) => wh.id === id) && id !== source ? id : dest,
    );
  }, [open, warehouses]);

  function submit() {
    const quantity = Number(qty);
    if (!fromId || !toId || !item || !Number.isFinite(quantity) || quantity <= 0) {
      setError(t(copy.transferRequired));
      return;
    }
    if (fromId === toId) {
      setError(t('mobile.inventory.transferSameWarehouse'));
      return;
    }
    const available = warehouseScopedQty(item, fromId).freeQty;
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
      lines: [{ inventoryItemId: item.id, quantity }],
    });
  }

  const selected = item ? selectInventoryPickRow(item, fromId, locale) : null;
  const available = item ? warehouseScopedQty(item, fromId).freeQty : undefined;

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
      {pickOpen ? (
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
        />
      ) : (
        <View style={{ flex: 1, gap: theme.spacing.md }}>
          {error ? (
            <AppText variant="caption" style={{ color: colors.error }}>
              {error}
            </AppText>
          ) : null}
          <ScrollView
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
            contentContainerStyle={{ gap: theme.spacing.md, paddingBottom: theme.spacing.md }}
          >
            <WarehousePickList
              warehouses={warehouses}
              selectedId={fromId}
              onSelect={(id) => {
                if (id !== fromId) setItem(null);
                setFromId(id);
              }}
              label={t('mobile.inventory.fromWarehouse')}
              listHeight={warehouseListHeight}
              resetToken={open ? `from-${lifecycle}` : 'from-closed'}
              onAddWarehouse={
                canAddWarehouse ? () => setCreateWarehouseFor('from') : undefined
              }
            />

            <WarehousePickList
              warehouses={warehouses}
              selectedId={toId}
              onSelect={setToId}
              label={t('mobile.inventory.toWarehouse')}
              listHeight={warehouseListHeight}
              resetToken={open ? `to-${lifecycle}` : 'to-closed'}
              onAddWarehouse={
                canAddWarehouse ? () => setCreateWarehouseFor('to') : undefined
              }
            />

            <InventorySheetSectionLabel label={t(copy.item)} />
            <Pressable
              accessibilityRole="button"
              onPress={() => setPickOpen(true)}
              style={{
                minHeight: theme.sizes.touch.min,
                borderWidth: 1,
                borderColor: item ? colors.borderStrong : colors.brand,
                borderRadius: theme.radius.xl,
                paddingHorizontal: theme.spacing.md,
                justifyContent: 'center',
                backgroundColor: item ? colors.surface : colors.brandSoft,
                ...theme.elevation.card,
              }}
            >
              <AppText
                variant="body"
                weight={item ? 'medium' : 'semibold'}
                color={item ? 'primary' : 'brand'}
                style={{ textAlign: isRTL ? 'right' : 'left' }}
              >
                {selected ? `${selected.sku} — ${selected.name}` : t(copy.pickItem)}
              </AppText>
            </Pressable>

            <QtyStepperField
              label={t('mobile.inventory.transferQty')}
              value={qty}
              onChangeText={setQty}
              min={0.01}
              max={available != null && available > 0 ? available : undefined}
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
            primaryLabel={t('mobile.inventory.confirmTransfer')}
            onPrimary={submit}
            onSecondary={onClose}
            loading={loading}
          />
        </View>
      )}
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
