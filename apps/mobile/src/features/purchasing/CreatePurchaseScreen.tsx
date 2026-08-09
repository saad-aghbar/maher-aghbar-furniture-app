import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { can } from '@maher/permissions';
import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { EmptyState } from '@/components/feedback/EmptyState';
import { useToast } from '@/components/feedback/Toast';
import { TextField } from '@/components/forms/TextField';
import { AppScreen } from '@/components/layout/AppScreen';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { SurfaceCard } from '@/components/surfaces/SurfaceCard';
import { listInventoryItems, type InventoryItem } from '@/api/modules/inventory';
import { listWarehouses, type Warehouse } from '@/api/modules/inventory';
import { useLocale } from '@/i18n';
import { haptics } from '@/motion';
import { useTheme } from '@/theme';
import { SURFACE_TAB_BAR_CLEARANCE } from '@/navigation/tabBarClearance';
import { useQuery } from '@tanstack/react-query';
import { useCreatePurchaseMutation, useSuppliersQuery } from './query';
import {
  grandTotal,
  lineTotal,
  type DraftMaterialLine,
} from './selectPurchase';

export function CreatePurchaseScreen() {
  const { user } = useAuth();
  const { t, locale } = useLocale();
  const { colors, theme } = useTheme();
  const { showToast } = useToast();
  const router = useRouter();
  const allowed = can(user, 'purchase-order.create');

  const [supplierId, setSupplierId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [expectedDate, setExpectedDate] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<DraftMaterialLine[]>([]);
  const [supplierOpen, setSupplierOpen] = useState(false);
  const [materialOpen, setMaterialOpen] = useState(false);
  const [materialQ, setMaterialQ] = useState('');

  const suppliersQuery = useSuppliersQuery(allowed);
  const warehousesQuery = useQuery({
    queryKey: ['warehouses-for-po'],
    queryFn: listWarehouses,
    enabled: allowed,
  });
  const materialsQuery = useQuery({
    queryKey: ['materials-for-po', materialQ],
    queryFn: () => listInventoryItems({ page: 1, pageSize: 30, q: materialQ || undefined }),
    enabled: allowed && materialOpen,
  });
  const createMutation = useCreatePurchaseMutation();

  const totals = useMemo(() => grandTotal(lines), [lines]);
  const suppliers = suppliersQuery.data?.data ?? [];
  const warehouses: Warehouse[] = warehousesQuery.data ?? [];
  const selectedSupplier = suppliers.find((s) => s.id === supplierId);

  function addMaterial(item: InventoryItem) {
    const name =
      locale === 'ar' ? item.nameAr || item.nameEn : item.nameEn || item.nameAr;
    setLines((prev) => [
      ...prev,
      {
        key: `${item.id}-${Date.now()}`,
        inventoryItemId: item.id,
        description: name,
        unit: item.unit || 'pcs',
        quantity: '1',
        unitCost: item.standardCost != null ? String(item.standardCost) : '0',
      },
    ]);
    setMaterialOpen(false);
  }

  function updateLine(key: string, patch: Partial<DraftMaterialLine>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  function submit() {
    if (!supplierId) {
      showToast({ variant: 'error', message: t('mobile.purchasing.supplierRequired') });
      return;
    }
    if (lines.length === 0) {
      showToast({ variant: 'error', message: t('mobile.purchasing.materialsRequired') });
      return;
    }
    const invalid = lines.some(
      (l) => Number(l.quantity) <= 0 || !Number.isFinite(Number(l.unitCost)),
    );
    if (invalid) {
      showToast({ variant: 'error', message: t('mobile.purchasing.lineInvalid') });
      return;
    }
    createMutation.mutate(
      {
        supplierId,
        warehouseId: warehouseId || undefined,
        notes: notes.trim() || undefined,
        expectedDeliveryDate: /^\d{4}-\d{2}-\d{2}$/.test(expectedDate.trim())
          ? `${expectedDate.trim()}T12:00:00.000Z`
          : undefined,
        lines: lines.map((l) => ({
          inventoryItemId: l.inventoryItemId,
          description: l.description,
          quantity: Number(l.quantity),
          unitPrice: Number(l.unitCost),
          unit: l.unit,
        })),
      },
      {
        onSuccess: (po) => {
          void haptics.confirmMedium();
          showToast({ variant: 'success', message: t('mobile.purchasing.createSuccess') });
          router.replace(`/(app)/(admin)/purchasing/${po.id}` as Href);
        },
        onError: () => {
          void haptics.error();
          showToast({ variant: 'error', message: t('mobile.purchasing.createFailed') });
        },
      },
    );
  }

  if (!allowed) {
    return (
      <AppScreen backFallback={'/(app)/(admin)/(tabs)' as Href}>
        <EmptyState title={t('mobile.noModules')} description={t('mobile.noModulesHint')} />
      </AppScreen>
    );
  }

  return (
    <AppScreen backFallback={'/(app)/(admin)/(tabs)' as Href}>
      <ScrollView contentContainerStyle={{ gap: theme.spacing.md, paddingBottom: theme.spacing['3xl'] + SURFACE_TAB_BAR_CLEARANCE }}>
        <AppText variant="title" weight="semibold">
          {t('mobile.purchasing.newPurchase')}
        </AppText>

        <SecondaryButton
          label={
            selectedSupplier
              ? `${t('mobile.purchasing.supplier')}: ${
                  locale === 'ar'
                    ? selectedSupplier.nameAr || selectedSupplier.name
                    : selectedSupplier.nameEn || selectedSupplier.name
                }`
              : t('mobile.purchasing.pickSupplier')
          }
          onPress={() => setSupplierOpen(true)}
        />

        {warehouses.length > 0 ? (
          <View style={{ gap: theme.spacing.sm }}>
            <AppText variant="label" color="secondary">
              {t('mobile.purchasing.warehouse')}
            </AppText>
            {warehouses.slice(0, 5).map((wh) => {
              const selected = wh.id === warehouseId;
              return (
                <Pressable
                  key={wh.id}
                  onPress={() => setWarehouseId(wh.id)}
                  style={{
                    minHeight: theme.sizes.touch.min,
                    borderWidth: 1,
                    borderColor: selected ? colors.brand : colors.border,
                    backgroundColor: selected ? colors.brandSoft : colors.surface,
                    borderRadius: theme.radius.md,
                    paddingHorizontal: theme.spacing.md,
                    justifyContent: 'center',
                  }}
                >
                  <AppText>
                    {locale === 'ar' ? wh.nameAr || wh.nameEn : wh.nameEn} ({wh.code})
                  </AppText>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        <TextField
          label={t('mobile.purchasing.expectedArrival')}
          value={expectedDate}
          onChangeText={setExpectedDate}
          placeholder="YYYY-MM-DD"
        />
        <TextField
          label={t('mobile.purchasing.notes')}
          value={notes}
          onChangeText={setNotes}
          placeholder={t('mobile.purchasing.notesPlaceholder')}
        />

        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <AppText variant="heading" weight="semibold">
            {t('mobile.purchasing.materialsList')}
          </AppText>
          <SecondaryButton
            label={t('mobile.purchasing.addMaterial')}
            onPress={() => setMaterialOpen(true)}
          />
        </View>

        {lines.map((line) => (
          <SurfaceCard key={line.key}>
            <AppText weight="semibold">{line.description}</AppText>
            <AppText variant="caption" color="secondary">
              {line.unit}
            </AppText>
            <TextField
              label={t('mobile.purchasing.quantity')}
              value={line.quantity}
              onChangeText={(v) => updateLine(line.key, { quantity: v })}
              keyboardType="decimal-pad"
            />
            <TextField
              label={t('mobile.purchasing.unitCost')}
              value={line.unitCost}
              onChangeText={(v) => updateLine(line.key, { unitCost: v })}
              keyboardType="decimal-pad"
            />
            <AppText variant="caption">
              {t('mobile.purchasing.lineTotal')}:{' '}
              {lineTotal(line.quantity, line.unitCost).toFixed(3)}
            </AppText>
            <SecondaryButton
              label={t('mobile.purchasing.removeLine')}
              onPress={() => setLines((prev) => prev.filter((l) => l.key !== line.key))}
            />
          </SurfaceCard>
        ))}

        <SurfaceCard>
          <AppText>
            {t('mobile.purchasing.subtotal')}: {totals.subtotal.toFixed(3)}
          </AppText>
          <AppText>
            {t('mobile.purchasing.tax')}: {totals.tax.toFixed(3)}
          </AppText>
          <AppText weight="semibold">
            {t('mobile.purchasing.grandTotal')}: {totals.total.toFixed(3)}
          </AppText>
        </SurfaceCard>

        <PrimaryButton
          label={t('mobile.purchasing.submit')}
          loading={createMutation.isPending}
          onPress={submit}
        />
      </ScrollView>

      <BottomSheet
        open={supplierOpen}
        onClose={() => setSupplierOpen(false)}
        title={t('mobile.purchasing.pickSupplier')}
        sheetHeight={420}
      >
        <ScrollView style={{ maxHeight: 300 }}>
          <View style={{ gap: theme.spacing.sm }}>
            {suppliers.map((s) => (
              <Pressable
                key={s.id}
                onPress={() => {
                  setSupplierId(s.id);
                  setSupplierOpen(false);
                }}
                style={{
                  minHeight: theme.sizes.touch.min,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: theme.radius.md,
                  paddingHorizontal: theme.spacing.md,
                  justifyContent: 'center',
                }}
              >
                <AppText>
                  {locale === 'ar' ? s.nameAr || s.name : s.nameEn || s.name}
                </AppText>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      </BottomSheet>

      <BottomSheet
        open={materialOpen}
        onClose={() => setMaterialOpen(false)}
        title={t('mobile.purchasing.addMaterial')}
        sheetHeight={480}
      >
        <TextField
          value={materialQ}
          onChangeText={setMaterialQ}
          placeholder={t('mobile.purchasing.searchMaterials')}
          autoCorrect={false}
          returnKeyType="search"
        />
        <ScrollView style={{ maxHeight: 300, marginTop: theme.spacing.md }}>
          <View style={{ gap: theme.spacing.sm }}>
            {(materialsQuery.data?.data ?? []).map((item) => (
              <Pressable
                key={item.id}
                onPress={() => addMaterial(item)}
                style={{
                  minHeight: theme.sizes.touch.min,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: theme.radius.md,
                  paddingHorizontal: theme.spacing.md,
                  justifyContent: 'center',
                }}
              >
                <AppText weight="semibold">
                  {locale === 'ar' ? item.nameAr || item.nameEn : item.nameEn}
                </AppText>
                <AppText variant="caption" color="secondary">
                  {item.sku} · {item.unit}
                </AppText>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      </BottomSheet>
    </AppScreen>
  );
}
