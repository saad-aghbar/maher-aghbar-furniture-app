import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter, type Href } from 'expo-router';
import { localizedName } from '@maher/i18n';
import { can } from '@maher/permissions';
import { renderVariantSpecLine } from '@maher/types';
import {
  activateProductVariant,
  copyVariantFromStandard,
  deactivateProductVariant,
  deleteDealerPrice,
  duplicateProductVariant,
  getProductVariant,
  getVariantCost,
  listProductDealerPrices,
  patchProductVariant,
  upsertDealerPrice,
  type AdminBomLine,
  type AdminProductVariant,
  type ProductDealerPrice,
} from '@/api/modules/catalogAdmin';
import { listSpecOptionGroups, listSpecOptionValues } from '@/api/modules/catalog';
import { listCustomers } from '@/api/modules/customers';
import { getProductProductionSetup } from '@/api/modules/workflow';
import { useWorkflowsQuery } from '@/features/workflow/query';
import { formatMinutesDuration } from '@/features/tasks/formatDuration';
import { isApiError } from '@/api/errors';
import { queryKeys } from '@/api/queryKeys';
import { toastMessageForError } from '@/api/queryClient';
import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { BackButton } from '@/components/BackButton';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { ErrorState } from '@/components/feedback/ErrorState';
import { useToast } from '@/components/feedback/Toast';
import { TextField } from '@/components/forms/TextField';
import { AppScreen } from '@/components/layout/AppScreen';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics, ListItemEnter } from '@/motion';
import { surfaceTabBarStackInset } from '@/navigation/tabBarClearance';
import { useTheme } from '@/theme';
import { BilingualNameField } from './components/BilingualNameField';
import { BomFloorRow } from './components/BomFloorRow';
import { BomMaterialPickerSheet } from './components/BomMaterialPickerSheet';
import {
  CappedNestedScroll,
  CatalogFloorEmpty,
  CatalogFloorListHeader,
  FLOOR_ROW_ESTIMATE,
} from './components/CatalogFloorList';
import { CatalogSectionBoard } from './components/CatalogSectionBoard';
import { VariantOptionGroupsBoard } from './components/VariantOptionGroupsBoard';
import { MeasurementFloorRow, displayMeasurementUnit } from './components/MeasurementFloorRow';
import { MeasurementValuePanel } from './components/MeasurementValueSheet';
import { SellerPriceFloorRow } from './components/SellerPriceFloorRow';
import { selectActiveSpecOptionGroups } from './selectSpecOptions';

/** Per-customer: variant price overrides product-level. */
function mergeVariantDealerPrices(
  rows: ProductDealerPrice[],
  variantId: string,
): ProductDealerPrice[] {
  const byCustomer = new Map<string, ProductDealerPrice>();
  for (const row of rows) {
    if (row.variantId == null) byCustomer.set(row.customerId, row);
  }
  for (const row of rows) {
    if (row.variantId === variantId) byCustomer.set(row.customerId, row);
  }
  return [...byCustomer.values()];
}

type Draft = {
  sku: string;
  nameAr: string;
  nameEn: string;
  nameHe: string;
  basePrice: string;
  adminNotes: string;
  measurements: Array<{
    key: string;
    labelAr: string;
    labelEn: string;
    value: string;
    unit: string;
  }>;
  selectedByGroup: Record<string, string | null>;
  factoryNotesAr: string;
  factoryNotesEn: string;
  factoryNotesHe: string;
  bomLines: AdminBomLine[];
};

function bomLinesFromDefaults(bom: unknown): AdminBomLine[] {
  if (!bom || typeof bom !== 'object') return [];
  const materials = (bom as { materials?: Array<Record<string, unknown>> }).materials ?? [];
  return materials
    .filter((row) => String(row.sku ?? '').trim())
    .map((row) => {
      const sku = String(row.sku);
      const qty = Number(row.qty) || 0;
      const unitCost = Number(row.unitCost) || 0;
      return {
        sku,
        qty,
        unitCost,
        lineCost: qty * unitCost,
        nameEn: String(row.nameEn ?? sku),
        nameAr: String(row.nameAr ?? sku),
        category: row.category != null ? String(row.category) : null,
      };
    });
}

function toDraft(v: AdminProductVariant): Draft {
  const selectedByGroup: Record<string, string | null> = {};
  for (const opt of v.options ?? []) {
    const groupId = opt.specOptionValue?.groupId;
    if (groupId) selectedByGroup[groupId] = opt.specOptionValueId;
  }

  const measurements = v.measurements ?? [];

  return {
    sku: v.sku,
    nameAr: v.nameAr,
    nameEn: v.nameEn,
    nameHe: v.nameHe ?? '',
    basePrice: v.basePrice != null ? String(v.basePrice) : '',
    adminNotes: v.adminNotes ?? '',
    measurements: measurements.map((m, i) => ({
      key: m.key || `m-${i}`,
      labelAr: m.labelAr ?? '',
      labelEn: m.labelEn ?? '',
      value: m.value == null ? '' : String(m.value),
      unit: m.unit || 'cm',
    })),
    selectedByGroup,
    factoryNotesAr: v.factoryNotesAr ?? '',
    factoryNotesEn: v.factoryNotesEn ?? '',
    factoryNotesHe: v.factoryNotesHe ?? '',
    bomLines: bomLinesFromDefaults(v.bomDefaults),
  };
}

type Props = { productId: string; variantId: string };

export function AdminVariantDetailScreen({ productId, variantId }: Props) {
  const { user } = useAuth();
  const { t, locale, formatCurrency, isRTL } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const { showToast } = useToast();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const canPrice = can(user, 'customer.update');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [measureSheet, setMeasureSheet] = useState(false);
  const [measureValueSheet, setMeasureValueSheet] = useState(false);
  const [editingMeasureIndex, setEditingMeasureIndex] = useState<number | null>(null);
  const [newMeasure, setNewMeasure] = useState({ labelAr: '', labelEn: '', value: '', unit: 'cm' });
  const [materialSheet, setMaterialSheet] = useState(false);
  const [sellerSheet, setSellerSheet] = useState(false);
  const [sellerEditing, setSellerEditing] = useState(false);
  const [sellerCustomerLabel, setSellerCustomerLabel] = useState('');
  const [sellerCustomerId, setSellerCustomerId] = useState<string | null>(null);
  const [sellerPrice, setSellerPrice] = useState('');
  const [sellerQ, setSellerQ] = useState('');

  const variantQuery = useQuery({
    queryKey: queryKeys.catalog.variant(productId, variantId),
    queryFn: () => getProductVariant(productId, variantId),
  });
  const groupsQuery = useQuery({
    queryKey: queryKeys.catalog.specOptionGroups({}),
    queryFn: () => listSpecOptionGroups({ page: 1, pageSize: 50 }),
  });
  const valuesQuery = useQuery({
    queryKey: queryKeys.catalog.specOptionValues({}),
    queryFn: () => listSpecOptionValues({ page: 1, pageSize: 200 }),
  });
  const setupQuery = useQuery({
    queryKey: queryKeys.workflow.productionSetup(productId, variantId),
    queryFn: () => getProductProductionSetup(productId, variantId),
  });
  const workflowsQuery = useWorkflowsQuery(true);
  const costQuery = useQuery({
    queryKey: [...queryKeys.catalog.variant(productId, variantId), 'cost'],
    queryFn: () => getVariantCost(productId, variantId),
  });
  const pricesQuery = useQuery({
    queryKey: queryKeys.catalog.dealerPrices(productId, variantId),
    queryFn: () => listProductDealerPrices(productId, variantId),
  });
  const customersQuery = useQuery({
    queryKey: ['customers', 'seller-pick', sellerQ],
    queryFn: () => listCustomers({ page: 1, pageSize: 30, q: sellerQ || undefined }),
    enabled: sellerSheet && canPrice && !sellerEditing,
  });

  useEffect(() => {
    if (!variantQuery.data) return;
    setDraft(toDraft(variantQuery.data));
  }, [variantQuery.data]);

  const specLine = useMemo(() => {
    if (!draft) return '';
    return renderVariantSpecLine(
      {
        nameAr: draft.nameAr,
        nameEn: draft.nameEn,
        nameHe: draft.nameHe,
        measurements: draft.measurements.map((m) => ({
          key: m.key,
          labelAr: m.labelAr,
          labelEn: m.labelEn,
          value: m.value,
          unit: m.unit,
        })),
        options: Object.values(draft.selectedByGroup)
          .filter(Boolean)
          .map((id) => {
            const value = (valuesQuery.data?.data ?? []).find((v) => v.id === id);
            return {
              specOptionValueId: id,
              nameAr: value?.nameAr,
              nameEn: value?.nameEn,
              nameHe: value?.nameHe,
              code: value?.code,
            };
          }),
        factoryNotesAr: draft.factoryNotesAr,
        factoryNotesEn: draft.factoryNotesEn,
        factoryNotesHe: draft.factoryNotesHe,
        composition: [],
        includedItems: [],
      },
      locale,
    );
  }, [draft, locale, valuesQuery.data?.data]);

  const bomRollup = useMemo(() => {
    if (!draft) return 0;
    return draft.bomLines.reduce((sum, line) => sum + (Number(line.qty) || 0) * (Number(line.unitCost) || 0), 0);
  }, [draft]);

  const save = useMutation({
    mutationFn: async () => {
      if (!draft) throw new Error('draft');
      const options = Object.values(draft.selectedByGroup)
        .filter((id): id is string => Boolean(id))
        .map((specOptionValueId) => ({ specOptionValueId }));
      const row = await patchProductVariant(productId, variantId, {
        nameAr: draft.nameAr.trim(),
        nameEn: draft.nameEn.trim() || undefined,
        nameHe: draft.nameHe.trim() || null,
        basePrice: draft.basePrice.trim() ? Number(draft.basePrice) : null,
        adminNotes: draft.adminNotes.trim() || null,
        bomDefaults: {
          materials: draft.bomLines.map((l) => ({
            sku: l.sku,
            qty: l.qty,
            unitCost: l.unitCost,
            category: l.category ?? undefined,
          })),
        },
        measurements: draft.measurements
          .filter((m) => m.labelAr.trim() || m.labelEn.trim())
          .map((m) => ({
            key: m.key,
            labelAr: m.labelAr,
            labelEn: m.labelEn,
            value: m.value === '' ? null : Number(m.value),
            unit: m.unit || 'cm',
          })),
        factoryNotesAr: draft.factoryNotesAr || null,
        factoryNotesEn: draft.factoryNotesEn || null,
        factoryNotesHe: draft.factoryNotesHe || null,
        options,
      });
      return row;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.catalog.variant(productId, variantId) });
      await qc.invalidateQueries({ queryKey: queryKeys.catalog.variants(productId) });
      await qc.invalidateQueries({ queryKey: [...queryKeys.catalog.variant(productId, variantId), 'cost'] });
      showToast({ variant: 'success', message: t('catalog.variantSaved') });
    },
    onError: (err) => {
      showToast({
        variant: 'error',
        message: isApiError(err) ? toastMessageForError(err) : t('errors.REQUEST_FAILED'),
      });
    },
  });

  const copyFromStandard = useMutation({
    mutationFn: () => copyVariantFromStandard(productId, variantId),
    onSuccess: async (row) => {
      setDraft(toDraft(row));
      await qc.invalidateQueries({ queryKey: queryKeys.catalog.variant(productId, variantId) });
      await qc.invalidateQueries({ queryKey: queryKeys.catalog.dealerPrices(productId, variantId) });
      await qc.invalidateQueries({ queryKey: queryKeys.workflow.productionSetup(productId, variantId) });
      await qc.invalidateQueries({ queryKey: [...queryKeys.catalog.variant(productId, variantId), 'cost'] });
      showToast({ variant: 'success', message: t('catalog.copiedFromStandard') });
    },
    onError: (err) => {
      showToast({
        variant: 'error',
        message: isApiError(err) ? toastMessageForError(err) : t('errors.REQUEST_FAILED'),
      });
    },
  });
  const makeStandard = useMutation({
    mutationFn: () => patchProductVariant(productId, variantId, { isDefault: true }),
    onSuccess: async (row) => {
      setDraft(toDraft(row));
      await qc.invalidateQueries({ queryKey: queryKeys.catalog.variant(productId, variantId) });
      await qc.invalidateQueries({ queryKey: queryKeys.catalog.variants(productId) });
      showToast({ variant: 'success', message: t('catalog.madeStandard') });
    },
  });
  const setWorkflow = useMutation({
    mutationFn: (nextId: string) => patchProductVariant(productId, variantId, { workflowId: nextId }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.catalog.variant(productId, variantId) });
      await qc.invalidateQueries({ queryKey: queryKeys.workflow.productionSetup(productId, variantId) });
    },
  });
  const duplicate = useMutation({
    mutationFn: () => duplicateProductVariant(productId, variantId),
    onSuccess: (row) => {
      router.replace(`/(app)/(admin)/products/${productId}/variants/${row.id}` as Href);
    },
  });
  const deactivate = useMutation({
    mutationFn: () => deactivateProductVariant(productId, variantId),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.catalog.variant(productId, variantId) });
    },
  });
  const activate = useMutation({
    mutationFn: () => activateProductVariant(productId, variantId),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.catalog.variant(productId, variantId) });
    },
  });
  const upsertPrice = useMutation({
    mutationFn: () => {
      if (!sellerCustomerId) throw new Error('customer');
      return upsertDealerPrice({
        customerId: sellerCustomerId,
        productId,
        variantId,
        price: Number(sellerPrice),
      });
    },
    onSuccess: async () => {
      setSellerSheet(false);
      setSellerEditing(false);
      setSellerCustomerLabel('');
      setSellerCustomerId(null);
      setSellerPrice('');
      setSellerQ('');
      await qc.invalidateQueries({ queryKey: queryKeys.catalog.dealerPrices(productId, variantId) });
      showToast({ variant: 'success', message: t('catalog.sellerPriceSaved') });
    },
  });
  const deletePrice = useMutation({
    mutationFn: (row: { customerId: string; id: string }) =>
      deleteDealerPrice(row.customerId, row.id),
    onSuccess: async () => {
      void haptics.selection();
      await qc.invalidateQueries({ queryKey: queryKeys.catalog.dealerPrices(productId, variantId) });
    },
  });

  const openAddSellerPrice = () => {
    setSellerEditing(false);
    setSellerCustomerLabel('');
    setSellerCustomerId(null);
    setSellerPrice('');
    setSellerQ('');
    setSellerSheet(true);
  };

  const openEditSellerPrice = (row: {
    customerId: string;
    price: number | string;
    name: string;
  }) => {
    setSellerEditing(true);
    setSellerCustomerLabel(row.name);
    setSellerCustomerId(row.customerId);
    setSellerPrice(String(row.price));
    setSellerQ('');
    setSellerSheet(true);
  };

  const variant = variantQuery.data;
  const activeSpecGroups = selectActiveSpecOptionGroups(groupsQuery.data?.data ?? []);
  const footerPad = theme.spacing.xl + surfaceTabBarStackInset(insets.bottom, theme.spacing.md);
  const dealerPrices = mergeVariantDealerPrices(pricesQuery.data ?? [], variantId);
  const totalMinutes = (setupQuery.data?.stages ?? []).reduce(
    (sum, s) => sum + (Number(s.minutesPerUnit) || 0) + (Number(s.setupMinutes) || 0),
    0,
  );

  const applyMeasurement = (value: string, unit: string) => {
    const next = { ...newMeasure, value, unit };
    if (editingMeasureIndex != null && draft) {
      setDraft({
        ...draft,
        measurements: draft.measurements.map((m, i) =>
          i === editingMeasureIndex ? { ...m, ...next } : m,
        ),
      });
    } else if (draft && next.labelAr.trim()) {
      setDraft({
        ...draft,
        measurements: [
          ...draft.measurements,
          { key: `m-${Date.now()}`, ...next },
        ],
      });
    }
    setNewMeasure({ labelAr: '', labelEn: '', value: '', unit: 'cm' });
    setEditingMeasureIndex(null);
    setMeasureValueSheet(false);
    setMeasureSheet(false);
  };

  if (variantQuery.isError) {
    return (
      <AppScreen>
        <ErrorState
          title={t('errors.REQUEST_FAILED')}
          onRetry={() => void variantQuery.refetch()}
        />
      </AppScreen>
    );
  }

  if (!draft || variantQuery.isLoading) {
    return (
      <AppScreen>
        <ActivityIndicator color={colors.brand} />
      </AppScreen>
    );
  }

  return (
    <AppScreen edges={{ top: true, bottom: false }} style={{ paddingHorizontal: 0 }}>
      <View
        style={{
          paddingHorizontal: theme.spacing.lg,
          paddingBottom: theme.spacing.sm,
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          gap: theme.spacing.sm,
          minHeight: theme.sizes.touch.min,
        }}
      >
        <BackButton label={t('common.back')} onPress={() => router.back()} />
        <AppText variant="title" weight={titleWeight} style={{ flex: 1 }} numberOfLines={1}>
          {draft.nameAr || draft.nameEn}
        </AppText>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: theme.spacing.lg,
          gap: theme.spacing.md,
          paddingBottom: footerPad,
          flexGrow: 1,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <ListItemEnter index={0}>
          <CatalogSectionBoard title={t('catalog.name')} titleWeight={titleWeight}>
            <AppText variant="caption" color="muted" dir="ltr">
              {draft.sku}
            </AppText>
            <BilingualNameField
              arabic={draft.nameAr}
              english={draft.nameEn}
              onArabicChange={(nameAr) => setDraft({ ...draft, nameAr })}
              onEnglishChange={(nameEn) => setDraft({ ...draft, nameEn })}
              arabicLabel={t('catalog.variantNameAr')}
              englishLabel={t('catalog.variantNameEn')}
            />
            {specLine ? (
              <AppText variant="caption" color="muted">
                {specLine}
              </AppText>
            ) : null}
            {variant?.isDefault ? (
              <View
                style={{
                  alignSelf: isRTL ? 'flex-end' : 'flex-start',
                  borderRadius: theme.radius.xl,
                  borderWidth: 1,
                  borderColor: colors.brand,
                  backgroundColor: colors.brandSoft,
                  paddingHorizontal: theme.spacing.md,
                  paddingVertical: theme.spacing.xs,
                }}
              >
                <AppText variant="caption" weight="medium" style={{ color: colors.brand }}>
                  {t('catalog.standardVariant')}
                </AppText>
              </View>
            ) : (
              <View style={{ gap: theme.spacing.sm }}>
                <SecondaryButton
                  label={t('catalog.makeStandard')}
                  onPress={() => makeStandard.mutate()}
                  loading={makeStandard.isPending}
                />
                <SecondaryButton
                  label={t('catalog.copyFromStandard')}
                  onPress={() => copyFromStandard.mutate()}
                  loading={copyFromStandard.isPending}
                />
                <AppText variant="caption" color="muted">
                  {t('catalog.copyFromStandardHint')}
                </AppText>
              </View>
            )}
          </CatalogSectionBoard>
        </ListItemEnter>

        <ListItemEnter index={1}>
          <CatalogSectionBoard title={t('catalog.variantWorkflow')} titleWeight={titleWeight}>
            <AppText variant="caption" color="muted">
              {t('catalog.variantWorkflowHint')}
            </AppText>
            {(workflowsQuery.data ?? [])
              .filter((wf) => Boolean(wf.activeVersion))
              .map((wf) => {
                const selected = (variant?.workflowId ?? setupQuery.data?.workflow?.id) === wf.id;
                return (
                  <AnimatedPressable
                    key={wf.id}
                    variant="button"
                    accessibilityRole="radio"
                    accessibilityState={{ selected: selected }}
                    accessibilityLabel={localizedName(locale, wf)}
                    onPress={() => {
                      void haptics.selection();
                      setWorkflow.mutate(wf.id);
                    }}
                    style={{
                      minHeight: theme.sizes.touch.min,
                      borderRadius: theme.radius.xl,
                      borderWidth: 1,
                      borderColor: selected ? colors.brand : colors.borderStrong,
                      backgroundColor: selected ? colors.brandSoft : colors.surfaceSecondary,
                      paddingHorizontal: theme.spacing.md,
                      paddingVertical: theme.spacing.sm,
                      ...orderBoardShadow(colorScheme),
                    }}
                  >
                    <AppText variant="body" weight={titleWeight}>
                      {localizedName(locale, wf)}
                    </AppText>
                  </AnimatedPressable>
                );
              })}
            <AppText variant="caption" color="muted">
              {t('catalog.workflowStageSummary', {
                stages: (setupQuery.data?.stages ?? []).length,
                minutes:
                  totalMinutes > 0
                    ? formatMinutesDuration(totalMinutes, {
                        hour: t('mobile.workerHome.durationHour'),
                        minute: t('mobile.workerHome.durationMinute'),
                      })
                    : t('mobile.production.workflow.noProductionTimeYet'),
              })}
            </AppText>
            <SecondaryButton
              label={t('mobile.production.workflow.openProductionSetup')}
              onPress={() =>
                router.push(
                  `/(app)/(admin)/products/${productId}/production-setup?variantId=${variantId}` as Href,
                )
              }
            />
          </CatalogSectionBoard>
        </ListItemEnter>

        <ListItemEnter index={2}>
          <CatalogSectionBoard
            title={t('catalog.measurements')}
            titleWeight={titleWeight}
            actionLabel={t('catalog.addMeasurement')}
            onAction={() => {
              setEditingMeasureIndex(null);
              setNewMeasure({ labelAr: '', labelEn: '', value: '', unit: 'cm' });
              setMeasureSheet(true);
            }}
          >
            {draft.measurements.length === 0 ? (
              <CatalogFloorEmpty
                icon="resize-outline"
                message={t('catalog.noCustomMeasurements')}
              />
            ) : (
              <View style={{ gap: theme.spacing.sm }}>
                <CatalogFloorListHeader
                  title={t('catalog.measurements')}
                  count={draft.measurements.length}
                />
                <CappedNestedScroll
                  itemCount={draft.measurements.length}
                  rowEstimate={FLOOR_ROW_ESTIMATE.measurement}
                  gap={theme.spacing.sm}
                >
                  {draft.measurements.map((row, index) => {
                    const name =
                      locale === 'ar'
                        ? row.labelAr || row.labelEn || row.key
                        : row.labelEn || row.labelAr || row.key;
                    const secondary =
                      locale === 'ar'
                        ? row.labelEn && row.labelEn !== name
                          ? row.labelEn
                          : null
                        : row.labelAr && row.labelAr !== name
                          ? row.labelAr
                          : null;
                    const valueLabel =
                      row.value !== ''
                        ? `${row.value} ${displayMeasurementUnit(row.unit)}`
                        : '—';
                    return (
                      <MeasurementFloorRow
                        key={row.key}
                        index={index}
                        name={name || '—'}
                        secondary={secondary}
                        valueLabel={valueLabel}
                        onEdit={() => {
                          setEditingMeasureIndex(index);
                          setNewMeasure({
                            labelAr: row.labelAr,
                            labelEn: row.labelEn,
                            value: row.value,
                            unit: row.unit,
                          });
                          setMeasureValueSheet(false);
                          setMeasureSheet(true);
                        }}
                        onRemove={() =>
                          setDraft({
                            ...draft,
                            measurements: draft.measurements.filter((_, i) => i !== index),
                          })
                        }
                      />
                    );
                  })}
                </CappedNestedScroll>
              </View>
            )}
          </CatalogSectionBoard>
        </ListItemEnter>

        <ListItemEnter index={3}>
          <CatalogSectionBoard title={t('catalog.costs')} titleWeight={titleWeight}>
            <TextField
              label={t('catalog.basePrice')}
              value={draft.basePrice}
              onChangeText={(basePrice) => setDraft({ ...draft, basePrice })}
              keyboardType="decimal-pad"
            />
            <AppText variant="caption" color="muted">
              {t('catalog.basePriceHint')}
            </AppText>
            <View
              style={{
                padding: theme.spacing.md,
                borderRadius: theme.radius.xl,
                backgroundColor: colors.surfaceSecondary,
                borderWidth: 1,
                borderColor: colors.border,
                gap: 4,
              }}
            >
              <AppText variant="caption" color="muted">
                {t('catalog.derivedManufacturingCost')}
              </AppText>
              <AppText variant="title" weight={titleWeight} dir="ltr">
                {formatCurrency(
                  Number(costQuery.data?.manufacturingCost ?? variant?.manufacturingCost ?? 0) || 0,
                )}
              </AppText>
              <AppText variant="caption" color="muted">
                {t('catalog.costMaterials')}: {formatCurrency(Number(costQuery.data?.materials.total ?? bomRollup) || 0)}
              </AppText>
              <AppText variant="caption" color="muted">
                {t('catalog.costLabor')}: {formatCurrency(Number(costQuery.data?.labor.cost ?? 0) || 0)}
                {costQuery.data?.labor.hours
                  ? ` · ${t('catalog.costLaborHours', { hours: costQuery.data.labor.hours })}`
                  : ''}
              </AppText>
            </View>
          </CatalogSectionBoard>
        </ListItemEnter>

        <ListItemEnter index={4}>
          <CatalogSectionBoard
            title={t('catalog.sellerPrices')}
            titleWeight={titleWeight}
            actionLabel={canPrice ? t('catalog.addSellerPrice') : undefined}
            onAction={canPrice ? openAddSellerPrice : undefined}
          >
            <AppText variant="caption" color="muted">
              {t('catalog.sellerPricesHint')}
            </AppText>
            {dealerPrices.length === 0 ? (
              <CatalogFloorEmpty icon="pricetag-outline" message={t('customers.noPrices')} />
            ) : (
              <View style={{ gap: theme.spacing.sm }}>
                <CatalogFloorListHeader
                  title={t('catalog.sellerPrices')}
                  count={dealerPrices.length}
                />
                <CappedNestedScroll
                  itemCount={dealerPrices.length}
                  rowEstimate={FLOOR_ROW_ESTIMATE.seller}
                  gap={theme.spacing.sm}
                >
                  {dealerPrices.map((row, index) => {
                    const name =
                      locale === 'ar'
                        ? row.customer?.nameAr || row.customer?.name || row.customer?.nameEn
                        : locale === 'he'
                          ? row.customer?.nameHe || row.customer?.name || row.customer?.nameEn
                          : row.customer?.nameEn || row.customer?.name || row.customer?.nameAr;
                    const initial = (name || row.customer?.code || '?')
                      .trim()
                      .charAt(0)
                      .toUpperCase();
                    const isVariantScoped = row.variantId === variantId;
                    return (
                      <SellerPriceFloorRow
                        key={row.id}
                        index={index}
                        name={name || '—'}
                        code={row.customer?.code ?? ''}
                        initial={initial}
                        priceLabel={formatCurrency(Number(row.price))}
                        canEdit={canPrice}
                        canDelete={canPrice && isVariantScoped}
                        deleting={deletePrice.isPending}
                        onEdit={() =>
                          openEditSellerPrice({
                            customerId: row.customerId,
                            price: row.price,
                            name: name || row.customer?.code || '—',
                          })
                        }
                        onDelete={() =>
                          deletePrice.mutate({
                            customerId: row.customerId,
                            id: row.id,
                          })
                        }
                      />
                    );
                  })}
                </CappedNestedScroll>
              </View>
            )}
          </CatalogSectionBoard>
        </ListItemEnter>

        <ListItemEnter index={5}>
          <CatalogSectionBoard
            title={t('catalog.bomMaterials')}
            titleWeight={titleWeight}
            actionLabel={t('catalog.addMaterial')}
            onAction={() => setMaterialSheet(true)}
          >
            {draft.bomLines.length === 0 ? (
              <CatalogFloorEmpty icon="cube-outline" message={t('catalog.noBomMaterials')} />
            ) : (
              <CappedNestedScroll
                itemCount={draft.bomLines.length}
                rowEstimate={FLOOR_ROW_ESTIMATE.bom}
                gap={theme.spacing.sm}
              >
                {draft.bomLines.map((line, idx) => {
                  const qtyNum = Math.max(0, Number(line.qty) || 0);
                  const lineTotal = qtyNum * (Number(line.unitCost) || 0);
                  return (
                    <BomFloorRow
                      key={`${line.sku}-${idx}`}
                      index={idx}
                      name={
                        locale === 'ar' ? line.nameAr || line.nameEn : line.nameEn || line.nameAr
                      }
                      sku={line.sku}
                      imageUrl={line.imageUrl}
                      unitCostLabel={formatCurrency(line.unitCost)}
                      lineTotalLabel={formatCurrency(lineTotal)}
                      qty={String(line.qty)}
                      onQtyChange={(v) => {
                        const q = Math.max(0, Number(v) || 0);
                        setDraft({
                          ...draft,
                          bomLines: draft.bomLines.map((l, i) =>
                            i === idx ? { ...l, qty: q, lineCost: q * l.unitCost } : l,
                          ),
                        });
                      }}
                      onRemove={() =>
                        setDraft({
                          ...draft,
                          bomLines: draft.bomLines.filter((_, i) => i !== idx),
                        })
                      }
                    />
                  );
                })}
              </CappedNestedScroll>
            )}
          </CatalogSectionBoard>
        </ListItemEnter>


        {activeSpecGroups.length ? (

          <ListItemEnter index={6}>
            <CatalogSectionBoard titleWeight={titleWeight}>
              <VariantOptionGroupsBoard
                groups={groupsQuery.data?.data ?? []}
                values={valuesQuery.data?.data ?? []}
                selectedByGroup={draft.selectedByGroup}
                onChange={(groupId, valueId) =>
                  setDraft({
                    ...draft,
                    selectedByGroup: { ...draft.selectedByGroup, [groupId]: valueId },
                  })
                }
              />
            </CatalogSectionBoard>
          </ListItemEnter>
        ) : null}

        <ListItemEnter index={7}>
          <CatalogSectionBoard title={t('catalog.defaultInstructions')} titleWeight={titleWeight}>
            <AppText variant="caption" color="muted">
              {t('catalog.defaultInstructionsHint')}
            </AppText>
            <BilingualNameField
              arabic={draft.factoryNotesAr}
              english={draft.factoryNotesEn}
              onArabicChange={(factoryNotesAr) => setDraft({ ...draft, factoryNotesAr })}
              onEnglishChange={(factoryNotesEn) => setDraft({ ...draft, factoryNotesEn })}
              arabicLabel={t('catalog.factoryNotesAr')}
              englishLabel={t('catalog.factoryNotesEn')}
              kind="prose"
              multiline
            />
          </CatalogSectionBoard>
        </ListItemEnter>

        <ListItemEnter index={8}>
          <CatalogSectionBoard title={t('catalog.adminNotes')} titleWeight={titleWeight}>
            <TextField
              label={t('catalog.adminNotes')}
              value={draft.adminNotes}
              onChangeText={(adminNotes) => setDraft({ ...draft, adminNotes })}
              multiline
              growMinHeight={72}
            />
          </CatalogSectionBoard>
        </ListItemEnter>

        <PrimaryButton
          label={t('common.save')}
          loading={save.isPending}
          onPress={() => {
            void haptics.confirmMedium();
            save.mutate();
          }}
          trailing={<Ionicons name="checkmark" size={18} color={colors.onBrand} />}
          style={{ borderRadius: theme.radius.xl, ...orderBoardShadow(colorScheme) }}
        />
        <SecondaryButton label={t('catalog.duplicateVariant')} onPress={() => duplicate.mutate()} />
        {variant?.isDefault ? null : variant?.isActive ? (
          <SecondaryButton label={t('catalog.deactivateVariant')} onPress={() => deactivate.mutate()} />
        ) : (
          <SecondaryButton label={t('catalog.activateVariant')} onPress={() => activate.mutate()} />
        )}
      </ScrollView>

      <BomMaterialPickerSheet
        open={materialSheet}
        onClose={() => setMaterialSheet(false)}
        existingSkus={draft.bomLines.map((l) => l.sku)}
        onPick={(line) => setDraft({ ...draft, bomLines: [...draft.bomLines, line] })}
      />

      <BottomSheet
        open={measureSheet}
        onClose={() => {
          setMeasureValueSheet(false);
          setEditingMeasureIndex(null);
          setMeasureSheet(false);
        }}
        title={
          measureValueSheet
            ? t('catalog.pickMeasurementValue')
            : editingMeasureIndex != null
              ? t('common.edit')
              : t('catalog.addMeasurement')
        }
        fitContent
        maxHeight={560}
      >
        {measureValueSheet ? (
          <MeasurementValuePanel
            active={measureValueSheet}
            selected={newMeasure.value}
            unit={newMeasure.unit}
            onBack={() => setMeasureValueSheet(false)}
            onSelect={applyMeasurement}
          />
        ) : (
          <View style={{ gap: theme.spacing.md }}>
            <BilingualNameField
              arabic={newMeasure.labelAr}
              english={newMeasure.labelEn}
              onArabicChange={(labelAr) => setNewMeasure((s) => ({ ...s, labelAr }))}
              onEnglishChange={(labelEn) => setNewMeasure((s) => ({ ...s, labelEn }))}
              arabicLabel={t('catalog.measurementNameAr')}
              englishLabel={t('catalog.measurementNameEn')}
            />
            <SecondaryButton
              label={t('catalog.pickMeasurementValue')}
              onPress={() => {
                if (!newMeasure.labelAr.trim()) {
                  void haptics.error();
                  showToast({ variant: 'error', message: t('catalog.measurementNamesRequired') });
                  return;
                }
                setMeasureValueSheet(true);
              }}
            />
          </View>
        )}
      </BottomSheet>

      <BottomSheet
        open={sellerSheet}
        onClose={() => {
          setSellerSheet(false);
          setSellerEditing(false);
          setSellerCustomerLabel('');
          setSellerCustomerId(null);
          setSellerPrice('');
          setSellerQ('');
        }}
        title={sellerEditing ? t('common.edit') : t('catalog.addSellerPrice')}
        fitContent
        maxHeight={520}
      >
        <View style={{ gap: theme.spacing.md }}>
          {sellerEditing ? (
            <AppText variant="body" weight={titleWeight}>
              {sellerCustomerLabel || '—'}
            </AppText>
          ) : (
            <>
              <TextField
                label={t('mobile.catalog.search')}
                value={sellerQ}
                onChangeText={setSellerQ}
                returnKeyType="search"
              />
              {(customersQuery.data?.data ?? []).map((c) => {
                const name =
                  locale === 'ar' ? c.nameAr || c.name || c.nameEn : c.nameEn || c.name || c.nameAr;
                return (
                  <Pressable
                    key={c.id}
                    accessibilityRole="button"
                    accessibilityLabel={name || c.code}
                    onPress={() => {
                      void haptics.selection();
                      setSellerCustomerId(c.id);
                    }}
                    style={{
                      minHeight: 44,
                      borderRadius: theme.radius.xl,
                      borderWidth: 1,
                      borderColor: sellerCustomerId === c.id ? colors.brand : colors.border,
                      paddingHorizontal: theme.spacing.md,
                      justifyContent: 'center',
                    }}
                  >
                    <AppText>{name || c.code}</AppText>
                  </Pressable>
                );
              })}
            </>
          )}
          <TextField
            label={t('catalog.price')}
            value={sellerPrice}
            onChangeText={setSellerPrice}
            keyboardType="decimal-pad"
          />
          <PrimaryButton
            label={t('common.save')}
            disabled={!sellerCustomerId || !sellerPrice.trim()}
            onPress={() => upsertPrice.mutate()}
          />
        </View>
      </BottomSheet>
    </AppScreen>
  );
}
