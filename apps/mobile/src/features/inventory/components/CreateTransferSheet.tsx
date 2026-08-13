import { useEffect, useState } from 'react';
import { Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import { can } from '@maher/permissions';
import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { TextField } from '@/components/forms/TextField';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';
import type { CreateWarehouseTransferInput, InventoryItem, Warehouse } from '../api';
import { CreateWarehouseSheet } from './CreateWarehouseSheet';
import { InventoryItemPickPanel } from './InventoryItemPickPanel';
import { InventorySheetFooter } from './InventorySheetFooter';
import { InventorySheetSectionLabel } from './InventorySheetBody';
import { WarehousePickList } from './WarehousePickList';

type Props = {
  open: boolean;
  onClose: () => void;
  warehouses: Warehouse[];
  loading?: boolean;
  onSubmit: (body: CreateWarehouseTransferInput) => void;
};

export function CreateTransferSheet({
  open,
  onClose,
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
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setFromId((id) => id || warehouses[0]?.id || '');
    setToId((id) => id || warehouses[1]?.id || warehouses[0]?.id || '');
  }, [open, warehouses]);

  function submit() {
    const quantity = Number(qty);
    if (!fromId || !toId || !item || !Number.isFinite(quantity) || quantity <= 0) {
      setError(t('mobile.inventory.transferRequired'));
      return;
    }
    if (fromId === toId) {
      setError(t('mobile.inventory.transferSameWarehouse'));
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
              onSelect={setFromId}
              label={t('mobile.inventory.fromWarehouse')}
              listHeight={warehouseListHeight}
              resetToken={open ? 'from' : 'from-closed'}
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
              resetToken={open ? 'to' : 'to-closed'}
              onAddWarehouse={
                canAddWarehouse ? () => setCreateWarehouseFor('to') : undefined
              }
            />

            <InventorySheetSectionLabel label={t('mobile.inventory.item')} />
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
                {item
                  ? `${item.sku} — ${
                      locale === 'ar' ? item.nameAr || item.nameEn : item.nameEn || item.nameAr
                    }`
                  : t('mobile.inventory.pickItem')}
              </AppText>
            </Pressable>

            <TextField
              label={t('mobile.inventory.transferQty')}
              value={qty}
              onChangeText={setQty}
              keyboardType="decimal-pad"
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
      onCreated={(warehouse) => {
        if (createWarehouseFor === 'to') setToId(warehouse.id);
        else setFromId(warehouse.id);
        setError(null);
      }}
    />
    </>
  );
}
