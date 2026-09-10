import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { isApiError } from '@/api/errors';
import { toastMessageForError } from '@/api/queryClient';
import { AppText } from '@/components/AppText';
import { useToast } from '@/components/feedback/Toast';
import { TextField } from '@/components/forms/TextField';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { useLocale } from '@/i18n';
import { haptics } from '@/motion';
import { useTheme } from '@/theme';
import type { Warehouse } from '../api';
import {
  useCreateWarehouseLocationMutation,
  useUpdateWarehouseLocationMutation,
} from '../query';
import { InventoryPickerRow } from './InventoryPickerRow';
import { InventorySheetFooter } from './InventorySheetFooter';
import type { HoldingLocationOption } from './HoldingLocationBox';

type Props = {
  open: boolean;
  onClose: () => void;
  overlay?: boolean;
  warehouses: Warehouse[];
  editing?: HoldingLocationOption | null;
  defaultWarehouseId?: string | null;
  onSaved: (locationId: string) => void;
  /** Inventory bin desk — not fabric-holding copy. */
  copy?: 'holding' | 'bin';
  /** Skip the warehouse picker and keep this warehouse. */
  lockWarehouseId?: string;
};

/**
 * Add or edit a WarehouseLocation — the inventory bin used as fabric holding.
 * The bin code is generated on the server from the name.
 */
export function HoldingLocationFormSheet({
  open,
  onClose,
  overlay = true,
  warehouses,
  editing,
  defaultWarehouseId,
  onSaved,
  copy = 'holding',
  lockWarehouseId,
}: Props) {
  const { t, locale } = useLocale();
  const { theme } = useTheme();
  const { showToast } = useToast();
  const createMutation = useCreateWarehouseLocationMutation();
  const updateMutation = useUpdateWarehouseLocationMutation();

  const [warehouseId, setWarehouseId] = useState('');
  const [name, setName] = useState('');
  const [warehouseSheet, setWarehouseSheet] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rawWarehouses = lockWarehouseId
    ? warehouses.filter((w) => w.id === lockWarehouseId)
    : copy === 'bin'
      ? warehouses
      : warehouses.filter((w) => !w.type || w.type === 'RAW_MATERIALS');
  const selectedWh = rawWarehouses.find((w) => w.id === warehouseId);
  const editingId = editing?.id ?? '';

  useEffect(() => {
    if (!open) return;
    setError(null);
    setWarehouseSheet(false);
    if (editing) {
      setWarehouseId(editing.warehouseId);
      setName(editing.name?.trim() || editing.label);
      return;
    }
    setWarehouseId(lockWarehouseId || defaultWarehouseId || '');
    setName('');
    // Omit `warehouses` so a refetch after create does not wipe the form.
  }, [open, editing, editingId, defaultWarehouseId, lockWarehouseId]);

  const warehouseLabel = selectedWh
    ? locale === 'ar'
      ? selectedWh.nameAr || selectedWh.nameEn
      : selectedWh.nameEn || selectedWh.nameAr
    : '';

  const busy = createMutation.isPending || updateMutation.isPending;
  const valid = Boolean(warehouseId && name.trim());

  function submit() {
    if (!valid || !warehouseId) return;
    const nextName = name.trim();
    setError(null);
    if (editing) {
      updateMutation.mutate(
        {
          warehouseId: editing.warehouseId,
          locationId: editing.id,
          body: { name: nextName },
        },
        {
          onSuccess: (row) => {
            void haptics.confirmLight();
            showToast({
              variant: 'success',
              message:
                copy === 'bin'
                  ? t('mobile.inventory.binUpdated')
                  : t('mobile.purchasing.fabricHoldingUpdated'),
            });
            onSaved(row.id);
            onClose();
          },
          onError: (err) => fail(err),
        },
      );
      return;
    }
    createMutation.mutate(
      { warehouseId, body: { name: nextName } },
      {
        onSuccess: (row) => {
          void haptics.confirmLight();
            showToast({
              variant: 'success',
              message:
                copy === 'bin'
                  ? t('mobile.inventory.binCreated')
                  : t('mobile.purchasing.fabricHoldingCreated'),
            });
          onSaved(row.id);
          onClose();
        },
        onError: (err) => fail(err),
      },
    );
  }

  function fail(err: unknown) {
    void haptics.error();
    const msg = isApiError(err)
      ? toastMessageForError(err)
      : t('mobile.purchasing.updateFailed');
    setError(msg);
    showToast({ variant: 'error', message: msg });
  }

  return (
    <>
      <BottomSheet
        open={open}
        onClose={onClose}
        title={
          editing
            ? copy === 'bin'
              ? t('mobile.inventory.editBin')
              : t('mobile.purchasing.fabricHoldingEdit')
            : copy === 'bin'
              ? t('mobile.inventory.addBin')
              : t('mobile.purchasing.fabricHoldingAdd')
        }
        fitContent
        overlay={overlay}
      >
        <View style={{ gap: theme.spacing.md }}>
          <AppText variant="caption" color="muted">
            {copy === 'bin'
              ? t('mobile.inventory.addBinHint')
              : t('mobile.purchasing.holdingLocationHint')}
          </AppText>
          {error ? (
            <AppText variant="caption" color="error">
              {error}
            </AppText>
          ) : null}
          {rawWarehouses.length > 1 && !editing && !lockWarehouseId ? (
            <InventoryPickerRow
              label={t('mobile.purchasing.fabricHoldingWarehouse')}
              value={warehouseLabel}
              icon="business-outline"
              onPress={() => setWarehouseSheet(true)}
            />
          ) : warehouseLabel && !lockWarehouseId ? (
            <AppText variant="caption" color="muted">
              {t('mobile.purchasing.fabricHoldingWarehouse')}: {warehouseLabel}
            </AppText>
          ) : null}
          <TextField
            label={
              copy === 'bin'
                ? t('mobile.inventory.binName')
                : t('mobile.purchasing.fabricHoldingName')
            }
            value={name}
            onChangeText={setName}
          />
          <InventorySheetFooter
            primaryLabel={t('mobile.inventory.saveItem')}
            onPrimary={submit}
            onSecondary={onClose}
            loading={busy}
            disabled={!valid || busy}
          />
        </View>
      </BottomSheet>

      {warehouseSheet ? (
        <WarehousePickOverlay
          open={warehouseSheet}
          warehouses={rawWarehouses}
          selectedId={warehouseId}
          onClose={() => setWarehouseSheet(false)}
          onSelect={(id) => {
            setWarehouseId(id);
            setWarehouseSheet(false);
          }}
        />
      ) : null}
    </>
  );
}

function WarehousePickOverlay({
  open,
  warehouses,
  selectedId,
  onClose,
  onSelect,
}: {
  open: boolean;
  warehouses: Warehouse[];
  selectedId: string;
  onClose: () => void;
  onSelect: (id: string) => void;
}) {
  const { t, locale } = useLocale();
  const { theme } = useTheme();
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={t('mobile.purchasing.fabricHoldingWarehouse')}
      fitContent
      overlay
    >
      <View style={{ gap: theme.spacing.sm }}>
        {warehouses.map((w) => (
          <InventoryPickerRow
            key={w.id}
            label={w.code}
            value={locale === 'ar' ? w.nameAr || w.nameEn : w.nameEn || w.nameAr}
            icon={selectedId === w.id ? 'checkmark-circle' : 'business-outline'}
            onPress={() => onSelect(w.id)}
          />
        ))}
      </View>
    </BottomSheet>
  );
}
