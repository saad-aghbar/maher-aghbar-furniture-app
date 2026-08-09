import { useEffect, useState } from 'react';
import { Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { TextField } from '@/components/forms/TextField';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { useLocale } from '@/i18n';
import { haptics } from '@/motion';
import { useTheme } from '@/theme';
import type { CreateInventoryStockCountInput, InventoryItem, Warehouse } from '../api';
import { InventoryItemPickPanel } from './InventoryItemPickPanel';
import { InventorySheetFooter } from './InventorySheetFooter';
import { InventorySheetSectionLabel } from './InventorySheetBody';
import { WarehousePickList } from './WarehousePickList';

type Props = {
  open: boolean;
  onClose: () => void;
  warehouses: Warehouse[];
  loading?: boolean;
  onSubmit: (body: CreateInventoryStockCountInput) => void;
};

export function CreateStockCountSheet({
  open,
  onClose,
  warehouses,
  loading,
  onSubmit,
}: Props) {
  const { t, locale, isRTL } = useLocale();
  const { theme, colors } = useTheme();
  const { height } = useWindowDimensions();
  const sheetHeight = Math.round(height * 0.78);
  const warehouseListHeight = Math.round(height * 0.28);

  const [warehouseId, setWarehouseId] = useState('');
  const [kind, setKind] = useState<'PERIODIC' | 'SURPRISE'>('PERIODIC');
  const [item, setItem] = useState<InventoryItem | null>(null);
  const [qty, setQty] = useState('');
  const [notes, setNotes] = useState('');
  const [pickOpen, setPickOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setWarehouseId(warehouses[0]?.id ?? '');
    setKind('PERIODIC');
    setItem(null);
    setQty('');
    setNotes('');
    setError(null);
    setPickOpen(false);
  }, [open, warehouses]);

  function submit() {
    const countedQty = Number(qty);
    if (!warehouseId || !item || !Number.isFinite(countedQty)) {
      setError(t('mobile.inventory.countRequired'));
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
            <InventorySheetSectionLabel label={t('mobile.inventory.countKindLabel')} />
            <View
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                gap: theme.spacing.sm,
              }}
            >
              {(['PERIODIC', 'SURPRISE'] as const).map((k) => {
                const selected = kind === k;
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
                      borderColor: selected ? colors.brand : colors.borderStrong,
                      borderRadius: theme.radius.xl,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: selected ? colors.brandSoft : colors.surface,
                      ...theme.elevation.card,
                    }}
                  >
                    <AppText variant="label" weight="semibold" color={selected ? 'brand' : 'primary'}>
                      {t(`mobile.inventory.countKind.${k}`)}
                    </AppText>
                  </Pressable>
                );
              })}
            </View>

            <WarehousePickList
              warehouses={warehouses}
              selectedId={warehouseId}
              onSelect={setWarehouseId}
              label={t('mobile.inventory.warehouse')}
              listHeight={warehouseListHeight}
              resetToken={open}
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
              label={t('mobile.inventory.countedQty')}
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
            primaryLabel={t('mobile.inventory.confirmCount')}
            onPrimary={submit}
            onSecondary={onClose}
            loading={loading}
          />
        </View>
      )}
    </BottomSheet>
  );
}
