import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { CodeField } from '@/components/forms/CodeField';
import { TextField } from '@/components/forms/TextField';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { useLocale } from '@/i18n';
import { haptics } from '@/motion';
import { useTheme } from '@/theme';
import { getInventoryItemByCode, type InventoryItem, type Warehouse } from '../api';
import { selectInventoryItemCard } from '../selectInventory';
import {
  preferWarehouseForIssue,
  preferWarehouseForReceive,
  sortWarehousesForReceive,
} from '../preferWarehouseForReceive';
import { InventorySheetFooter } from './InventorySheetFooter';
import { WarehousePickList } from './WarehousePickList';

export type StockMoveMode = 'receive' | 'issue';

export type StockMoveItem = {
  id: string;
  sku: string;
  name: string;
  category: string;
  unit: string;
  balances: Array<{
    warehouseId: string;
    quantityLabel: string;
    availableQty?: number;
  }>;
};

export type StockMoveSubmit = {
  inventoryItemId: string;
  warehouseId: string;
  quantity: number;
  notes?: string;
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
    unit: card.unit,
    balances: card.balances.map((b) => ({
      warehouseId: b.warehouseId,
      quantityLabel: b.quantityLabel,
      availableQty: b.availableQty,
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
  const { t, locale } = useLocale();
  const { theme, colors } = useTheme();
  const { height } = useWindowDimensions();
  const sheetHeight = Math.round(height * 0.82);
  const warehouseListHeight = Math.round(height * 0.28);

  const [item, setItem] = useState<StockMoveItem | null>(null);
  const [scanCode, setScanCode] = useState('');
  const [lookingUp, setLookingUp] = useState(false);
  const [warehouseId, setWarehouseId] = useState('');
  const [qty, setQty] = useState('1');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const preferredId = useMemo(() => {
    if (!item) return '';
    if (mode === 'issue') {
      return preferWarehouseForIssue(warehouses, {
        category: item.category,
        balances: item.balances.map((b) => ({
          warehouseId: b.warehouseId,
          availableQty: b.availableQty ?? 0,
        })),
      });
    }
    return preferWarehouseForReceive(warehouses, {
      category: item.category,
      balanceWarehouseIds: item.balances.map((b) => b.warehouseId),
    });
  }, [warehouses, item, mode]);

  const orderedWarehouses = useMemo(
    () => sortWarehousesForReceive(warehouses, preferredId),
    [warehouses, preferredId],
  );

  useEffect(() => {
    if (!open) return;
    setItem(initialItem ?? null);
    setScanCode('');
    setLookingUp(false);
    setWarehouseId('');
    setQty('1');
    setNotes('');
    setError(null);
    // Reset when the sheet opens or the target item / mode changes — not on every parent re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional
  }, [open, mode, initialItem?.id]);

  useEffect(() => {
    if (!open || !preferredId) return;
    setWarehouseId(preferredId);
  }, [open, preferredId, item?.id]);

  const effectiveWarehouseId = warehouseId || preferredId || warehouses[0]?.id || '';
  const unit = item?.unit || 'pcs';
  const itemLabel = item ? `${item.sku} — ${item.name}` : '—';

  async function lookupCode(codeRaw: string) {
    const code = codeRaw.trim();
    if (!code) {
      setError(t('mobile.inventory.scanCodeRequired'));
      return;
    }
    setLookingUp(true);
    setError(null);
    try {
      const found = await getInventoryItemByCode(code);
      setItem(toMoveItem(found, locale));
      setScanCode('');
      void haptics.selection();
    } catch {
      void haptics.error();
      setError(t('mobile.inventory.lookupFailed'));
    } finally {
      setLookingUp(false);
    }
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
    setError(null);
    onSubmit({
      inventoryItemId: item.id,
      warehouseId: effectiveWarehouseId,
      quantity,
      notes: notes.trim() || undefined,
    });
  }

  const title =
    mode === 'issue' ? t('mobile.inventory.issueStock') : t('mobile.inventory.receiveStock');

  return (
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
            <Pressable
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
                ...theme.elevation.card,
              }}
            >
              <AppText variant="label" weight="semibold" color="brand">
                {lookingUp ? t('mobile.inventory.lookingUp') : t('mobile.inventory.lookup')}
              </AppText>
            </Pressable>
          </View>

          <View
            style={{
              borderRadius: theme.radius.xl,
              borderWidth: 1,
              borderColor: colors.borderStrong,
              backgroundColor: colors.surface,
              padding: theme.spacing.md,
              gap: theme.spacing.xs,
              ...theme.elevation.card,
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
          </View>

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
          />

          <TextField
            label={t('mobile.inventory.quantity', { unit })}
            value={qty}
            onChangeText={(text) => {
              setQty(text);
              if (error) setError(null);
            }}
            keyboardType="decimal-pad"
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
  );
}
