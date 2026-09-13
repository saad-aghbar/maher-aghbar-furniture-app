import { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { can } from '@maher/permissions';
import { localizedName } from '@maher/i18n';
import { isApiError } from '@/api/errors';
import { toastMessageForError } from '@/api/queryClient';
import {
  getInventoryItem,
  listInventoryGroups,
  listInventoryItems,
  listWarehouses,
  type InventoryCategoryGroup,
} from '@/api/modules/inventory';
import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { DatePickerField } from '@/components/calendar/DatePickerField';
import { EmptyState } from '@/components/feedback/EmptyState';
import { useToast } from '@/components/feedback/Toast';
import { AppTextInput } from '@/components/forms/AppTextInput';
import { SearchBarShell } from '@/components/forms/SearchBarShell';
import { TextField } from '@/components/forms/TextField';
import { AppScreen } from '@/components/layout/AppScreen';
import { Divider } from '@/components/layout/Divider';
import { FloatingActionDock } from '@/components/layout/FloatingActionDock';
import { stickyCtaBottomInset } from '@/components/layout/stickyCtaInset';
import { useCodeScanner } from '@/components/scan/CodeScannerProvider';
import { DealerEmptyPanel } from '@/features/dealers/components/DealerEmptyPanel';
import { resolveInventoryScan } from '@/features/inventory/resolveInventoryScan';
import { purchasingScanMissKey } from '@/features/inventory/selectScanPresentation';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics, ListItemEnter } from '@/motion';
import { SURFACE_TAB_BAR_CLEARANCE } from '@/navigation/tabBarClearance';
import { resolveAppFontStyle, useTheme } from '@/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AddMaterialSheet } from './components/AddMaterialSheet';
import { MaterialBrowseCard } from './components/MaterialBrowseCard';
import { PurchasingFloorBoard } from './components/PurchasingFloorBoard';
import { PurchasingSkeleton } from './components/PurchasingSkeleton';
import { SupplierGroupBoard } from './components/SupplierGroupBoard';
import { PURCHASING_CHROME_CONTROL_H, PURCHASING_CHROME_GAP } from './components/PurchasingFilterTriggers';
import {
  buildRunPayload,
  builderTotals,
  categoryGroupForItem,
  groupBuilderLinesBySupplier,
  parseBuilderSeedIds,
  seedBuilderLines,
  toBuilderMaterial,
  upsertBuilderLine,
  validateBuilderOrder,
  type BuilderLine,
  type BuilderMaterial,
} from './orderBuilder';
import { useCreatePurchaseRunMutation, useSuppliersQuery } from './query';

const CATEGORIES: InventoryCategoryGroup[] = ['fabric', 'foam', 'wood', 'accessories'];
const SECTION_MAX = 360;

export function PurchaseOrderBuilderScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const { t, locale, isRTL, formatCurrency } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();
  const { openScanner } = useCodeScanner();
  const canCreate = can(user, 'purchase-order.create');
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const backFallback = '/(app)/(admin)/purchasing' as Href;
  const params = useLocalSearchParams<{ itemId?: string | string[]; itemIds?: string | string[] }>();
  const seedKey = [params.itemIds, params.itemId].flat().filter(Boolean).join(',');
  const seedIds = useMemo(
    () => parseBuilderSeedIds({ itemIds: params.itemIds, itemId: params.itemId }),
    [seedKey, params.itemId, params.itemIds],
  );
  const seededRef = useRef(false);

  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [openSections, setOpenSections] = useState<Record<InventoryCategoryGroup, boolean>>({
    fabric: true,
    foam: false,
    wood: false,
    accessories: false,
  });
  const [lines, setLines] = useState<Record<string, BuilderLine>>({});
  const [expectedDate, setExpectedDate] = useState('');
  const [notes, setNotes] = useState('');
  const [adding, setAdding] = useState<BuilderMaterial | null>(null);

  useEffect(() => {
    const id = setTimeout(() => setQ(search.trim()), 250);
    return () => clearTimeout(id);
  }, [search]);

  const suppliersQuery = useSuppliersQuery(canCreate, { status: 'ACTIVE' });
  const warehousesQuery = useQuery({
    queryKey: ['warehouses-po-builder'],
    queryFn: listWarehouses,
    enabled: canCreate,
  });
  const groupsQuery = useQuery({
    queryKey: ['inventory-groups-po-builder'],
    queryFn: listInventoryGroups,
    enabled: canCreate,
  });
  const itemsQuery = useQuery({
    queryKey: ['inventory-items-po-builder', q],
    queryFn: () =>
      listInventoryItems({
        page: 1,
        pageSize: 200,
        q: q || undefined,
        isPurchasable: 'true',
      }),
    enabled: canCreate,
  });
  const seedQuery = useQuery({
    queryKey: ['inventory-items-po-builder-seed', seedIds],
    queryFn: async () => {
      const rows = await Promise.all(
        seedIds.map((id) => getInventoryItem(id).catch(() => null)),
      );
      return rows.filter((item): item is NonNullable<typeof item> => item != null);
    },
    enabled: canCreate && seedIds.length > 0,
  });
  const create = useCreatePurchaseRunMutation();

  const rawWarehouses = useMemo(
    () => (warehousesQuery.data ?? []).filter((w) => !w.type || w.type === 'RAW_MATERIALS'),
    [warehousesQuery.data],
  );
  const defaultWarehouse = rawWarehouses.find((w) => w.isDefault) ?? rawWarehouses[0];
  const defaultWarehouseId = defaultWarehouse?.id ?? '';
  const defaultWarehouseName = defaultWarehouse
    ? locale === 'ar'
      ? defaultWarehouse.nameAr || defaultWarehouse.nameEn || defaultWarehouse.code || ''
      : defaultWarehouse.nameEn || defaultWarehouse.nameAr || defaultWarehouse.code || ''
    : '';

  const supplierOptions = useMemo(
    () =>
      (suppliersQuery.data?.data ?? []).map((s) => ({
        id: s.id,
        name: localizedName(
          locale,
          { name: s.name, nameEn: s.nameEn, nameAr: s.nameAr, nameHe: s.nameHe },
          s.code,
        ),
        code: s.code,
        searchText: [s.name, s.nameEn, s.nameAr, s.nameHe, s.code].filter(Boolean).join(' '),
      })),
    [suppliersQuery.data?.data, locale],
  );

  const materials: BuilderMaterial[] = useMemo(() => {
    return (itemsQuery.data?.data ?? []).map((item) => toBuilderMaterial(item, locale));
  }, [itemsQuery.data?.data, locale]);

  const seedMaterials: BuilderMaterial[] = useMemo(() => {
    return (seedQuery.data ?? []).map((item) => toBuilderMaterial(item, locale));
  }, [seedQuery.data, locale]);

  const bySection = useMemo(() => {
    const map: Record<InventoryCategoryGroup, BuilderMaterial[]> = {
      fabric: [],
      foam: [],
      wood: [],
      accessories: [],
    };
    for (const material of materials) {
      map[categoryGroupForItem(material.category)].push(material);
    }
    return map;
  }, [materials]);

  const selected = Object.values(lines);
  const totals = builderTotals(selected);
  const supplierGroups = groupBuilderLinesBySupplier(selected);
  const groups = groupsQuery.data ?? CATEGORIES.map((categoryGroup) => ({
    categoryGroup,
    materialCount: 0,
    lowStockCount: 0,
    totalOnHand: 0,
    primaryUnit: null,
  }));
  const dockPad = stickyCtaBottomInset(insets.bottom, theme.spacing.md, SURFACE_TAB_BAR_CLEARANCE) + 72;

  useEffect(() => {
    if (seededRef.current) return;
    if (seedIds.length === 0) return;
    if (!warehousesQuery.isFetched || !suppliersQuery.isFetched) return;
    if (!seedQuery.isFetched) return;
    seededRef.current = true;
    if (seedMaterials.length === 0) return;
    const supplierNameById = Object.fromEntries(supplierOptions.map((s) => [s.id, s.name]));
    setLines((prev) =>
      seedBuilderLines(prev, seedMaterials, {
        defaultWarehouseId,
        defaultWarehouseName,
        supplierNameById,
      }),
    );
    setOpenSections((prev) => {
      const next = { ...prev };
      for (const material of seedMaterials) {
        next[categoryGroupForItem(material.category)] = true;
      }
      return next;
    });
    if (seedMaterials.length === 1) {
      setAdding(seedMaterials[0]!);
      return;
    }
    showToast({
      variant: 'success',
      message: t('mobile.purchasing.builderSeedAdded', {
        count: String(seedMaterials.length),
      }),
    });
  }, [
    defaultWarehouseId,
    defaultWarehouseName,
    seedIds.length,
    seedMaterials,
    seedQuery.isFetched,
    showToast,
    supplierOptions,
    suppliersQuery.isFetched,
    t,
    warehousesQuery.isFetched,
  ]);

  const openMaterial = (material: BuilderMaterial) => {
    setAdding(material);
  };

  const openLine = (line: BuilderLine) => {
    const material =
      materials.find((item) => item.id === line.inventoryItemId) ??
      seedMaterials.find((item) => item.id === line.inventoryItemId);
    openMaterial(
      material ?? {
        id: line.inventoryItemId,
        sku: line.sku,
        name: line.description,
        unit: line.unit,
        category: line.category,
        imageUrl: line.imageUrl,
        standardCost: Number(line.unitCost) || 0,
        preferredSupplierId: line.supplierId || null,
      },
    );
  };

  const scanMaterial = async () => {
    void haptics.selection();
    const code = await openScanner({
      title: t('mobile.purchasing.scanMaterial'),
      hint: t('mobile.inventory.scanBarcodeHint'),
    });
    if (!code) return;
    try {
      const resolved = await resolveInventoryScan(code);
      if (resolved.status !== 'FOUND') {
        void haptics.error();
        const missKey = purchasingScanMissKey(resolved);
        showToast({
          variant: 'error',
          message: missKey
            ? t(`mobile.inventory.${missKey}`)
            : t('mobile.purchasing.scanMaterialMiss'),
        });
        return;
      }
      openMaterial(toBuilderMaterial(resolved.item, locale));
    } catch {
      void haptics.error();
      showToast({ variant: 'error', message: t('mobile.purchasing.scanMaterialMiss') });
    }
  };

  const submit = () => {
    const code = validateBuilderOrder({ lines: selected });
    if (code) {
      void haptics.error();
      const message =
        code === 'supplierRequired'
          ? t('mobile.purchasing.supplierRequired')
          : code === 'holdingRequired'
            ? t('mobile.purchasing.holdingRequired')
            : code === 'warehouseRequired'
              ? t('mobile.purchasing.warehouseRequired')
              : code === 'zeroQty'
                ? t('mobile.purchasing.zeroQtyLine')
                : t('mobile.purchasing.materialsRequired');
      showToast({ variant: 'error', message });
      return;
    }
    create.mutate(buildRunPayload({ expectedDeliveryDate: expectedDate, notes, origin: 'MANUAL', lines: selected }), {
      onSuccess: (run) => {
        void haptics.confirmMedium();
        showToast({ variant: 'success', message: t('mobile.purchasing.createSuccess') });
        router.replace(`/(app)/(admin)/purchasing/runs/${run.id}` as Href);
      },
      onError: (err) => {
        void haptics.error();
        showToast({
          variant: 'error',
          message: isApiError(err) ? toastMessageForError(err) : t('mobile.purchasing.createFailed'),
        });
      },
    });
  };

  if (!canCreate) {
    return (
      <AppScreen backFallback={backFallback}>
        <EmptyState title={t('mobile.noModules')} description={t('mobile.noModulesHint')} />
      </AppScreen>
    );
  }

  return (
    <AppScreen backFallback={backFallback}>
      <ScrollView contentContainerStyle={{ gap: theme.spacing.md, paddingBottom: dockPad }}>
        <AppText variant="largeTitle" weight={titleWeight} align="center">
          {t('mobile.purchasing.builderTitle')}
        </AppText>

        <ListItemEnter index={0}>
          <PurchasingFloorBoard title={t('mobile.purchasing.browseMaterials')}>
            <View
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                gap: PURCHASING_CHROME_GAP,
                alignItems: 'center',
              }}
            >
              <SearchBarShell style={{ flex: 1, minHeight: PURCHASING_CHROME_CONTROL_H }}>
                <AppTextInput
                  value={search}
                  onChangeText={setSearch}
                  placeholder={t('mobile.purchasing.searchMaterials')}
                  placeholderTextColor={colors.textMuted}
                  autoCorrect={false}
                  autoCapitalize="none"
                  returnKeyType="search"
                  clearButtonMode="while-editing"
                  accessibilityLabel={t('mobile.purchasing.searchMaterials')}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    paddingVertical: theme.spacing.sm,
                    fontSize: 16,
                    color: colors.textPrimary,
                    textAlign: isRTL ? 'right' : 'left',
                    ...resolveAppFontStyle(locale, { variant: 'body' }),
                  }}
                />
              </SearchBarShell>
              <AnimatedPressable
                variant="button"
                accessibilityRole="button"
                accessibilityLabel={t('mobile.purchasing.scanMaterial')}
                onPress={() => void scanMaterial()}
                style={{
                  width: PURCHASING_CHROME_CONTROL_H,
                  height: PURCHASING_CHROME_CONTROL_H,
                  borderRadius: theme.radius.xl,
                  borderWidth: 1.5,
                  borderColor: colors.borderStrong,
                  backgroundColor: colors.surfaceSecondary,
                  alignItems: 'center',
                  justifyContent: 'center',
                  ...orderBoardShadow(colorScheme),
                }}
              >
                <View
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: colors.surface,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <Ionicons name="barcode-outline" size={15} color={colors.brand} />
                </View>
              </AnimatedPressable>
            </View>
          </PurchasingFloorBoard>
        </ListItemEnter>

        {CATEGORIES.map((category, index) => {
          const summary = groups.find((g) => g.categoryGroup === category);
          const rows = bySection[category];
          const expanded = openSections[category];
          const count = summary?.materialCount ?? rows.length;
          return (
            <ListItemEnter key={category} index={index + 1}>
              <View style={{ gap: theme.spacing.sm }}>
                <PurchasingFloorBoard
                  title={t(`mobile.inventory.groups.${category}`)}
                  headerAccent={expanded}
                  hideBody={!expanded}
                  onHeaderPress={() =>
                    setOpenSections((prev) => ({ ...prev, [category]: !prev[category] }))
                  }
                  trailing={
                    <View
                      style={{
                        flexDirection: isRTL ? 'row-reverse' : 'row',
                        alignItems: 'center',
                        gap: theme.spacing.sm,
                      }}
                    >
                      <View
                        style={{
                          minWidth: 28,
                          minHeight: 24,
                          paddingHorizontal: theme.spacing.sm,
                          borderRadius: theme.radius.full,
                          backgroundColor: expanded ? colors.surface : colors.brandSoft,
                          borderWidth: 1,
                          borderColor: expanded ? colors.brand : colors.border,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <AppText
                          variant="caption"
                          dir="ltr"
                          style={{ color: expanded ? colors.brand : colors.textSecondary }}
                        >
                          {String(count)}
                        </AppText>
                      </View>
                      <Ionicons
                        name={
                          expanded ? 'chevron-up' : isRTL ? 'chevron-back' : 'chevron-forward'
                        }
                        size={16}
                        color={expanded ? colors.brand : colors.textMuted}
                      />
                    </View>
                  }
                />
                {expanded ? (
                  <ScrollView
                    nestedScrollEnabled
                    style={{ maxHeight: SECTION_MAX }}
                    contentContainerStyle={{ gap: theme.spacing.sm }}
                  >
                    {itemsQuery.isLoading ? <PurchasingSkeleton count={3} /> : null}
                    {rows.map((material) => (
                      <MaterialBrowseCard
                        key={material.id}
                        material={material}
                        selected={Boolean(lines[material.id])}
                        onPress={() => openMaterial(material)}
                      />
                    ))}
                    {!itemsQuery.isLoading && rows.length === 0 ? (
                      <DealerEmptyPanel
                        compact
                        icon="cube-outline"
                        text={t('mobile.purchasing.sectionEmpty')}
                      />
                    ) : null}
                  </ScrollView>
                ) : null}
              </View>
            </ListItemEnter>
          );
        })}

        {supplierGroups.map((group, index) => (
          <ListItemEnter key={group.supplierId || `unassigned-${index}`} index={index + 6}>
            <SupplierGroupBoard
              supplierName={group.supplierName}
              lines={group.lines}
              subtotal={group.totals.subtotal}
              onLinePress={openLine}
            />
          </ListItemEnter>
        ))}

        {selected.length > 0 ? (
          <ListItemEnter index={12}>
            <PurchasingFloorBoard title={t('mobile.purchasing.totalsTitle')}>
              <View
                style={{
                  borderRadius: theme.radius.lg,
                  backgroundColor: colors.surfaceSecondary,
                  borderWidth: 1,
                  borderColor: colors.border,
                  overflow: 'hidden',
                }}
              >
                <MoneyRow label={t('mobile.purchasing.subtotal')} value={formatCurrency(totals.subtotal)} />
                <Divider compact plain />
                <MoneyRow label={t('mobile.purchasing.tax')} value={formatCurrency(totals.tax)} />
                <Divider compact plain />
                <MoneyRow
                  label={t('mobile.purchasing.grandTotal')}
                  value={formatCurrency(totals.total)}
                  emphasize
                />
              </View>
            </PurchasingFloorBoard>
          </ListItemEnter>
        ) : null}

        <ListItemEnter index={13}>
          <PurchasingFloorBoard title={t('mobile.purchasing.expectedDate')}>
            <DatePickerField
              label={t('mobile.purchasing.expectedArrival')}
              value={expectedDate}
              onChange={setExpectedDate}
            />
            <TextField
              label={t('mobile.purchasing.notes')}
              value={notes}
              onChangeText={setNotes}
              multiline
            />
          </PurchasingFloorBoard>
        </ListItemEnter>
      </ScrollView>

      <FloatingActionDock floating>
        <PrimaryButton
          label={t('mobile.purchasing.submitDraft')}
          loading={create.isPending}
          disabled={create.isPending}
          onPress={submit}
          style={{
            borderRadius: theme.radius.full,
            minHeight: theme.sizes.touch.min,
            ...orderBoardShadow(colorScheme),
          }}
        />
      </FloatingActionDock>

      <AddMaterialSheet
        open={Boolean(adding)}
        material={adding}
        warehouses={rawWarehouses}
        suppliers={supplierOptions}
        defaultWarehouseId={defaultWarehouseId}
        existing={adding ? lines[adding.id] : null}
        onClose={() => setAdding(null)}
        onAdd={(line) => {
          setLines((prev) => upsertBuilderLine(prev, line));
          setAdding(null);
        }}
      />
    </AppScreen>
  );
}

function MoneyRow({
  label,
  value,
  emphasize,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  const { isRTL, locale } = useLocale();
  const { colors, theme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  return (
    <View
      style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: theme.spacing.md,
        paddingHorizontal: theme.spacing.md,
        paddingVertical: theme.spacing.sm + 2,
      }}
    >
      <AppText
        variant="caption"
        color="muted"
        style={{
          flexShrink: 0,
          fontSize: 10,
          textTransform: locale === 'ar' ? 'none' : 'uppercase',
          letterSpacing: locale === 'ar' ? 0 : 0.45,
          textAlign: isRTL ? 'right' : 'left',
        }}
      >
        {label}
      </AppText>
      <AppText
        weight={emphasize ? titleWeight : 'medium'}
        dir="ltr"
        style={{
          flex: 1,
          minWidth: 0,
          color: colors.textPrimary,
          fontSize: emphasize ? 16 : 13,
          textAlign: isRTL ? 'left' : 'right',
        }}
      >
        {value}
      </AppText>
    </View>
  );
}
