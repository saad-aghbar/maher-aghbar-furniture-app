import { useEffect, useMemo, useState } from 'react';
import { ScrollView, useWindowDimensions, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { isApiError } from '@/api/errors';
import { toastMessageForError } from '@/api/queryClient';
import { listWarehouses, type Warehouse } from '@/api/modules/inventory';
import { AppText } from '@/components/AppText';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { useToast } from '@/components/feedback/Toast';
import { TextField } from '@/components/forms/TextField';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { WarehousePickList } from '@/features/inventory/components/WarehousePickList';
import {
  MaterialPickerSheet,
  type PickedOrderMaterial,
} from '@/features/sales-orders/components/MaterialPickerSheet';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';
import type { PurchasingSupplierOption } from '../purchasingFilters';
import { useCreatePurchaseRequestMutation, useSuppliersQuery } from '../query';
import { localizedNamed, type DraftMaterialLine } from '../selectPurchase';
import { PurchasingSupplierSheet } from './PurchasingSupplierSheet';

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated: (id: string) => void;
};

export function CreatePurchaseRequestSheet({ open, onClose, onCreated }: Props) {
  const { t, formatCurrency, isRTL, locale } = useLocale();
  const { colors, theme } = useTheme();
  const { showToast } = useToast();
  const { height } = useWindowDimensions();
  const sheetHeight = Math.min(Math.round(height * 0.88), 720);
  const warehouseListHeight = Math.round(height * 0.22);
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  const [reason, setReason] = useState('');
  const [supplierId, setSupplierId] = useState<string | null>(null);
  const [supplierName, setSupplierName] = useState<string | null>(null);
  const [warehouseId, setWarehouseId] = useState<string | null>(null);
  const [lines, setLines] = useState<DraftMaterialLine[]>([]);
  const [supplierPickOpen, setSupplierPickOpen] = useState(false);
  const [materialOpen, setMaterialOpen] = useState(false);

  const suppliersQuery = useSuppliersQuery(open);
  const warehousesQuery = useQuery({
    queryKey: ['warehouses-pr-create'],
    queryFn: listWarehouses,
    enabled: open,
  });
  const createMutation = useCreatePurchaseRequestMutation();

  useEffect(() => {
    if (!open) {
      setReason('');
      setSupplierId(null);
      setSupplierName(null);
      setWarehouseId(null);
      setLines([]);
    }
  }, [open]);

  const warehouses: Warehouse[] = warehousesQuery.data ?? [];
  const supplierOptions: PurchasingSupplierOption[] = useMemo(() => {
    return (suppliersQuery.data?.data ?? []).map((s) => {
      const name = localizedNamed(locale, s);
      return {
        id: s.id,
        name,
        code: s.code,
        searchText: [s.name, s.nameEn, s.nameAr, s.nameHe, s.code].filter(Boolean).join(' '),
      };
    });
  }, [suppliersQuery.data?.data, locale]);

  const dismiss = () => onClose();

  const addMaterial = (picked: PickedOrderMaterial) => {
    const item = picked.item;
    const name =
      locale === 'ar' ? item.nameAr || item.nameEn : item.nameEn || item.nameAr;
    setLines((prev) => [
      ...prev,
      {
        key: `${item.id}-${Date.now()}`,
        inventoryItemId: item.id,
        description: name,
        unit: item.unit || 'pcs',
        quantity: String(picked.qty || 1),
        unitCost: '0',
      },
    ]);
    setMaterialOpen(false);
  };

  const submit = async () => {
    if (!supplierId) {
      showToast({ variant: 'error', message: t('catalog.selectSupplierRequired') });
      return;
    }
    if (lines.length === 0) {
      showToast({ variant: 'error', message: t('mobile.purchasing.materialsRequired') });
      return;
    }
    try {
      const pr = await createMutation.mutateAsync({
        reason: reason.trim() || undefined,
        preferredSupplierId: supplierId,
        warehouseId: warehouseId || undefined,
        lines: lines.map((l) => ({
          description: l.description,
          quantity: Number(l.quantity),
          inventoryItemId: l.inventoryItemId,
          unit: l.unit,
        })),
      });
      void haptics.confirmMedium();
      showToast({ variant: 'success', message: t('catalog.purchaseRequestSubmitted') });
      dismiss();
      onCreated(pr.id);
    } catch (err) {
      void haptics.error();
      showToast({
        variant: 'error',
        message: isApiError(err)
          ? toastMessageForError(err)
          : t('mobile.purchasing.createFailed'),
      });
    }
  };

  return (
    <>
      <BottomSheet
        open={open}
        onClose={dismiss}
        title={t('catalog.newPurchaseRequest')}
        sheetHeight={sheetHeight}
      >
        <View style={{ gap: theme.spacing.md, flex: 1, minHeight: 0 }}>
          <ScrollView
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
            style={{ flex: 1, minHeight: 0 }}
            contentContainerStyle={{ gap: theme.spacing.md, paddingBottom: theme.spacing.sm }}
          >
            <TextField
              label={t('catalog.reason')}
              value={reason}
              onChangeText={setReason}
            />

            <AppText
              variant="caption"
              color="secondary"
              style={{ textAlign: isRTL ? 'right' : 'left' }}
            >
              {`${t('catalog.supplier')} *`}
            </AppText>
            <AnimatedPressable
              variant="button"
              onPress={() => setSupplierPickOpen(true)}
              style={{
                minHeight: theme.sizes.touch.min,
                borderRadius: theme.radius.xl,
                borderWidth: 1,
                borderColor: colors.borderStrong,
                backgroundColor: colors.surfaceSecondary,
                paddingHorizontal: theme.spacing.md,
                justifyContent: 'center',
              }}
            >
              <AppText
                numberOfLines={1}
                color={supplierName ? 'primary' : 'muted'}
                style={{ textAlign: isRTL ? 'right' : 'left' }}
              >
                {supplierName ?? t('mobile.purchasing.searchSuppliers')}
              </AppText>
            </AnimatedPressable>

            <WarehousePickList
              warehouses={warehouses}
              selectedId={warehouseId ?? ''}
              onSelect={(id) => setWarehouseId(id || null)}
              label={t('catalog.warehouses')}
              listHeight={warehouseListHeight}
              resetToken={open}
              allowNone
              noneLabel={t('catalog.noneOption')}
            />

            <View
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <AppText weight={titleWeight}>{t('catalog.materialsList')}</AppText>
              <SecondaryButton
                label={t('catalog.addMaterial')}
                onPress={() => setMaterialOpen(true)}
                style={{ borderRadius: theme.radius.xl }}
              />
            </View>

            {lines.length === 0 ? (
              <View
                style={{
                  borderWidth: 1,
                  borderStyle: 'dashed',
                  borderColor: colors.borderStrong,
                  borderRadius: theme.radius.xl,
                  padding: theme.spacing.lg,
                }}
              >
                <AppText variant="caption" color="muted" style={{ textAlign: 'center' }}>
                  {t('mobile.purchasing.materialsRequired')}
                </AppText>
              </View>
            ) : (
              lines.map((line) => (
                <View
                  key={line.key}
                  style={{
                    borderRadius: theme.radius.lg,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.surfaceSecondary,
                    padding: theme.spacing.md,
                    gap: theme.spacing.sm,
                  }}
                >
                  <AppText weight="semibold" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                    {line.description}
                  </AppText>
                  <TextField
                    label={t('mobile.purchasing.quantity')}
                    value={line.quantity}
                    onChangeText={(v) =>
                      setLines((prev) =>
                        prev.map((l) => (l.key === line.key ? { ...l, quantity: v } : l)),
                      )
                    }
                    keyboardType="decimal-pad"
                  />
                  <AnimatedPressable
                    variant="button"
                    onPress={() => setLines((prev) => prev.filter((l) => l.key !== line.key))}
                  >
                    <AppText variant="caption" color="error" weight="semibold">
                      {t('mobile.purchasing.removeLine')}
                    </AppText>
                  </AnimatedPressable>
                </View>
              ))
            )}

            <View
              style={{
                borderRadius: theme.radius.xl,
                backgroundColor: colors.surfaceSecondary,
                padding: theme.spacing.md,
              }}
            >
              <AppText variant="caption" color="muted">
                {t('catalog.materialCount')}
              </AppText>
              <AppText variant="title" weight={titleWeight} dir="ltr">
                {String(lines.length)}
              </AppText>
            </View>
          </ScrollView>

          <View style={{ gap: theme.spacing.sm, paddingTop: theme.spacing.xs }}>
            <PrimaryButton
              label={t('common.submit')}
              loading={createMutation.isPending}
              onPress={() => void submit()}
              style={{ borderRadius: theme.radius.xl }}
            />
            <SecondaryButton
              label={t('common.cancel')}
              onPress={dismiss}
              style={{ borderRadius: theme.radius.xl }}
            />
          </View>
        </View>
      </BottomSheet>

      <PurchasingSupplierSheet
        open={supplierPickOpen}
        onClose={() => setSupplierPickOpen(false)}
        suppliers={supplierOptions}
        selectedId={supplierId}
        overlay
        onConfirm={(s) => {
          setSupplierId(s?.id ?? null);
          setSupplierName(s?.name ?? null);
        }}
      />
      <MaterialPickerSheet
        open={materialOpen}
        onClose={() => setMaterialOpen(false)}
        onPick={addMaterial}
        formatCurrency={formatCurrency}
        overlay
      />
    </>
  );
}
