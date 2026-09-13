import { useEffect, useState } from 'react';
import { useWindowDimensions } from 'react-native';
import { AppText } from '@/components/AppText';
import { QtyStepperField } from '@/components/forms/QtyStepperField';
import { TextField } from '@/components/forms/TextField';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { LocaleNameField } from '@/features/catalog/components/BilingualNameField';
import { useLocale } from '@/i18n';
import { resolveTrilingualIfChanged } from '@/i18n/resolveTrilingualName';
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
import { PurchasingSupplierSheet } from '@/features/purchasing/components/PurchasingSupplierSheet';
import { useSuppliersQuery } from '@/features/purchasing/query';
import { localizedName } from '@maher/i18n';

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
  const { t, locale } = useLocale();
  const { height } = useWindowDimensions();
  const sheetHeight = Math.round(height * 0.78);

  const [materialGroup, setMaterialGroup] =
    useState<InventoryCategoryGroup>('fabric');
  const [name, setName] = useState('');
  const [originalName, setOriginalName] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [nameHe, setNameHe] = useState('');
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
  const [photoDirty, setPhotoDirty] = useState(false);
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
    if (!open || !item) return;
    const group = categoryGroupFromCategory(item.category);
    const shown = localizedName(locale, item, item.name);
    setMaterialGroup(group);
    setName(shown);
    setOriginalName(shown);
    setNameEn(item.nameEn);
    setNameAr(item.nameAr);
    setNameHe(item.nameHe ?? '');
    setUnit(item.unit || 'pcs');
    setMinStock(String(item.minStock ?? 0));
    setReorderQty(item.reorderQty != null && item.reorderQty > 0 ? String(item.reorderQty) : '0');
    setStandardCost(item.standardCost != null ? String(item.standardCost) : '0');
    setPreferredSupplierId(item.preferredSupplierId ?? '');
    setPreferredSupplierName(item.preferredSupplierName ?? '');
    setColor(item.color ?? '');
    setMeasurements(parseInventoryMeasurements(item.customMeasurements));
    setPhotoPreview(item.imageUrl);
    setPhotoRemoteUrl(item.imageUrl);
    setPhotoDirty(false);
    setPhotoBusy(false);
    setError(null);
    setUnitSheet(false);
    setTypeSheet(false);
  }, [open, item, locale]);

  function selectMaterialGroup(next: InventoryCategoryGroup) {
    setMaterialGroup(next);
    setMeasurements((rows) =>
      measurementsHaveValues(rows) ? rows : starterMeasurements(next),
    );
  }

  async function submit() {
    if (!name.trim()) {
      setError(t('catalog.namesRequired'));
      return;
    }
    setError(null);
    setTranslating(true);
    try {
      const names = await resolveTrilingualIfChanged({
        typed: name,
        locale,
        original: originalName,
        existing: { nameEn, nameAr, nameHe },
      });
      const body: UpdateInventoryItemInput = {
        nameEn: names.nameEn,
        nameAr: names.nameAr,
        nameHe: names.nameHe || null,
        unit: unit.trim() || 'pcs',
      category: INVENTORY_CATEGORY_FOR_CREATE[materialGroup],
      materialType: materialGroup,
      minStock: Number(minStock) || 0,
      reorderQty: Number(reorderQty) > 0 ? Number(reorderQty) : null,
      preferredSupplierId: preferredSupplierId || null,
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
    } finally {
      setTranslating(false);
    }
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
          <LocaleNameField value={name} onChange={setName} />
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
            label={t('mobile.inventory.reorderQty')}
            value={reorderQty}
            onChangeText={setReorderQty}
            min={0}
            placeholder="0"
          />
          <AppText variant="caption" color="muted">
            {t('mobile.inventory.reorderQtyHint')}
          </AppText>
          {canEditCost ? (
            <QtyStepperField
              label={t('mobile.inventory.standardCost')}
              value={standardCost}
              onChangeText={setStandardCost}
              min={0}
              placeholder="0"
            />
          ) : null}
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
          disabled={loading || photoBusy || translating || !item}
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
