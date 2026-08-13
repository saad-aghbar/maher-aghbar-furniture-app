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
import type { Warehouse, WarehouseType } from '../api';
import { useCreateWarehouseMutation } from '../query';
import { InventoryPickerRow } from './InventoryPickerRow';
import { InventorySheetFooter } from './InventorySheetFooter';
import { WarehouseTypeSheet } from './WarehouseTypeSheet';

type Props = {
  open: boolean;
  onClose: () => void;
  /** Stack on top of receive / transfer / count sheets. */
  overlay?: boolean;
  onCreated: (warehouse: Warehouse) => void;
};

export function CreateWarehouseSheet({
  open,
  onClose,
  overlay = false,
  onCreated,
}: Props) {
  const { t } = useLocale();
  const { theme } = useTheme();
  const { showToast } = useToast();
  const createMutation = useCreateWarehouseMutation();

  const [nameEn, setNameEn] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [type, setType] = useState<WarehouseType>('RAW');
  const [typeSheet, setTypeSheet] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const label = (key: string, fallback: string) => {
    const value = t(key);
    return value === key ? fallback : value;
  };

  useEffect(() => {
    if (!open) return;
    setNameEn('');
    setNameAr('');
    setType('RAW');
    setTypeSheet(false);
    setError(null);
  }, [open]);

  function submit() {
    if (!nameEn.trim() || !nameAr.trim()) {
      setError(
        label(
          'mobile.inventory.createWarehouseRequired',
          'English and Arabic names are required.',
        ),
      );
      return;
    }
    setError(null);
    createMutation.mutate(
      {
        nameEn: nameEn.trim(),
        nameAr: nameAr.trim(),
        type,
      },
      {
        onSuccess: (row) => {
          void haptics.confirmMedium();
          showToast({
            variant: 'success',
            message: label('mobile.inventory.warehouseCreated', 'Warehouse added'),
          });
          onCreated(row);
          onClose();
        },
        onError: (err) => {
          void haptics.error();
          const msg = isApiError(err)
            ? toastMessageForError(err)
            : label(
                'mobile.inventory.warehouseCreateFailed',
                'Couldn’t add warehouse',
              );
          setError(msg);
          showToast({ variant: 'error', message: msg });
        },
      },
    );
  }

  return (
    <>
      <BottomSheet
        open={open}
        onClose={onClose}
        title={label('mobile.inventory.newWarehouse', 'Add warehouse')}
        fitContent
        overlay={overlay}
      >
        <View style={{ gap: theme.spacing.md }}>
          <AppText variant="caption" color="muted">
            {label(
              'mobile.inventory.newWarehouseHint',
              'Adds a warehouse for receiving, transfers, and stock counts.',
            )}
          </AppText>
          {error ? (
            <AppText variant="caption" color="error">
              {error}
            </AppText>
          ) : null}
          <TextField
            label={t('mobile.inventory.nameEn')}
            value={nameEn}
            onChangeText={setNameEn}
          />
          <TextField
            label={t('mobile.inventory.nameAr')}
            value={nameAr}
            onChangeText={setNameAr}
          />
          <InventoryPickerRow
            label={label('mobile.inventory.warehouseType', 'Warehouse type')}
            value={label(`mobile.inventory.warehouseTypes.${type}`, type)}
            icon="business-outline"
            onPress={() => setTypeSheet(true)}
          />
          <InventorySheetFooter
            primaryLabel={t('mobile.inventory.saveItem')}
            onPrimary={submit}
            onSecondary={onClose}
            loading={createMutation.isPending}
            disabled={createMutation.isPending}
          />
        </View>
      </BottomSheet>

      <WarehouseTypeSheet
        open={typeSheet}
        selected={type}
        onClose={() => setTypeSheet(false)}
        onSelect={setType}
      />
    </>
  );
}
