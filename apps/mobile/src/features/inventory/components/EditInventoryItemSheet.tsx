import { useEffect, useState } from 'react';
import { useWindowDimensions } from 'react-native';
import { CodeField } from '@/components/forms/CodeField';
import { QtyStepperField } from '@/components/forms/QtyStepperField';
import { TextField } from '@/components/forms/TextField';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { useLocale } from '@/i18n';
import {
  INVENTORY_CATEGORY_FOR_CREATE,
  categoryGroupFromCategory,
  type InventoryCategoryGroup,
  type InventoryCustomMeasurement,
  type UpdateInventoryItemInput,
} from '../api';
import {
  measurementsHaveValues,
  parseInventoryMeasurements,
  starterMeasurements,
} from '../inventoryMeasurementTemplates';
import type { InventoryItemCardModel } from '../selectInventory';
import { AccessoryPhotoField } from './AccessoryPhotoField';
import { InventoryMaterialTypeSheet } from './InventoryMaterialTypeSheet';
import {
  InventoryMeasurementEditorSheet,
  InventoryMeasurementsList,
  useInventoryMeasurementEditor,
} from './InventoryMeasurementsSection';
import { InventoryPickerRow } from './InventoryPickerRow';
import { InventorySheetBody } from './InventorySheetBody';
import { InventorySheetFooter } from './InventorySheetFooter';
import { InventoryUnitPickerSheet } from './InventoryUnitPickerSheet';

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

  const [materialGroup, setMaterialGroup] =
    useState<InventoryCategoryGroup>('fabric');
  const [nameEn, setNameEn] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [unit, setUnit] = useState('pcs');
  const [minStock, setMinStock] = useState('0');
  const [standardCost, setStandardCost] = useState('0');
  const [barcode, setBarcode] = useState('');
  const [color, setColor] = useState('');
  const [measurements, setMeasurements] = useState<InventoryCustomMeasurement[]>([]);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoRemoteUrl, setPhotoRemoteUrl] = useState<string | null>(null);
  const [photoDirty, setPhotoDirty] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unitSheet, setUnitSheet] = useState(false);
  const [typeSheet, setTypeSheet] = useState(false);
  const measureEditor = useInventoryMeasurementEditor(
    measurements,
    setMeasurements,
    open,
  );

  const showPhoto = true;

  useEffect(() => {
    if (!open || !item) return;
    const group = categoryGroupFromCategory(item.category);
    setMaterialGroup(group);
    setNameEn(item.nameEn);
    setNameAr(item.nameAr);
    setUnit(item.unit || 'pcs');
    setMinStock(String(item.minStock ?? 0));
    setStandardCost(item.standardCost != null ? String(item.standardCost) : '0');
    setBarcode(item.barcode ?? '');
    setColor(item.color ?? '');
    setMeasurements(parseInventoryMeasurements(item.customMeasurements));
    setPhotoPreview(item.imageUrl);
    setPhotoRemoteUrl(item.imageUrl);
    setPhotoDirty(false);
    setPhotoBusy(false);
    setError(null);
    setUnitSheet(false);
    setTypeSheet(false);
  }, [open, item]);

  function selectMaterialGroup(next: InventoryCategoryGroup) {
    setMaterialGroup(next);
    setMeasurements((rows) =>
      measurementsHaveValues(rows) ? rows : starterMeasurements(next),
    );
  }

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
      category: INVENTORY_CATEGORY_FOR_CREATE[materialGroup],
      materialType: materialGroup,
      minStock: Number(minStock) || 0,
      barcode: barcode.trim() || undefined,
      color: color.trim() || undefined,
    };
    const hadMeasurements = (item?.customMeasurements?.length ?? 0) > 0;
    if (measurements.length > 0 || hadMeasurements) {
      body.customMeasurements = measurements;
    }
    if (canEditCost) {
      body.standardCost = Number(standardCost) || 0;
    }
    if (showPhoto && photoDirty) {
      body.imageUrl = photoRemoteUrl;
    }
    onSubmit(body);
  }

  return (
    <>
      <BottomSheet
        open={open}
        onClose={onClose}
        title={t('mobile.inventory.editItem')}
        sheetHeight={sheetHeight}
      >
        <InventorySheetBody hint={item?.sku} error={error}>
          {showPhoto ? (
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
          <InventoryPickerRow
            label={t('mobile.inventory.unit')}
            value={unit}
            icon="resize-outline"
            onPress={() => setUnitSheet(true)}
          />
          <InventoryPickerRow
            label={t('mobile.inventory.materialType')}
            value={t(`mobile.inventory.groups.${materialGroup}`)}
            icon="layers-outline"
            onPress={() => setTypeSheet(true)}
          />
          <InventoryMeasurementsList
            measurements={measurements}
            onAdd={measureEditor.openAdd}
            onEdit={measureEditor.openEdit}
            onRemove={measureEditor.removeAt}
          />
          <QtyStepperField
            label={t('mobile.inventory.minStock')}
            value={minStock}
            onChangeText={setMinStock}
            min={0}
            placeholder="0"
          />
          {canEditCost ? (
            <QtyStepperField
              label={t('mobile.inventory.standardCost')}
              value={standardCost}
              onChangeText={setStandardCost}
              min={0}
              placeholder="0"
            />
          ) : null}
          <CodeField
            label={t('mobile.inventory.supplierBarcode')}
            value={barcode}
            onChangeText={setBarcode}
            placeholder={t('mobile.inventory.scanSupplierBarcodeHint')}
            scanTitle={t('mobile.inventory.scanSupplierBarcode')}
            scanHint={t('mobile.inventory.scanSupplierBarcodeHint')}
            scanAccessibilityLabel={t('mobile.inventory.scanSupplierBarcode')}
            scanIcon="barcode-outline"
          />
          <TextField
            label={t('mobile.inventory.color')}
            value={color}
            onChangeText={setColor}
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

      <InventoryMeasurementEditorSheet
        open={measureEditor.sheetOpen}
        onClose={measureEditor.close}
        measureValueSheet={measureEditor.measureValueSheet}
        setMeasureValueSheet={measureEditor.setMeasureValueSheet}
        editingIndex={measureEditor.editingIndex}
        draft={measureEditor.draft}
        setDraft={measureEditor.setDraft}
        save={measureEditor.save}
      />
      <InventoryUnitPickerSheet
        open={unitSheet}
        unit={unit}
        onClose={() => setUnitSheet(false)}
        onSelect={setUnit}
      />
      <InventoryMaterialTypeSheet
        open={typeSheet}
        selected={materialGroup}
        onClose={() => setTypeSheet(false)}
        onSelect={selectMaterialGroup}
      />
    </>
  );
}
