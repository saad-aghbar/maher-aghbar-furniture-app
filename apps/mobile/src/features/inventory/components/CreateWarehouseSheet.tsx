import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { isApiError } from '@/api/errors';
import { toastMessageForError } from '@/api/queryClient';
import { AppText } from '@/components/AppText';
import { useToast } from '@/components/feedback/Toast';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { LocaleNameField } from '@/features/catalog/components/BilingualNameField';
import { useLocale } from '@/i18n';
import { resolveTrilingualName } from '@/i18n/resolveTrilingualName';
import { AnimatedPressable, haptics } from '@/motion';
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
  defaultType?: WarehouseType;
};

export function CreateWarehouseSheet({
  open,
  onClose,
  overlay = false,
  onCreated,
  defaultType = 'RAW_MATERIALS',
}: Props) {
  const { t, locale } = useLocale();
  const { theme } = useTheme();
  const { showToast } = useToast();
  const createMutation = useCreateWarehouseMutation();

  const [name, setName] = useState('');
  const [type, setType] = useState<WarehouseType>('RAW_MATERIALS');
  const [typeSheet, setTypeSheet] = useState(false);
  const [isDefault, setIsDefault] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [translating, setTranslating] = useState(false);

  const label = (key: string, fallback: string) => {
    const value = t(key);
    return value === key ? fallback : value;
  };

  useEffect(() => {
    if (!open) return;
    setName('');
    setType(defaultType);
    setTypeSheet(false);
    setIsDefault(false);
    setError(null);
  }, [open, defaultType]);

  async function submit() {
    if (!name.trim()) {
      setError(label('catalog.namesRequired', 'Name is required.'));
      return;
    }
    setError(null);
    setTranslating(true);
    try {
      const names = await resolveTrilingualName(name, locale);
      createMutation.mutate(
        {
          nameEn: names.nameEn,
          nameAr: names.nameAr,
          nameHe: names.nameHe || undefined,
          type,
          isDefault,
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
    } finally {
      setTranslating(false);
    }
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
          <LocaleNameField value={name} onChange={setName} />
          <InventoryPickerRow
            label={label('mobile.inventory.warehouseType', 'Warehouse type')}
            value={label(`mobile.inventory.warehouseTypes.${type}`, type)}
            icon="business-outline"
            onPress={() => setTypeSheet(true)}
          />
          <AnimatedPressable
            variant="button"
            accessibilityRole="button"
            onPress={() => {
              void haptics.selection();
              setIsDefault((v) => !v);
            }}
          >
            <AppText variant="caption">
              {isDefault ? '☑ ' : '☐ '}
              {label('inventory.isDefault', 'Default for this type')}
            </AppText>
          </AnimatedPressable>
          <InventorySheetFooter
            primaryLabel={t('mobile.inventory.saveItem')}
            onPrimary={submit}
            onSecondary={onClose}
            loading={createMutation.isPending || translating}
            disabled={createMutation.isPending || translating}
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
