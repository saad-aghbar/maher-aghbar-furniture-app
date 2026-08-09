import { useEffect, useState } from 'react';
import { useWindowDimensions } from 'react-native';
import { CodeField } from '@/components/forms/CodeField';
import { TextField } from '@/components/forms/TextField';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { useLocale } from '@/i18n';
import type { UpdateInventoryItemInput } from '../api';
import type { InventoryItemCardModel } from '../selectInventory';
import { AccessoryPhotoField } from './AccessoryPhotoField';
import { InventorySheetBody } from './InventorySheetBody';
import { InventorySheetFooter } from './InventorySheetFooter';

type Props = {
  open: boolean;
  onClose: () => void;
  item: InventoryItemCardModel | null;
  loading?: boolean;
  canEditCost?: boolean;
  onSubmit: (body: UpdateInventoryItemInput) => void;
};

export function EditInventoryItemSheet({
  open,
  onClose,
  item,
  loading,
  canEditCost = false,
  onSubmit,
}: Props) {
  const { t } = useLocale();
  const { height } = useWindowDimensions();
  const sheetHeight = Math.round(height * 0.78);

  const [nameEn, setNameEn] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [unit, setUnit] = useState('pcs');
  const [minStock, setMinStock] = useState('0');
  const [standardCost, setStandardCost] = useState('0');
  const [barcode, setBarcode] = useState('');
  const [materialType, setMaterialType] = useState('');
  const [color, setColor] = useState('');
  const [size, setSize] = useState('');
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoRemoteUrl, setPhotoRemoteUrl] = useState<string | null>(null);
  const [photoDirty, setPhotoDirty] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !item) return;
    setNameEn(item.nameEn);
    setNameAr(item.nameAr);
    setUnit(item.unit || 'pcs');
    setMinStock(String(item.minStock ?? 0));
    setStandardCost(item.standardCost != null ? String(item.standardCost) : '0');
    setBarcode(item.barcode ?? '');
    setMaterialType(item.materialType ?? '');
    setColor(item.color ?? '');
    setSize(item.size ?? '');
    setPhotoPreview(item.imageUrl);
    setPhotoRemoteUrl(item.imageUrl);
    setPhotoDirty(false);
    setPhotoBusy(false);
    setError(null);
  }, [open, item]);

  function submit() {
    if (!nameEn.trim() || !nameAr.trim()) {
      setError(t('mobile.inventory.editItemRequired'));
      return;
    }
    setError(null);
    const body: UpdateInventoryItemInput = {
      nameEn: nameEn.trim(),
      nameAr: nameAr.trim(),
      unit: unit.trim() || 'pcs',
      minStock: Number(minStock) || 0,
      barcode: barcode.trim() || undefined,
      materialType: materialType.trim() || undefined,
      color: color.trim() || undefined,
      size: size.trim() || undefined,
    };
    if (canEditCost) {
      body.standardCost = Number(standardCost) || 0;
    }
    if (item?.isAccessory && photoDirty) {
      body.imageUrl = photoRemoteUrl;
    }
    onSubmit(body);
  }

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={t('mobile.inventory.editItem')}
      sheetHeight={sheetHeight}
    >
      <InventorySheetBody
        hint={item?.sku}
        error={error}
      >
        {item?.isAccessory ? (
          <AccessoryPhotoField
            previewUri={photoPreview}
            uploading={photoBusy}
            onUploadingChange={setPhotoBusy}
            onChange={({ localUri, remoteUrl }) => {
              setPhotoPreview(localUri ?? remoteUrl);
              setPhotoRemoteUrl(remoteUrl);
              setPhotoDirty(true);
            }}
          />
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
        <TextField
          label={t('mobile.inventory.unit')}
          value={unit}
          onChangeText={setUnit}
          autoCapitalize="none"
        />
        <TextField
          label={t('mobile.inventory.minStock')}
          value={minStock}
          onChangeText={setMinStock}
          keyboardType="decimal-pad"
        />
        {canEditCost ? (
          <TextField
            label={t('mobile.inventory.standardCost')}
            value={standardCost}
            onChangeText={setStandardCost}
            keyboardType="decimal-pad"
          />
        ) : null}
        <CodeField
          label={t('mobile.inventory.barcode')}
          value={barcode}
          onChangeText={setBarcode}
          placeholder={t('mobile.scan.enterOrScan')}
        />
        <TextField
          label={t('mobile.inventory.materialType')}
          value={materialType}
          onChangeText={setMaterialType}
        />
        <TextField
          label={t('mobile.inventory.color')}
          value={color}
          onChangeText={setColor}
        />
        <TextField
          label={t('mobile.inventory.size')}
          value={size}
          onChangeText={setSize}
        />
      </InventorySheetBody>
      <InventorySheetFooter
        primaryLabel={t('mobile.inventory.saveItem')}
        onPrimary={submit}
        onSecondary={onClose}
        loading={loading || photoBusy}
        disabled={loading || photoBusy || !item}
      />
    </BottomSheet>
  );
}
