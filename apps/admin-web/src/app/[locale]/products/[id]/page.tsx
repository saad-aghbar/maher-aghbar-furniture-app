'use client';

import { PageHeader } from '@/components/admin/page-header';
import { BomMaterialPicker, type PickedMaterial } from '@/components/admin/bom-material-picker';
import { ProductWorkflowTimes } from '@/components/workflow/product-workflow-times';
import { ProductProductionSetup } from '@/components/catalog/product-production-setup';
import { apiFetch, apiUpload, API_URL, ApiClientError } from '@/lib/api-client';
import { mutationErrorMessage } from '@/hooks/use-api-mutation';
import {
  QUANTITY_SCALING_MODES,
  type ProductProductionProfile,
  type ProductStageEstimateRow,
} from '@/lib/scheduling';
import { localizedName } from '@maher/i18n';
import {
  Alert,
  Button,
  Card,
  ErrorState,
  ImageSourceField,
  Input,
  Modal,
  Select,
  Skeleton,
  StatusBadge,
  TextArea,
  MotionSection,
} from '@maher/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Armchair, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

interface Category {
  id: string;
  code: string;
  nameAr: string;
  nameEn: string;
}

interface StageOption {
  id: string;
  code: string;
  nameAr: string;
  nameEn: string;
  nameHe?: string | null;
}

interface StageEstimateDraft {
  key: string;
  stageDefinitionId: string;
  setupMinutes: string;
  minutesPerUnit: string;
  fixedMinutes: string;
  quantityScalingMode: string;
  workerCountRequired: string;
  isRequired: boolean;
}

interface BomLine {
  sku: string;
  qty: number;
  category?: string | null;
  unitCost?: number;
  lineCost?: number;
  nameEn?: string;
  nameAr?: string;
  materialId?: string | null;
}

type BomEditLine = {
  sku: string;
  qty: string;
  category: string;
  nameEn?: string;
  nameAr?: string;
};

interface ProductDetail {
  id: string;
  sku: string;
  nameAr: string;
  nameEn: string;
  nameHe?: string | null;
  description?: string | null;
  isActive: boolean;
  basePrice?: string | number | null;
  manufacturingCost?: string | number | null;
  productionCost?: string | number | null;
  imageUrl?: string | null;
  galleryUrls?: string[] | null;
  categoryId?: string | null;
  category?: Category | null;
  width?: string | number | null;
  height?: string | number | null;
  depth?: string | number | null;
  seatHeight?: string | number | null;
  customMeasurements?: CustomMeasurement[] | null;
  adminNotes?: string | null;
  bomLines?: BomLine[];
  bomDefaults?: { materials?: BomLine[] } | null;
}

interface CustomMeasurement {
  id: string;
  nameEn: string;
  nameAr: string;
  nameHe?: string | null;
  value?: string | number | null;
}

interface DealerPriceRow {
  id: string;
  price: string | number;
  currency: string;
  customerId?: string;
  customer?: {
    id: string;
    code?: string;
    name?: string;
    nameAr?: string | null;
    nameEn?: string | null;
    nameHe?: string | null;
  };
}

interface CustomerRow {
  id: string;
  code: string;
  name: string;
  nameAr?: string | null;
  nameEn?: string | null;
  nameHe?: string | null;
}

export default function ProductDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const t = useTranslations('catalog');
  const tp = useTranslations('production');
  const tCustomers = useTranslations('customers');
  const tCommon = useTranslations('common');
  const tSales = useTranslations('sales');
  const locale = useLocale();
  const qc = useQueryClient();

  const [banner, setBanner] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sellerOpen, setSellerOpen] = useState(false);
  const [sellerCustomerId, setSellerCustomerId] = useState('');
  const [sellerPrice, setSellerPrice] = useState('');
  const [sellerError, setSellerError] = useState<string | null>(null);
  const [measureOpen, setMeasureOpen] = useState(false);
  const [measureNameEn, setMeasureNameEn] = useState('');
  const [measureNameAr, setMeasureNameAr] = useState('');
  const [measureNameHe, setMeasureNameHe] = useState('');
  const [measureValue, setMeasureValue] = useState('');
  const [measureError, setMeasureError] = useState<string | null>(null);

  const [nameEn, setNameEn] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [basePrice, setBasePrice] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [description, setDescription] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  const [width, setWidth] = useState('');
  const [height, setHeight] = useState('');
  const [depth, setDepth] = useState('');
  const [seatHeight, setSeatHeight] = useState('');
  const [customMeasurements, setCustomMeasurements] = useState<CustomMeasurement[]>([]);
  const [bomLines, setBomLines] = useState<BomEditLine[]>([]);
  const [isActive, setIsActive] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerReplaceIndex, setPickerReplaceIndex] = useState<number | null>(null);

  const [schedulingMode, setSchedulingMode] = useState<'basic' | 'advanced'>('basic');
  const [isSchedulingEnabled, setIsSchedulingEnabled] = useState(true);
  const [totalStandardMinutes, setTotalStandardMinutes] = useState('');
  const [profileSetupMinutes, setProfileSetupMinutes] = useState('');
  const [complexityFactor, setComplexityFactor] = useState('1');
  const [defaultBatchSize, setDefaultBatchSize] = useState('1');
  const [minimumLeadTimeDays, setMinimumLeadTimeDays] = useState('');
  const [profileBufferPercent, setProfileBufferPercent] = useState('10');
  const [stageEstimates, setStageEstimates] = useState<StageEstimateDraft[]>([]);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [workflowId, setWorkflowId] = useState('');
  const [workflowOverrides, setWorkflowOverrides] = useState<
    Array<{
      key: string;
      stageDefinitionId: string;
      applicability: 'INHERIT' | 'REQUIRED' | 'OPTIONAL' | 'EXCLUDED';
    }>
  >([]);

  const productQuery = useQuery({
    queryKey: ['product', id],
    queryFn: () => apiFetch<ProductDetail>(`/api/v1/products/${id}`),
  });

  const categoriesQuery = useQuery({
    queryKey: ['product-categories'],
    queryFn: () =>
      apiFetch<{ data: Category[] }>('/api/v1/product-categories?pageSize=100').then((r) => r.data),
  });

  const stagesQuery = useQuery({
    queryKey: ['production-stages', 'for-product-time'],
    queryFn: () =>
      apiFetch<{ data: StageOption[] } | StageOption[]>('/api/v1/production-stages?pageSize=200').then(
        (r) => (Array.isArray(r) ? r : r.data),
      ),
    staleTime: 60_000,
  });

  const productionProfileQuery = useQuery({
    queryKey: ['product-production-profile', id],
    queryFn: () =>
      apiFetch<ProductProductionProfile>(`/api/v1/scheduling/products/${id}/production-profile`),
    retry: false,
  });

  const stageEstimatesQuery = useQuery({
    queryKey: ['product-stage-estimates', id],
    queryFn: () =>
      apiFetch<ProductStageEstimateRow[]>(`/api/v1/scheduling/products/${id}/stage-estimates`),
    retry: false,
  });

  const workflowsQuery = useQuery({
    queryKey: ['production-workflows'],
    queryFn: () =>
      apiFetch<
        Array<{ id: string; code: string; nameEn: string; nameAr: string; nameHe?: string | null }>
      >('/api/v1/production-workflows'),
  });

  const productWorkflowQuery = useQuery({
    queryKey: ['product-workflow-configuration', id],
    queryFn: () =>
      apiFetch<{
        workflowId: string;
        stageOverrides: Array<{
          stageDefinitionId: string;
          applicability: 'INHERIT' | 'REQUIRED' | 'OPTIONAL' | 'EXCLUDED';
        }>;
      } | null>(`/api/v1/products/${id}/workflow-configuration`),
    retry: false,
  });

  const stageLibraryQuery = useQuery({
    queryKey: ['production-stage-library'],
    queryFn: () =>
      apiFetch<
        Array<{ id: string; code: string; nameEn: string; nameAr: string; nameHe?: string | null }>
      >('/api/v1/production-stage-library'),
    staleTime: 60_000,
  });

  const dealerPricesQuery = useQuery({
    queryKey: ['product-dealer-prices', id],
    queryFn: () => apiFetch<DealerPriceRow[]>(`/api/v1/products/${id}/dealer-prices`),
  });

  const customersQuery = useQuery({
    queryKey: ['customers-pick'],
    queryFn: () =>
      apiFetch<{ data: CustomerRow[] }>('/api/v1/customers?pageSize=100').then((r) => r.data),
    enabled: sellerOpen,
  });

  const data = productQuery.data;

  useEffect(() => {
    if (!data) return;
    setNameEn(data.nameEn);
    setNameAr(data.nameAr);
    setCategoryId(data.categoryId ?? '');
    setBasePrice(data.basePrice != null ? String(data.basePrice) : '');
    const merged: string[] = [];
    const add = (u?: string | null) => {
      const v = u?.trim();
      if (v && !merged.includes(v)) merged.push(v);
    };
    add(data.imageUrl);
    for (const g of data.galleryUrls ?? []) add(g);
    setPhotos(merged);
    setDescription(data.description ?? '');
    setWidth(data.width != null ? String(data.width) : '');
    setHeight(data.height != null ? String(data.height) : '');
    setDepth(data.depth != null ? String(data.depth) : '');
    setSeatHeight(data.seatHeight != null ? String(data.seatHeight) : '');
    setAdminNotes(data.adminNotes ?? '');
    setCustomMeasurements(
      (data.customMeasurements ?? []).map((m, i) => ({
        id: m.id || `m-${i}`,
        nameEn: m.nameEn,
        nameAr: m.nameAr,
        nameHe: m.nameHe ?? '',
        value: m.value ?? '',
      })),
    );
    setIsActive(data.isActive);
    const lines = data.bomLines?.length
      ? data.bomLines
      : data.bomDefaults?.materials ?? [];
    setBomLines(
      lines
        .filter((l) => l.sku)
        .map((l) => ({
          sku: l.sku ?? '',
          qty: String(l.qty ?? ''),
          category: l.category ?? '',
          nameEn: l.nameEn,
          nameAr: l.nameAr,
        })),
    );
  }, [data]);

  useEffect(() => {
    const profile = productionProfileQuery.data;
    if (!profile) return;
    setIsSchedulingEnabled(profile.isSchedulingEnabled);
    setTotalStandardMinutes(profile.totalStandardMinutes != null ? String(profile.totalStandardMinutes) : '');
    setProfileSetupMinutes(String(profile.setupMinutes ?? 0));
    setComplexityFactor(String(profile.complexityFactor ?? 1));
    setDefaultBatchSize(String(profile.defaultBatchSize ?? 1));
    setMinimumLeadTimeDays(profile.minimumLeadTimeDays != null ? String(profile.minimumLeadTimeDays) : '');
    setProfileBufferPercent(String(profile.bufferPercent ?? 10));
  }, [productionProfileQuery.data]);

  useEffect(() => {
    const rows = stageEstimatesQuery.data ?? [];
    if (rows.length === 0) return;
    setStageEstimates(
      rows.map((row, i) => ({
        key: row.id || `est-${i}`,
        stageDefinitionId: row.stageDefinitionId,
        setupMinutes: String(row.setupMinutes ?? 0),
        minutesPerUnit: String(row.minutesPerUnit ?? 0),
        fixedMinutes: String(row.fixedMinutes ?? 0),
        quantityScalingMode: row.quantityScalingMode || 'SETUP_PLUS_LINEAR',
        workerCountRequired: String(row.workerCountRequired ?? 1),
        isRequired: row.isRequired ?? true,
      })),
    );
    setSchedulingMode('advanced');
  }, [stageEstimatesQuery.data]);

  useEffect(() => {
    const cfg = productWorkflowQuery.data;
    if (!cfg) return;
    setWorkflowId(cfg.workflowId);
    setWorkflowOverrides(
      (cfg.stageOverrides ?? []).map((o, i) => ({
        key: `ov-${i}`,
        stageDefinitionId: o.stageDefinitionId,
        applicability: o.applicability,
      })),
    );
  }, [productWorkflowQuery.data]);

  const saveProductWorkflowMutation = useMutation({
    mutationFn: () =>
      apiFetch(`/api/v1/products/${id}/workflow-configuration`, {
        method: 'PATCH',
        body: JSON.stringify({
          workflowId,
          overrides: workflowOverrides
            .filter((o) => o.stageDefinitionId)
            .map((o) => ({
              stageDefinitionId: o.stageDefinitionId,
              applicability: o.applicability,
            })),
        }),
      }),
    onSuccess: async () => {
      setBanner(tCommon('saved'));
      await qc.invalidateQueries({ queryKey: ['product-workflow-configuration', id] });
    },
    onError: (err) => setError(mutationErrorMessage(err)),
  });

  const liveBomCost = useMemo(() => {
    return bomLines.reduce((sum, line) => {
      const fromApi = data?.bomLines?.find((b) => b.sku === line.sku);
      const unitCost = fromApi?.unitCost ?? 0;
      return sum + (Number(line.qty) || 0) * unitCost;
    }, 0);
  }, [bomLines, data?.bomLines]);

  const saveSellerPriceMutation = useMutation({
    mutationFn: async () => {
      if (!sellerCustomerId || sellerPrice === '' || Number(sellerPrice) < 0) {
        throw new ApiClientError(tCustomers('dealerPriceRequired'), 400);
      }
      return apiFetch(`/api/v1/customers/${sellerCustomerId}/dealer-prices`, {
        method: 'POST',
        body: JSON.stringify({ productId: id, price: Number(sellerPrice) }),
      });
    },
    onSuccess: async () => {
      setSellerOpen(false);
      setSellerCustomerId('');
      setSellerPrice('');
      setSellerError(null);
      setBanner(t('sellerPriceSaved'));
      await qc.invalidateQueries({ queryKey: ['product-dealer-prices', id] });
    },
    onError: (err) => setSellerError(mutationErrorMessage(err)),
  });

  const deleteSellerPriceMutation = useMutation({
    mutationFn: (row: DealerPriceRow) =>
      apiFetch(`/api/v1/customers/${row.customer?.id ?? row.customerId}/dealer-prices/${row.id}`, {
        method: 'DELETE',
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['product-dealer-prices', id] });
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!nameEn.trim() || !nameAr.trim()) {
        throw new ApiClientError(t('namesRequired'), 400);
      }
      return apiFetch<ProductDetail>(`/api/v1/products/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          nameEn: nameEn.trim(),
          nameAr: nameAr.trim(),
          categoryId: categoryId || null,
          basePrice: basePrice ? Number(basePrice) : null,
          imageUrl: photos[0] || null,
          galleryUrls: photos.slice(1),
          description: description.trim() || null,
          width: width ? Number(width) : null,
          height: height ? Number(height) : null,
          depth: depth ? Number(depth) : null,
          seatHeight: seatHeight ? Number(seatHeight) : null,
          adminNotes: adminNotes.trim() || null,
          customMeasurements: customMeasurements.map((m) => ({
            id: m.id,
            nameEn: m.nameEn.trim(),
            nameAr: m.nameAr.trim(),
            nameHe: String(m.nameHe ?? '').trim() || undefined,
            value:
              m.value !== '' && m.value != null && Number.isFinite(Number(m.value))
                ? Number(m.value)
                : null,
          })),
          isActive,
          bomDefaults: {
            materials: bomLines
              .filter((l) => l.sku.trim())
              .map((l) => ({
                sku: l.sku.trim(),
                qty: Number(l.qty) || 0,
                category: l.category || undefined,
              })),
          },
        }),
      });
    },
    onSuccess: async () => {
      setBanner(tCommon('saved'));
      setError(null);
      await qc.invalidateQueries({ queryKey: ['product', id] });
      await qc.invalidateQueries({ queryKey: ['products'] });
      await qc.invalidateQueries({ queryKey: ['product-production-setup', id] });
      await qc.invalidateQueries({ queryKey: ['product-production-setup-preview', id] });
    },
    onError: (err) => setError(mutationErrorMessage(err)),
  });

  const saveProductionProfileMutation = useMutation({
    mutationFn: async () => {
      await apiFetch(`/api/v1/scheduling/products/${id}/production-profile`, {
        method: 'PATCH',
        body: JSON.stringify({
          isSchedulingEnabled,
          totalStandardMinutes: totalStandardMinutes ? Number(totalStandardMinutes) : null,
          setupMinutes: Number(profileSetupMinutes) || 0,
          complexityFactor: Number(complexityFactor) || 1,
          defaultBatchSize: Number(defaultBatchSize) || 1,
          minimumLeadTimeDays: minimumLeadTimeDays ? Number(minimumLeadTimeDays) : null,
          bufferPercent: Number(profileBufferPercent) || 0,
        }),
      });
      if (schedulingMode === 'advanced') {
        const items = stageEstimates
          .filter((row) => row.stageDefinitionId)
          .map((row) => ({
            stageDefinitionId: row.stageDefinitionId,
            setupMinutes: Number(row.setupMinutes) || 0,
            minutesPerUnit: Number(row.minutesPerUnit) || 0,
            fixedMinutes: Number(row.fixedMinutes) || 0,
            quantityScalingMode: row.quantityScalingMode,
            workerCountRequired: Number(row.workerCountRequired) || 1,
            isRequired: row.isRequired,
          }));
        if (items.length > 0) {
          await apiFetch(`/api/v1/scheduling/products/${id}/stage-estimates`, {
            method: 'PATCH',
            body: JSON.stringify({ items }),
          });
        }
      }
    },
    onSuccess: async () => {
      setProfileError(null);
      setBanner(t('productionProfileSaved'));
      await qc.invalidateQueries({ queryKey: ['product-production-profile', id] });
      await qc.invalidateQueries({ queryKey: ['product-stage-estimates', id] });
    },
    onError: (err) => setProfileError(mutationErrorMessage(err)),
  });

  if (productQuery.isLoading) return <Skeleton className="h-64 w-full" />;
  if (productQuery.isError || !data) {
    return (
      <ErrorState
        title={t('product')}
        onRetry={() => productQuery.refetch()}
        retryLabel={tCommon('retry')}
      />
    );
  }

  const title = localizedName(locale, data);
  const productionCost = Number(data.productionCost ?? data.manufacturingCost ?? liveBomCost);

  return (
    <div className="space-y-6">
      <PageHeader
        backHref="/products"
        title={title}
        description={data.category ? localizedName(locale, data.category) : undefined}
        actions={
          <div className="maher-detail-sticky-actions flex flex-wrap items-center gap-2">
            <StatusBadge
              status={isActive ? 'ACTIVE' : 'INACTIVE'}
              label={isActive ? t('active') : tCommon('no')}
            />
            <Button size="sm" loading={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
              {tCommon('save')}
            </Button>
          </div>
        }
      />

      {banner ? <Alert variant="success">{banner}</Alert> : null}
      {error ? <Alert variant="error">{error}</Alert> : null}

      <div className="maher-stagger space-y-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <MotionSection className="maher-form-section" as="div">
        <Card title={t('product')}>
          <div className="space-y-4">
            <div className="overflow-hidden rounded-xl border border-border bg-[var(--maher-surface-muted)] aspect-[5/4]">
              {photos[0] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photos[0]} alt={title} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-text-tertiary">
                  <Armchair className="h-12 w-12 opacity-40" />
                  <span className="text-xs">{t('changeProductPhoto')}</span>
                </div>
              )}
            </div>
            <ImageSourceField
              label={t('changeProductPhoto')}
              value={photos[0] ?? ''}
              onChange={(url) => setPhotos(url ? [url, ...photos.slice(1)] : photos.slice(1))}
              hint={t('imageUrlHint')}
              uploadLabel={tCommon('uploadFromDevice')}
              uploadingLabel={tCommon('uploading')}
              allowUrl={false}
              multiple
              showPreview={false}
              onUploadFiles={async (files) => {
                const uploaded: string[] = [];
                for (const file of files) {
                  const form = new FormData();
                  form.append('file', file);
                  const res = await apiUpload<{ downloadPath: string }>(
                    '/api/v1/uploads?category=PRODUCT_IMAGE',
                    form,
                  );
                  uploaded.push(`${API_URL}${res.downloadPath}`);
                }
                setPhotos((prev) => {
                  const next = [...prev];
                  for (const u of uploaded) {
                    if (!next.includes(u)) next.push(u);
                  }
                  return next;
                });
              }}
            />
            {photos.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {photos.map((url, i) => (
                  <button
                    key={`${url}-${i}`}
                    type="button"
                    className="relative h-16 w-16 overflow-hidden rounded-lg border border-border"
                    onClick={() => setPhotos((prev) => prev.filter((_, idx) => idx !== i))}
                    title={t('removeProductPhoto')}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-2">
              <Select
                label={t('category')}
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                options={[
                  { value: '', label: t('select') },
                  ...(categoriesQuery.data ?? []).map((c) => ({
                    value: c.id,
                    label: localizedName(locale, c),
                  })),
                ]}
              />
              <Input
                label={t('nameEn')}
                value={nameEn}
                onChange={(e) => setNameEn(e.target.value)}
              />
              <Input
                label={t('nameAr')}
                value={nameAr}
                onChange={(e) => setNameAr(e.target.value)}
              />
            </div>
            <Input
              label={t('description')}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <label className="flex items-center gap-2 text-sm text-text-secondary">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
              />
              {t('active')}
            </label>
          </div>
        </Card>
        </MotionSection>

        <div className="space-y-6">
          <MotionSection className="maher-form-section" as="div">
          <Card
            title={t('measurements')}
            actions={
              <Button
                size="sm"
                variant="secondary"
                leadingIcon={<Plus className="h-4 w-4" />}
                onClick={() => {
                  setMeasureNameEn('');
                  setMeasureNameAr('');
                  setMeasureNameHe('');
                  setMeasureValue('');
                  setMeasureError(null);
                  setMeasureOpen(true);
                }}
              >
                {t('addMeasurement')}
              </Button>
            }
          >
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label={t('width')}
                  type="number"
                  value={width}
                  onChange={(e) => setWidth(e.target.value)}
                  dir="ltr"
                />
                <Input
                  label={t('height')}
                  type="number"
                  value={height}
                  onChange={(e) => setHeight(e.target.value)}
                  dir="ltr"
                />
                <Input
                  label={t('depth')}
                  type="number"
                  value={depth}
                  onChange={(e) => setDepth(e.target.value)}
                  dir="ltr"
                />
                <Input
                  label={t('seatHeight')}
                  type="number"
                  value={seatHeight}
                  onChange={(e) => setSeatHeight(e.target.value)}
                  dir="ltr"
                />
              </div>

              {customMeasurements.length === 0 ? (
                <p className="text-xs text-text-tertiary">{t('noCustomMeasurements')}</p>
              ) : (
                <ul className="space-y-2">
                  {customMeasurements.map((m) => (
                    <li
                      key={m.id}
                      className="grid gap-2 rounded-xl border border-border p-3 sm:grid-cols-[minmax(0,1fr)_120px_auto]"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-text-primary">
                          {localizedName(locale, m)}
                        </p>
                        <p className="truncate text-[11px] text-text-tertiary">
                          {m.nameEn} · {m.nameAr}
                          {m.nameHe ? ` · ${m.nameHe}` : ''}
                        </p>
                      </div>
                      <Input
                        label={t('measurementValue')}
                        type="number"
                        value={m.value != null ? String(m.value) : ''}
                        onChange={(e) =>
                          setCustomMeasurements((prev) =>
                            prev.map((row) =>
                              row.id === m.id ? { ...row, value: e.target.value } : row,
                            ),
                          )
                        }
                        dir="ltr"
                      />
                      <div className="flex items-end pb-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            setCustomMeasurements((prev) =>
                              prev.filter((row) => row.id !== m.id),
                            )
                          }
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Card>
          </MotionSection>

          <MotionSection className="maher-form-section" as="div">
          <Card title={t('costs')}>
            <dl className="grid gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-xs text-text-tertiary">{t('basePrice')}</dt>
                <dd className="mt-1">
                  <Input
                    type="number"
                    value={basePrice}
                    onChange={(e) => setBasePrice(e.target.value)}
                    dir="ltr"
                  />
                </dd>
                <p className="mt-1 text-[11px] text-text-tertiary">{t('basePriceHint')}</p>
              </div>
              <div>
                <dt className="text-xs text-text-tertiary">{tSales('productionPrice')}</dt>
                <dd className="mt-1 text-lg font-bold tabular-nums text-text-primary" dir="ltr">
                  {Number.isFinite(productionCost)
                    ? `${productionCost.toFixed(2)} ${tCommon('currency')}`
                    : '—'}
                </dd>
                <p className="mt-1 text-[11px] text-text-tertiary">{t('productionCostHint')}</p>
              </div>
            </dl>
          </Card>
          </MotionSection>
        </div>
      </div>

      <MotionSection className="maher-form-section" as="div">
      <Card
        title={t('productionTime')}
        description={t('productionTimeHint')}
        actions={
          <Button
            size="sm"
            loading={saveProductionProfileMutation.isPending}
            onClick={() => saveProductionProfileMutation.mutate()}
          >
            {tCommon('save')}
          </Button>
        }
      >
        <div className="space-y-4">
          {profileError ? <Alert variant="error">{profileError}</Alert> : null}
          {productionProfileQuery.isError ? (
            <p className="text-xs text-text-tertiary">{t('productionProfileUnavailableHint')}</p>
          ) : null}

          {(() => {
            const computed = stageEstimates.reduce((sum, row) => {
              const setup = Number(row.setupMinutes || 0);
              const per = Number(row.minutesPerUnit || 0);
              const fixed = Number(row.fixedMinutes || 0);
              if (row.quantityScalingMode === 'FIXED') return sum + fixed;
              if (row.quantityScalingMode === 'LINEAR') return sum + per;
              return sum + setup + per;
            }, 0);
            const profileTotal = Number(totalStandardMinutes || 0);
            const display = computed > 0 ? computed : profileTotal;
            if (!display) return null;
            const hours = Math.floor(display / 60);
            const mins = display % 60;
            const label =
              hours > 0 && mins > 0
                ? `${hours}h ${mins}m`
                : hours > 0
                  ? `${hours}h`
                  : `${mins}m`;
            return (
              <div className="rounded-lg border border-border bg-surface-muted px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-wide text-text-tertiary">
                  {t('computedTotalProductionTime')}
                </p>
                <p className="mt-1 text-lg font-semibold text-text-primary" dir="ltr">
                  {label}
                  <span className="ms-2 text-sm font-normal text-text-secondary">
                    ({display} {t('minutesUnit')})
                  </span>
                </p>
                <p className="mt-1 text-xs text-text-tertiary">{t('computedTotalProductionTimeHint')}</p>
              </div>
            );
          })()}

          <label className="flex items-center gap-2 text-sm text-text-secondary">
            <input
              type="checkbox"
              checked={isSchedulingEnabled}
              onChange={(e) => setIsSchedulingEnabled(e.target.checked)}
            />
            {t('schedulingEnabled')}
          </label>

          <div className="inline-flex rounded-lg border border-border bg-surface-muted p-1">
            <button
              type="button"
              onClick={() => setSchedulingMode('basic')}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                schedulingMode === 'basic' ? 'bg-surface text-text-primary shadow-sm' : 'text-text-secondary'
              }`}
            >
              {t('productionTimeBasic')}
            </button>
            <button
              type="button"
              onClick={() => setSchedulingMode('advanced')}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                schedulingMode === 'advanced' ? 'bg-surface text-text-primary shadow-sm' : 'text-text-secondary'
              }`}
            >
              {t('productionTimeAdvanced')}
            </button>
          </div>

          {schedulingMode === 'basic' ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                label={t('totalStandardMinutes')}
                type="number"
                dir="ltr"
                value={totalStandardMinutes}
                onChange={(e) => setTotalStandardMinutes(e.target.value)}
                hint={t('totalStandardMinutesHint')}
              />
              <Input
                label={t('bufferPercent')}
                type="number"
                dir="ltr"
                value={profileBufferPercent}
                onChange={(e) => setProfileBufferPercent(e.target.value)}
              />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Input
                  label={t('setupMinutes')}
                  type="number"
                  dir="ltr"
                  value={profileSetupMinutes}
                  onChange={(e) => setProfileSetupMinutes(e.target.value)}
                />
                <Input
                  label={t('complexityFactor')}
                  type="number"
                  dir="ltr"
                  value={complexityFactor}
                  onChange={(e) => setComplexityFactor(e.target.value)}
                />
                <Input
                  label={t('defaultBatchSize')}
                  type="number"
                  dir="ltr"
                  value={defaultBatchSize}
                  onChange={(e) => setDefaultBatchSize(e.target.value)}
                />
                <Input
                  label={t('minimumLeadTimeDays')}
                  type="number"
                  dir="ltr"
                  value={minimumLeadTimeDays}
                  onChange={(e) => setMinimumLeadTimeDays(e.target.value)}
                />
                <Input
                  label={t('bufferPercent')}
                  type="number"
                  dir="ltr"
                  value={profileBufferPercent}
                  onChange={(e) => setProfileBufferPercent(e.target.value)}
                />
              </div>

              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-text-primary">{t('stageEstimates')}</p>
                  <Button
                    size="sm"
                    variant="secondary"
                    leadingIcon={<Plus className="h-4 w-4" />}
                    onClick={() =>
                      setStageEstimates((prev) => [
                        ...prev,
                        {
                          key: `est-${Date.now().toString(36)}-${prev.length}`,
                          stageDefinitionId: '',
                          setupMinutes: '0',
                          minutesPerUnit: '0',
                          fixedMinutes: '0',
                          quantityScalingMode: 'SETUP_PLUS_LINEAR',
                          workerCountRequired: '1',
                          isRequired: true,
                        },
                      ])
                    }
                  >
                    {t('addStageEstimate')}
                  </Button>
                </div>

                {stageEstimates.length === 0 ? (
                  <p className="text-sm text-text-tertiary">{t('noStageEstimates')}</p>
                ) : (
                  <div className="space-y-2">
                    {stageEstimates.map((row, index) => (
                      <div
                        key={row.key}
                        className="grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-6 sm:items-end"
                      >
                        <Select
                          label={t('stage')}
                          className="sm:col-span-2"
                          value={row.stageDefinitionId}
                          onChange={(e) =>
                            setStageEstimates((prev) =>
                              prev.map((r, i) =>
                                i === index ? { ...r, stageDefinitionId: e.target.value } : r,
                              ),
                            )
                          }
                          options={[
                            { value: '', label: t('select') },
                            ...(stagesQuery.data ?? []).map((s) => ({
                              value: s.id,
                              label: localizedName(locale, s, s.code),
                            })),
                          ]}
                        />
                        <Input
                          label={t('setupMinutes')}
                          type="number"
                          dir="ltr"
                          value={row.setupMinutes}
                          onChange={(e) =>
                            setStageEstimates((prev) =>
                              prev.map((r, i) => (i === index ? { ...r, setupMinutes: e.target.value } : r)),
                            )
                          }
                        />
                        <Input
                          label={t('minutesPerUnit')}
                          type="number"
                          dir="ltr"
                          value={row.minutesPerUnit}
                          onChange={(e) =>
                            setStageEstimates((prev) =>
                              prev.map((r, i) =>
                                i === index ? { ...r, minutesPerUnit: e.target.value } : r,
                              ),
                            )
                          }
                        />
                        <Select
                          label={t('quantityScalingMode')}
                          value={row.quantityScalingMode}
                          onChange={(e) =>
                            setStageEstimates((prev) =>
                              prev.map((r, i) =>
                                i === index ? { ...r, quantityScalingMode: e.target.value } : r,
                              ),
                            )
                          }
                          options={QUANTITY_SCALING_MODES.map((mode) => ({
                            value: mode,
                            label: t(`quantityScalingModes.${mode}`),
                          }))}
                        />
                        <div className="flex items-end justify-end gap-1 pb-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              setStageEstimates((prev) => prev.filter((_, i) => i !== index))
                            }
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </Card>
      </MotionSection>

      <MotionSection className="maher-form-section" as="div">
      <Card
        title={tp('workflow.title')}
        description={tp('workflow.subtitle')}
        actions={
          <Button
            size="sm"
            loading={saveProductWorkflowMutation.isPending}
            disabled={!workflowId}
            onClick={() => saveProductWorkflowMutation.mutate()}
          >
            {tCommon('save')}
          </Button>
        }
      >
        <div className="space-y-4">
          <Select
            label={tp('workflow.title')}
            value={workflowId}
            onChange={(e) => setWorkflowId(e.target.value)}
            options={[
              { value: '', label: t('select') },
              ...(workflowsQuery.data ?? []).map((w) => ({
                value: w.id,
                label: `${localizedName(locale, w, w.code)} (${w.code})`,
              })),
            ]}
          />

          {workflowId ? (
            <Link
              href={`/production/workflow/${workflowId}`}
              className="inline-flex text-sm font-medium text-brand hover:underline"
            >
              {t('openAssignedWorkflowChart')}
            </Link>
          ) : null}

          <div className="space-y-2">
            <p className="text-sm font-semibold text-text-primary">{tp('workflow.dependencies')}</p>
            {workflowOverrides.length === 0 ? (
              <p className="text-sm text-text-tertiary">{tp('workflow.emptyStages')}</p>
            ) : (
              workflowOverrides.map((row, index) => (
                <div
                  key={row.key}
                  className="grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-2"
                >
                  <Select
                    label={tp('workflow.stageName')}
                    value={row.stageDefinitionId}
                    onChange={(e) =>
                      setWorkflowOverrides((prev) =>
                        prev.map((r, i) =>
                          i === index ? { ...r, stageDefinitionId: e.target.value } : r,
                        ),
                      )
                    }
                    options={[
                      { value: '', label: t('select') },
                      ...(stageLibraryQuery.data ?? []).map((s) => ({
                        value: s.id,
                        label: localizedName(locale, s, s.code),
                      })),
                    ]}
                  />
                  <Select
                    label={tp('workflow.required')}
                    value={row.applicability}
                    onChange={(e) =>
                      setWorkflowOverrides((prev) =>
                        prev.map((r, i) =>
                          i === index
                            ? {
                                ...r,
                                applicability: e.target.value as
                                  | 'INHERIT'
                                  | 'REQUIRED'
                                  | 'OPTIONAL'
                                  | 'EXCLUDED',
                              }
                            : r,
                        ),
                      )
                    }
                    options={[
                      { value: 'INHERIT', label: tp('workflow.parallel') },
                      { value: 'REQUIRED', label: tp('workflow.required') },
                      { value: 'OPTIONAL', label: tp('workflow.optional') },
                      { value: 'EXCLUDED', label: tp('workflow.excluded') },
                    ]}
                  />
                </div>
              ))
            )}
            <Button
              size="sm"
              variant="secondary"
              leadingIcon={<Plus className="h-4 w-4" />}
              onClick={() =>
                setWorkflowOverrides((prev) => [
                  ...prev,
                  {
                    key: `ov-${Date.now()}`,
                    stageDefinitionId: '',
                    applicability: 'INHERIT',
                  },
                ])
              }
            >
              {tp('workflow.addStage')}
            </Button>
          </div>
        </div>
      </Card>
      </MotionSection>

      {workflowId ? (
        <MotionSection className="maher-form-section" as="div">
          <ProductWorkflowTimes productId={id} workflowId={workflowId} />
        </MotionSection>
      ) : null}

      <MotionSection className="maher-form-section" as="div">
        <ProductProductionSetup productId={id} />
      </MotionSection>

      <MotionSection className="maher-form-section" as="div">
      <Card title={t('adminNotes')}>
        <p className="mb-2 text-sm text-text-secondary">{t('adminNotesHint')}</p>
        <TextArea
          value={adminNotes}
          onChange={(e) => setAdminNotes(e.target.value)}
          placeholder={t('adminNotesPlaceholder')}
          rows={6}
        />
      </Card>
      </MotionSection>

      <MotionSection className="maher-form-section" as="div">
      <Card
        title={t('sellerPrices')}
        actions={
          <Button
            size="sm"
            variant="secondary"
            leadingIcon={<Plus className="h-4 w-4" />}
            onClick={() => {
              setSellerCustomerId('');
              setSellerPrice(basePrice);
              setSellerError(null);
              setSellerOpen(true);
            }}
          >
            {t('addSellerPrice')}
          </Button>
        }
      >
        <p className="mb-3 text-sm text-text-secondary">{t('sellerPricesHint')}</p>
        {(dealerPricesQuery.data ?? []).length === 0 ? (
          <p className="text-sm text-text-tertiary">{tCustomers('noPrices')}</p>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border">
            {(dealerPricesQuery.data ?? []).map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-sm"
              >
                <div className="min-w-0">
                  <p className="font-medium text-text-primary">
                    {row.customer
                      ? localizedName(locale, row.customer, row.customer.name ?? '—')
                      : '—'}
                  </p>
                  <p className="text-xs text-text-tertiary" dir="ltr">
                    {row.customer?.code}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold tabular-nums" dir="ltr">
                    {Number(row.price).toFixed(2)} {row.currency}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => deleteSellerPriceMutation.mutate(row)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
      </MotionSection>

      <Modal
        open={sellerOpen}
        onClose={() => !saveSellerPriceMutation.isPending && setSellerOpen(false)}
        title={t('addSellerPrice')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setSellerOpen(false)}>
              {tCommon('cancel')}
            </Button>
            <Button
              loading={saveSellerPriceMutation.isPending}
              onClick={() => saveSellerPriceMutation.mutate()}
            >
              {tCommon('save')}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          {sellerError ? <Alert variant="error">{sellerError}</Alert> : null}
          <p className="text-xs text-text-tertiary">{t('sellerPricesHint')}</p>
          <Select
            label={t('customer')}
            value={sellerCustomerId}
            onChange={(e) => setSellerCustomerId(e.target.value)}
            options={[
              { value: '', label: t('select') },
              ...(customersQuery.data ?? []).map((c) => ({
                value: c.id,
                label: `${localizedName(locale, c, c.name)} (${c.code})`,
              })),
            ]}
          />
          <Input
            label={tCustomers('dealerPrice')}
            type="number"
            value={sellerPrice}
            onChange={(e) => setSellerPrice(e.target.value)}
            dir="ltr"
          />
        </div>
      </Modal>

      <Modal
        open={measureOpen}
        onClose={() => setMeasureOpen(false)}
        title={t('addMeasurement')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setMeasureOpen(false)}>
              {tCommon('cancel')}
            </Button>
            <Button
              onClick={() => {
                if (!measureNameEn.trim() || !measureNameAr.trim()) {
                  setMeasureError(t('measurementNamesRequired'));
                  return;
                }
                setCustomMeasurements((prev) => [
                  ...prev,
                  {
                    id: `m-${Date.now().toString(36)}`,
                    nameEn: measureNameEn.trim(),
                    nameAr: measureNameAr.trim(),
                    nameHe: measureNameHe.trim(),
                    value: measureValue,
                  },
                ]);
                setMeasureOpen(false);
                setMeasureError(null);
              }}
            >
              {tCommon('add')}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          {measureError ? <Alert variant="error">{measureError}</Alert> : null}
          <Input
            label={t('measurementNameEn')}
            value={measureNameEn}
            onChange={(e) => setMeasureNameEn(e.target.value)}
          />
          <Input
            label={t('measurementNameAr')}
            value={measureNameAr}
            onChange={(e) => setMeasureNameAr(e.target.value)}
          />
          <Input
            label={t('measurementNameHe')}
            value={measureNameHe}
            onChange={(e) => setMeasureNameHe(e.target.value)}
          />
          <Input
            label={t('measurementValue')}
            type="number"
            value={measureValue}
            onChange={(e) => setMeasureValue(e.target.value)}
            dir="ltr"
          />
        </div>
      </Modal>

      <MotionSection enter="rise" className="maher-form-section" as="div">
      <Card
        id="product-bom"
        title={t('bomMaterials')}
        actions={
          <Button
            size="sm"
            variant="secondary"
            className="maher-animate-bounce-in"
            leadingIcon={<Plus className="h-4 w-4" />}
            onClick={() => {
              setPickerReplaceIndex(null);
              setPickerOpen(true);
            }}
          >
            {t('addMaterial')}
          </Button>
        }
      >
        {bomLines.length === 0 ? (
          <p className="maher-animate-fade text-sm text-text-secondary">{t('noBomMaterials')}</p>
        ) : (
          <div className="bom-lines">
            {bomLines.map((line, index) => {
              const apiLine = data.bomLines?.find((b) => b.sku === line.sku);
              const unitCost = apiLine?.unitCost ?? 0;
              const lineCost = (Number(line.qty) || 0) * unitCost;
              const displayName =
                localizedName(locale, {
                  nameEn: line.nameEn ?? apiLine?.nameEn,
                  nameAr: line.nameAr ?? apiLine?.nameAr,
                }) || line.sku;
              return (
                <div
                  key={`${line.sku}-${index}`}
                  className="bom-line-card grid gap-3 sm:grid-cols-[minmax(0,2fr)_100px_100px_100px_auto] sm:items-end"
                >
                  <div className="min-w-0">
                    <p className="mb-1 text-xs text-text-secondary">{t('material')}</p>
                    <p className="truncate text-sm font-semibold text-text-primary">{displayName}</p>
                    <p className="truncate text-xs text-text-secondary" dir="ltr">
                      {line.sku}
                      {line.category ? ` · ${line.category}` : ''}
                    </p>
                    <button
                      type="button"
                      className="bom-change-btn"
                      onClick={() => {
                        setPickerReplaceIndex(index);
                        setPickerOpen(true);
                      }}
                    >
                      <RefreshCw className="bom-change-btn__icon" aria-hidden />
                      {t('changeMaterial')}
                    </button>
                  </div>
                  <Input
                    label={t('qty')}
                    type="number"
                    value={line.qty}
                    onChange={(e) =>
                      setBomLines((prev) =>
                        prev.map((row, i) =>
                          i === index ? { ...row, qty: e.target.value } : row,
                        ),
                      )
                    }
                    dir="ltr"
                  />
                  <div>
                    <p className="mb-1 text-xs text-text-secondary">{t('materialCost')}</p>
                    <p className="py-2 text-sm tabular-nums" dir="ltr">
                      {unitCost > 0 ? unitCost.toFixed(2) : '—'}
                    </p>
                  </div>
                  <div>
                    <p className="mb-1 text-xs text-text-secondary">{t('lineCost')}</p>
                    <p className="py-2 text-sm font-semibold tabular-nums" dir="ltr">
                      {lineCost > 0 ? lineCost.toFixed(2) : '—'}
                    </p>
                  </div>
                  <div className="flex items-end pb-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        setBomLines((prev) => prev.filter((_, i) => i !== index))
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
            <div className="maher-animate-rise flex justify-end border-t border-border pt-3 text-sm">
              <span className="text-text-secondary">{tSales('productionPrice')}:&nbsp;</span>
              <span className="font-bold tabular-nums" dir="ltr">
                {(liveBomCost > 0 ? liveBomCost : productionCost).toFixed(2)}{' '}
                {tCommon('currency')}
              </span>
            </div>
          </div>
        )}
      </Card>
      </MotionSection>

      <BomMaterialPicker
        open={pickerOpen}
        onClose={() => {
          setPickerOpen(false);
          setPickerReplaceIndex(null);
        }}
        excludeSkus={
          pickerReplaceIndex == null
            ? bomLines.map((l) => l.sku)
            : bomLines.filter((_, i) => i !== pickerReplaceIndex).map((l) => l.sku)
        }
        onPick={(mat: PickedMaterial) => {
          const next: BomEditLine = {
            sku: mat.sku,
            qty: '1',
            category: mat.category ?? '',
            nameEn: mat.nameEn,
            nameAr: mat.nameAr,
          };
          if (pickerReplaceIndex == null) {
            setBomLines((prev) => [...prev, next]);
          } else {
            const idx = pickerReplaceIndex;
            setBomLines((prev) =>
              prev.map((row, i) =>
                i === idx
                  ? {
                      ...next,
                      qty: row.qty || '1',
                    }
                  : row,
              ),
            );
          }
          setPickerReplaceIndex(null);
        }}
      />
      </div>
    </div>
  );
}
