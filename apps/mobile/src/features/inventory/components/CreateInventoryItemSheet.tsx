import { useEffect, useState } from 'react';
import { Keyboard, useWindowDimensions } from 'react-native';
import { CodeField } from '@/components/forms/CodeField';
import { QtyStepperField } from '@/components/forms/QtyStepperField';
import { TextField } from '@/components/forms/TextField';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { useLocale } from '@/i18n';
import {
  INVENTORY_CATEGORY_FOR_CREATE,
  type CreateInventoryItemInput,
  type InventoryCategoryGroup,
  type InventoryCustomMeasurement,
} from '../api';
import {
  measurementsHaveValues,
  starterMeasurements,
} from '../inventoryMeasurementTemplates';
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
  /** After the create Modal unmounts — present another Modal only from here. */
  onClosed?: () => void;
  categoryGroup: InventoryCategoryGroup;
  loading?: boolean;
  onSubmit: (body: CreateInventoryItemInput) => void;
};

export function CreateInventoryItemSheet({
  open,
  onClose,
  onClosed,
  categoryGroup,
  loading,
  onSubmit,
}: Props) {
  const { t } = useLocale();
  const { height } = useWindowDimensions();
  const sheetHeight = Math.round(height * 0.78);

  const [materialGroup, setMaterialGroup] =
    useState<InventoryCategoryGroup>(categoryGroup);
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
    if (!open) {
      setUnitSheet(false);
      setTypeSheet(false);
      return;
    }
    setMaterialGroup(categoryGroup);
    setNameEn('');
    setNameAr('');
    setUnit('pcs');
    setMinStock('0');
    setStandardCost('0');
    setBarcode('');
    setColor('');
    setMeasurements(starterMeasurements(categoryGroup));
    setPhotoPreview(null);
    setPhotoRemoteUrl(null);
    setPhotoBusy(false);
    setError(null);
    setUnitSheet(false);
    setTypeSheet(false);
  }, [open, categoryGroup]);

  function selectMaterialGroup(next: InventoryCategoryGroup) {
    setMaterialGroup(next);
    setMeasurements((rows) =>
      measurementsHaveValues(rows) ? rows : starterMeasurements(next),
    );
  }

  function submit() {
    if (!nameEn.trim() || !nameAr.trim()) {
      setError(t('mobile.inventory.createItemRequired'));
      return;
    }
    setError(null);
    Keyboard.dismiss();
    setUnitSheet(false);
    setTypeSheet(false);
    // Camera on this form fills supplier barcode only. Printed identity is assigned on save.
    onSubmit({
      nameEn: nameEn.trim(),
      nameAr: nameAr.trim(),
      unit: unit.trim() || 'pcs',
      category: INVENTORY_CATEGORY_FOR_CREATE[materialGroup],
      materialType: materialGroup,
      minStock: Number(minStock) || 0,
      standardCost: Number(standardCost) || 0,
      barcode: barcode.trim() || undefined,
      color: color.trim() || undefined,
      customMeasurements: measurements,
      ...(showPhoto && photoRemoteUrl ? { imageUrl: photoRemoteUrl } : {}),
    });
  }

  return (
    <>
      <BottomSheet
        open={open}
        onClose={onClose}
        onClosed={onClosed}
        title={t('mobile.inventory.newItem')}
        sheetHeight={sheetHeight}
      >
        <InventorySheetBody
          hint={t('mobile.inventory.newItemHint', {
            group: t(`mobile.inventory.groups.${materialGroup}`),
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
          <QtyStepperField
            label={t('mobile.inventory.standardCost')}
            value={standardCost}
            onChangeText={setStandardCost}
            min={0}
            placeholder="0"
          />
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
          disabled={loading || photoBusy}
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
