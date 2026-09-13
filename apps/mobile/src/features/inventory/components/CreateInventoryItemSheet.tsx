import { useEffect, useState } from 'react';
import { Keyboard, useWindowDimensions } from 'react-native';
import { AppText } from '@/components/AppText';
import { QtyStepperField } from '@/components/forms/QtyStepperField';
import { TextField } from '@/components/forms/TextField';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { LocaleNameField } from '@/features/catalog/components/BilingualNameField';
import { useLocale } from '@/i18n';
import { resolveTrilingualName } from '@/i18n/resolveTrilingualName';
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
import { PurchasingSupplierSheet } from '@/features/purchasing/components/PurchasingSupplierSheet';
import { useSuppliersQuery } from '@/features/purchasing/query';
import { localizedName } from '@maher/i18n';

type Props = {
  open: boolean;
  onClose: () => void;
  /** After the create Modal unmounts — present another Modal only from here. */
  onClosed?: () => void;
  categoryGroup: InventoryCategoryGroup;
  loading?: boolean;
  onSubmit: (body: CreateInventoryItemInput) => void;
  /** Stack on top of a picker / preparing sheet. */
  overlay?: boolean;
  /** Preparing fabric: standard cost must be greater than zero. */
  requireCost?: boolean;
};

export function CreateInventoryItemSheet({
  open,
  onClose,
  onClosed,
  categoryGroup,
  loading,
  onSubmit,
  overlay = false,
  requireCost = false,
}: Props) {
  const { t, locale } = useLocale();
  const { height } = useWindowDimensions();
  const sheetHeight = Math.round(height * 0.78);

  const [materialGroup, setMaterialGroup] =
    useState<InventoryCategoryGroup>(categoryGroup);
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('pcs');
  const [minStock, setMinStock] = useState('0');
  const [reorderQty, setReorderQty] = useState('0');
  const [standardCost, setStandardCost] = useState('0');
  const [preferredSupplierId, setPreferredSupplierId] = useState('');
  const [preferredSupplierName, setPreferredSupplierName] = useState('');
  const [supplierOpen, setSupplierOpen] = useState(false);
  const [color, setColor] = useState('');
  const [measurements, setMeasurements] = useState<InventoryCustomMeasurement[]>([]);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoRemoteUrl, setPhotoRemoteUrl] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [translating, setTranslating] = useState(false);
  const [unitSheet, setUnitSheet] = useState(false);
  const [typeSheet, setTypeSheet] = useState(false);
  const measureEditor = useInventoryMeasurementEditor(
    measurements,
    setMeasurements,
    open,
  );
  const suppliersQuery = useSuppliersQuery(open, { status: 'ACTIVE' });
  const supplierOptions = (suppliersQuery.data?.data ?? []).map((s) => ({
    id: s.id,
    name: localizedName(
      locale,
      { name: s.name, nameEn: s.nameEn, nameAr: s.nameAr, nameHe: s.nameHe },
      s.code,
    ),
    code: s.code,
    searchText: [s.name, s.nameEn, s.nameAr, s.nameHe, s.code].filter(Boolean).join(' '),
  }));

  const showPhoto = true;

  useEffect(() => {
    if (!open) {
      setUnitSheet(false);
      setTypeSheet(false);
      return;
    }
    setMaterialGroup(categoryGroup);
    setName('');
    setUnit(categoryGroup === 'fabric' ? 'm' : 'pcs');
    setMinStock('0');
    setReorderQty('0');
    setStandardCost(requireCost ? '' : '0');
    setPreferredSupplierId('');
    setPreferredSupplierName('');
    setColor('');
    setMeasurements(starterMeasurements(categoryGroup));
    setPhotoPreview(null);
    setPhotoRemoteUrl(null);
    setPhotoBusy(false);
    setError(null);
    setUnitSheet(false);
    setTypeSheet(false);
  }, [open, categoryGroup, requireCost]);

  function selectMaterialGroup(next: InventoryCategoryGroup) {
    setMaterialGroup(next);
    setMeasurements((rows) =>
      measurementsHaveValues(rows) ? rows : starterMeasurements(next),
    );
  }

  const costOk = !requireCost || Number(standardCost) > 0;

  async function submit() {
    if (!name.trim()) {
      setError(t('catalog.namesRequired'));
      return;
    }
    if (!costOk) {
      setError(t('mobile.purchasing.fabricUnitCost'));
      return;
    }
    setError(null);
    Keyboard.dismiss();
    setUnitSheet(false);
    setTypeSheet(false);
    setTranslating(true);
    try {
      const names = await resolveTrilingualName(name, locale);
      onSubmit({
        nameEn: names.nameEn,
        nameAr: names.nameAr,
        nameHe: names.nameHe || undefined,
        unit: unit.trim() || 'pcs',
        category: INVENTORY_CATEGORY_FOR_CREATE[materialGroup],
        materialType: materialGroup,
        minStock: Number(minStock) || 0,
        reorderQty: Number(reorderQty) > 0 ? Number(reorderQty) : undefined,
        standardCost: Number(standardCost) || 0,
        preferredSupplierId: preferredSupplierId || undefined,
        color: color.trim() || undefined,
        customMeasurements: measurements,
        ...(showPhoto && photoRemoteUrl ? { imageUrl: photoRemoteUrl } : {}),
      });
    } finally {
      setTranslating(false);
    }
  }

  return (
    <>
      <BottomSheet
        open={open}
        onClose={onClose}
        onClosed={onClosed}
        title={t('mobile.inventory.newItem')}
        sheetHeight={sheetHeight}
        overlay={overlay}
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
          <LocaleNameField value={name} onChange={setName} />
          <InventoryPickerRow
            label={t('mobile.inventory.unit')}
            value={unit}
            icon="resize-outline"
            onPress={() => setUnitSheet(true)}
          />
          {requireCost ? (
            <AppText variant="caption" color="muted">
              {t(`mobile.inventory.groups.${materialGroup}`)}
            </AppText>
          ) : (
            <InventoryPickerRow
              label={t('mobile.inventory.materialType')}
              value={t(`mobile.inventory.groups.${materialGroup}`)}
              icon="layers-outline"
              onPress={() => setTypeSheet(true)}
            />
          )}
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
            label={t('mobile.inventory.reorderQty')}
            value={reorderQty}
            onChangeText={setReorderQty}
            min={0}
            placeholder="0"
          />
          <AppText variant="caption" color="muted">
            {t('mobile.inventory.reorderQtyHint')}
          </AppText>
          <QtyStepperField
            label={t('mobile.inventory.standardCost')}
            value={standardCost}
            onChangeText={setStandardCost}
            min={0}
            placeholder="0"
          />
          <InventoryPickerRow
            label={t('catalog.supplier')}
            value={preferredSupplierName || t('mobile.purchasing.pickSupplierHint')}
            icon="business-outline"
            onPress={() => setSupplierOpen(true)}
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
          loading={loading || photoBusy || translating}
          disabled={loading || photoBusy || translating || !costOk}
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
        saving={measureEditor.saving}
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
      <PurchasingSupplierSheet
        overlay
        allowNone={false}
        open={supplierOpen}
        onClose={() => setSupplierOpen(false)}
        suppliers={supplierOptions}
        selectedId={preferredSupplierId || null}
        openOrdersBySupplier={new Map()}
        onConfirm={(s) => {
          setPreferredSupplierId(s?.id ?? '');
          setPreferredSupplierName(s?.name ?? '');
        }}
      />
    </>
  );
}
