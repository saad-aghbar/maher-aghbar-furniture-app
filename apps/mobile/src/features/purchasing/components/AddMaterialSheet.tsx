import { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, useWindowDimensions, View } from 'react-native';
import type { Warehouse } from '@/api/modules/inventory';
import { AppText } from '@/components/AppText';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { QtyStepperField } from '@/components/forms/QtyStepperField';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { WarehousePickList } from '@/features/inventory/components/WarehousePickList';
import {
  locationsForWarehouse,
  WarehouseBinStrip,
} from '@/features/inventory/components/WarehouseBinBoard';
import { locationPickerLabel, pickDefaultLocationId, pickerViewportHeights } from '@/features/inventory/pickDefaultLocation';
import { useLocale } from '@/i18n';
import { haptics } from '@/motion';
import { useTheme } from '@/theme';
import {
  isFabricCategory,
  makeBuilderLine,
  type BuilderLine,
  type BuilderMaterial,
} from '../orderBuilder';
import type { PurchasingSupplierOption } from '../purchasingFilters';
import { HoldingLocationPickList } from './HoldingLocationPickList';
import { PurchasingFloorBoard } from './PurchasingFloorBoard';
import { SupplierPickList } from './SupplierPickList';

type Step = 'destination' | 'supplier' | 'qty';

type Props = {
  open: boolean;
  material: BuilderMaterial | null;
  warehouses: Warehouse[];
  suppliers: PurchasingSupplierOption[];
  defaultWarehouseId: string;
  existing?: BuilderLine | null;
  onClose: () => void;
  onAdd: (line: BuilderLine) => void;
};

export function AddMaterialSheet({
  open,
  material,
  warehouses,
  suppliers,
  defaultWarehouseId,
  existing,
  onClose,
  onAdd,
}: Props) {
  const { t, locale, formatCurrency } = useLocale();
  const { colors, theme } = useTheme();
  const { height } = useWindowDimensions();
  const pickerHeights = pickerViewportHeights(height);
  const fabric = isFabricCategory(material?.category);
  const [step, setStep] = useState<Step>('destination');
  const [warehouseId, setWarehouseId] = useState(defaultWarehouseId);
  const [warehouseName, setWarehouseName] = useState('');
  const [locationId, setLocationId] = useState('');
  const [locationName, setLocationName] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [quantity, setQuantity] = useState('1');
  const unitCost = String(material?.standardCost ?? 0);
  const hydrateRef = useRef({
    material,
    existing,
    suppliers,
    warehouses,
    defaultWarehouseId,
    locale,
  });
  hydrateRef.current = {
    material,
    existing,
    suppliers,
    warehouses,
    defaultWarehouseId,
    locale,
  };

  const locations = useMemo(
    () =>
      warehouses.flatMap((wh) =>
        (wh.locations ?? []).map((loc) => ({
          ...loc,
          warehouseId: wh.id,
          warehouseName:
            locale === 'ar' ? wh.nameAr || wh.nameEn || wh.code : wh.nameEn || wh.nameAr || wh.code,
        })),
      ),
    [warehouses, locale],
  );

  useEffect(() => {
    if (!open) return;
    const snap = hydrateRef.current;
    const current = snap.material;
    if (!current) return;
    const preferred = snap.existing?.supplierId || current.preferredSupplierId || '';
    const preferredName =
      snap.existing?.supplierName ||
      snap.suppliers.find((s) => s.id === preferred)?.name ||
      '';
    const whId = snap.existing?.warehouseId || snap.defaultWarehouseId;
    const wh = snap.warehouses.find((w) => w.id === whId);
    setStep('destination');
    setWarehouseId(whId);
    setWarehouseName(
      snap.existing?.warehouseName ||
        (snap.locale === 'ar'
          ? wh?.nameAr || wh?.nameEn || wh?.code || ''
          : wh?.nameEn || wh?.nameAr || wh?.code || ''),
    );
    const locId =
      snap.existing?.locationId ||
      pickDefaultLocationId(locationsForWarehouse(wh));
    const loc = (wh?.locations ?? []).find((row) => row.id === locId);
    setLocationId(locId);
    setLocationName(
      snap.existing?.locationName || locationPickerLabel(loc),
    );
    setSupplierId(preferred);
    setSupplierName(preferredName);
    setQuantity(snap.existing?.quantity ?? '1');
  }, [open, material?.id]);

  const destReady = Boolean(warehouseId && locationId);
  const canAdd = destReady && Boolean(supplierId) && Number(quantity) > 0;

  const advance = () => {
    if (step === 'destination') {
      if (!destReady) {
        void haptics.error();
        return;
      }
      setStep('supplier');
      return;
    }
    if (step === 'supplier') {
      if (!supplierId) {
        void haptics.error();
        return;
      }
      setStep('qty');
    }
  };

  const add = () => {
    if (!material || !canAdd) {
      void haptics.error();
      return;
    }
    void haptics.confirmLight();
    onAdd(
      makeBuilderLine(material, {
        warehouseId,
        warehouseName,
        locationId,
        locationName,
        supplierId,
        supplierName,
        quantity,
        unitCost,
      }),
    );
  };

  return (
    <BottomSheet
      open={open && Boolean(material)}
      onClose={onClose}
      title={material?.name ?? t('mobile.purchasing.addMaterial')}
      fitContent
      expandable
      maxHeight={Math.min(Math.round(height * 0.82), 720)}
    >
      <ScrollView
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ gap: theme.spacing.md, paddingBottom: theme.spacing.sm }}
      >
        {step === 'destination' ? (
          <PurchasingFloorBoard
            title={
              fabric
                ? t('mobile.purchasing.pickHoldingLocation')
                : t('mobile.purchasing.pickWarehouse')
            }
          >
            {fabric ? (
              <HoldingLocationPickList
                locations={locations.map((loc) => ({
                  id: loc.id,
                  name: locationPickerLabel(loc) || loc.id,
                  warehouseId: loc.warehouseId,
                }))}
                selectedId={locationId}
                onSelect={(loc) => {
                  const full = locations.find((row) => row.id === loc.id);
                  setLocationId(loc.id);
                  setLocationName(locationPickerLabel(full) || loc.name);
                  setWarehouseId(loc.warehouseId);
                  setWarehouseName(full?.warehouseName ?? '');
                }}
              />
            ) : (
              <>
                <WarehousePickList
                  warehouses={warehouses}
                  selectedId={warehouseId}
                  listHeight={pickerHeights.warehouse}
                  resetToken={`${open}-${material?.id ?? ''}`}
                  onSelect={(id) => {
                    const wh = warehouses.find((w) => w.id === id);
                    setWarehouseId(id);
                    setWarehouseName(
                      locale === 'ar'
                        ? wh?.nameAr || wh?.nameEn || wh?.code || ''
                        : wh?.nameEn || wh?.nameAr || wh?.code || '',
                    );
                    const bins = locationsForWarehouse(wh);
                    const locId = pickDefaultLocationId(bins);
                    setLocationId(locId);
                    const loc = bins.find((row) => row.id === locId);
                    setLocationName(locationPickerLabel(loc));
                  }}
                />
                {warehouseId &&
                locationsForWarehouse(warehouses.find((w) => w.id === warehouseId)).length > 0 ? (
                  <WarehouseBinStrip
                    locations={locationsForWarehouse(warehouses.find((w) => w.id === warehouseId))}
                    selectedId={locationId}
                    listHeight={pickerHeights.bin}
                    onSelect={(id) => {
                      const loc = locationsForWarehouse(
                        warehouses.find((w) => w.id === warehouseId),
                      ).find((row) => row.id === id);
                      setLocationId(id);
                      setLocationName(locationPickerLabel(loc));
                    }}
                  />
                ) : null}
              </>
            )}
          </PurchasingFloorBoard>
        ) : null}

        {step === 'supplier' ? (
          <PurchasingFloorBoard title={t('catalog.supplier')}>
            <SupplierPickList
              suppliers={suppliers}
              selectedId={supplierId}
              onSelect={(supplier) => {
                setSupplierId(supplier.id);
                setSupplierName(supplier.name);
              }}
            />
          </PurchasingFloorBoard>
        ) : null}

        {step === 'qty' ? (
          <PurchasingFloorBoard
            title={t('mobile.purchasing.quantity')}
            contentStyle={{ gap: theme.spacing.lg }}
          >
            <QtyStepperField
              value={quantity}
              onChangeText={setQuantity}
              unit={material?.unit}
              accessibilityLabel={t('mobile.purchasing.quantity')}
            />
            <View
              style={{
                borderRadius: theme.radius.lg,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.surfaceSecondary,
                padding: theme.spacing.md,
                gap: theme.spacing.md,
              }}
            >
              <FactRow
                label={t('mobile.purchasing.unitCost')}
                value={formatCurrency(Number(unitCost) || 0)}
                hint={t('mobile.purchasing.unitCostFromInventory')}
              />
              <FactRow
                label={
                  fabric
                    ? t('mobile.purchasing.holdingPlace')
                    : t('mobile.purchasing.warehouse')
                }
                value={fabric ? locationName || locationId : warehouseName || warehouseId}
              />
              <FactRow label={t('catalog.supplier')} value={supplierName} />
              <FactRow
                label={t('mobile.purchasing.lineTotal')}
                value={formatCurrency((Number(quantity) || 0) * (Number(unitCost) || 0))}
                emphasize
              />
            </View>
          </PurchasingFloorBoard>
        ) : null}
      </ScrollView>

      <View style={{ gap: theme.spacing.sm, paddingTop: theme.spacing.md }}>
        {step === 'qty' ? (
          <PrimaryButton
            label={t('mobile.purchasing.addToOrder')}
            disabled={!canAdd}
            onPress={add}
            style={{ borderRadius: theme.radius.full, minHeight: theme.sizes.touch.min }}
          />
        ) : (
          <PrimaryButton
            label={t('mobile.purchasing.nextStep')}
            onPress={advance}
            style={{ borderRadius: theme.radius.full, minHeight: theme.sizes.touch.min }}
          />
        )}
        <SecondaryButton
          label={step === 'destination' ? t('mobile.purchasing.cancel') : t('common.back')}
          onPress={() => {
            if (step === 'destination') {
              onClose();
              return;
            }
            setStep(step === 'qty' ? 'supplier' : 'destination');
          }}
          style={{ borderRadius: theme.radius.full, minHeight: theme.sizes.touch.min }}
        />
      </View>
    </BottomSheet>
  );
}

function FactRow({
  label,
  value,
  hint,
  emphasize,
}: {
  label: string;
  value: string;
  hint?: string;
  emphasize?: boolean;
}) {
  const { isRTL, locale } = useLocale();
  const { colors } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  return (
    <View style={{ gap: 2 }}>
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 12,
        }}
      >
        <AppText
          variant="caption"
          color="muted"
          style={{ flexShrink: 1, textAlign: isRTL ? 'right' : 'left' }}
        >
          {label}
        </AppText>
        <AppText
          weight={emphasize ? titleWeight : 'medium'}
          dir="ltr"
          style={{
            color: emphasize ? colors.textPrimary : colors.textSecondary,
            textAlign: isRTL ? 'left' : 'right',
          }}
        >
          {value}
        </AppText>
      </View>
      {hint ? (
        <AppText variant="caption" color="muted" style={{ textAlign: isRTL ? 'right' : 'left' }}>
          {hint}
        </AppText>
      ) : null}
    </View>
  );
}
