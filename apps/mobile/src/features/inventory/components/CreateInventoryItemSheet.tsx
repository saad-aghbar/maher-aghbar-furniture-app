import { useEffect, useState } from 'react';
import { useWindowDimensions } from 'react-native';
import { CodeField } from '@/components/forms/CodeField';
import { TextField } from '@/components/forms/TextField';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { useLocale } from '@/i18n';
import {
  INVENTORY_CATEGORY_FOR_CREATE,
  type CreateInventoryItemInput,
  type InventoryCategoryGroup,
} from '../api';
import { AccessoryPhotoField } from './AccessoryPhotoField';
import { InventorySheetBody } from './InventorySheetBody';
import { InventorySheetFooter } from './InventorySheetFooter';

type Props = {
  open: boolean;
  onClose: () => void;
  categoryGroup: InventoryCategoryGroup;
  loading?: boolean;
  onSubmit: (body: CreateInventoryItemInput) => void;
};

export function CreateInventoryItemSheet({
  open,
  onClose,
  categoryGroup,
  loading,
  onSubmit,
}: Props) {
  const { t } = useLocale();
  const { height } = useWindowDimensions();
  const sheetHeight = Math.round(height * 0.72);
  const showPhoto = categoryGroup === 'accessories';

  const [sku, setSku] = useState('');
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
  const [photoBusy, setPhotoBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setSku('');
    setNameEn('');
    setNameAr('');
    setUnit('pcs');
    setMinStock('0');
    setStandardCost('0');
    setBarcode('');
    setMaterialType('');
    setColor('');
    setSize('');
    setPhotoPreview(null);
    setPhotoRemoteUrl(null);
    setPhotoBusy(false);
    setError(null);
  }, [open]);

  function submit() {
    if (!sku.trim() || !nameEn.trim() || !nameAr.trim()) {
      setError(t('mobile.inventory.createItemRequired'));
      return;
    }
    setError(null);
    onSubmit({
      sku: sku.trim(),
      nameEn: nameEn.trim(),
      nameAr: nameAr.trim(),
      unit: unit.trim() || 'pcs',
      category: INVENTORY_CATEGORY_FOR_CREATE[categoryGroup],
      minStock: Number(minStock) || 0,
      standardCost: Number(standardCost) || 0,
      barcode: barcode.trim() || undefined,
      materialType: materialType.trim() || undefined,
      color: color.trim() || undefined,
      size: size.trim() || undefined,
      ...(showPhoto && photoRemoteUrl ? { imageUrl: photoRemoteUrl } : {}),
    });
  }

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={t('mobile.inventory.newItem')}
      sheetHeight={sheetHeight}
    >
      <InventorySheetBody
        hint={t('mobile.inventory.newItemHint', {
          group: t(`mobile.inventory.groups.${categoryGroup}`),
        })}
        error={error}
      >
        {showPhoto ? (
          <AccessoryPhotoField
            previewUri={photoPreview}
            uploading={photoBusy}
            onUploadingChange={setPhotoBusy}
            onChange={({ localUri, remoteUrl }) => {
              setPhotoPreview(localUri);
              setPhotoRemoteUrl(remoteUrl);
            }}
          />
        ) : null}
        <TextField
          label={t('mobile.inventory.sku')}
          value={sku}
          onChangeText={setSku}
          autoCapitalize="characters"
          autoCorrect={false}
        />
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
        <TextField
          label={t('mobile.inventory.standardCost')}
          value={standardCost}
          onChangeText={setStandardCost}
          keyboardType="decimal-pad"
        />
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
          autoCapitalize="none"
        />
      </InventorySheetBody>
      <InventorySheetFooter
        primaryLabel={t('mobile.inventory.saveItem')}
        onPrimary={submit}
        onSecondary={onClose}
        loading={loading || photoBusy}
        disabled={loading || photoBusy}
      />
    </BottomSheet>
  );
}
