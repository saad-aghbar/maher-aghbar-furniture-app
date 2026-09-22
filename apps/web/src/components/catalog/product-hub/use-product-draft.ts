'use client';

import { mutationErrorMessage } from '@/hooks/use-api-mutation';
import { ApiClientError, apiFetch } from '@/lib/api-client';
import type { ProductProductionProfile, ProductStageEstimateRow } from '@/lib/scheduling';
import { useToast } from '@maher/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';
import type { Category } from '../catalog-shared';

export interface StageOption {
  id: string;
  code: string;
  nameAr: string;
  nameEn: string;
  nameHe?: string | null;
}

export interface StageEstimateDraft {
  key: string;
  stageDefinitionId: string;
  setupMinutes: string;
  minutesPerUnit: string;
  fixedMinutes: string;
  quantityScalingMode: string;
  workerCountRequired: string;
  isRequired: boolean;
}

export interface BomLine {
  sku: string;
  qty: number;
  category?: string | null;
  unitCost?: number;
  lineCost?: number;
  nameEn?: string;
  nameAr?: string;
  materialId?: string | null;
  imageUrl?: string | null;
}

export type BomEditLine = { sku: string; qty: string; category: string; nameEn?: string; nameAr?: string; imageUrl?: string | null };

export interface CustomMeasurement {
  id: string;
  nameEn: string;
  nameAr: string;
  nameHe?: string | null;
  value?: string | number | null;
}

export interface ProductDetail {
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
  updatedAt?: string;
}

export interface VariantRow {
  id: string;
  sku: string;
  code: string;
  nameAr: string;
  nameEn: string;
  nameHe?: string | null;
  isDefault: boolean;
  isActive: boolean;
}

export interface DealerPriceRow {
  id: string;
  price: string | number;
  currency: string;
  customerId?: string;
  customer?: { id: string; code?: string; name?: string; nameAr?: string | null; nameEn?: string | null; nameHe?: string | null };
}

export type Applicability = 'INHERIT' | 'REQUIRED' | 'OPTIONAL' | 'EXCLUDED';
export interface WorkflowOverrideDraft {
  key: string;
  stageDefinitionId: string;
  applicability: Applicability;
}

const num = (v: string) => (v.trim() === '' ? null : Number(v));

/** All product-hub state: identity draft, BOM, production profile, workflow config, and the saves. */
export function useProductDraft(id: string) {
  const t = useTranslations('catalog');
  const tCommon = useTranslations('common');
  const toast = useToast();
  const qc = useQueryClient();

  const product = useQuery({ queryKey: ['product', id], queryFn: () => apiFetch<ProductDetail>(`/api/v1/products/${id}`) });
  const variants = useQuery({ queryKey: ['product-variants', id], queryFn: () => apiFetch<VariantRow[]>(`/api/v1/products/${id}/variants?includeInactive=true`) });
  const categories = useQuery({ queryKey: ['product-categories'], queryFn: () => apiFetch<{ data: Category[] }>('/api/v1/product-categories?pageSize=100').then((r) => r.data) });
  const stages = useQuery({
    queryKey: ['production-stages', 'for-product-time'],
    queryFn: () => apiFetch<{ data: StageOption[] } | StageOption[]>('/api/v1/production-stages?pageSize=200').then((r) => (Array.isArray(r) ? r : r.data)),
    staleTime: 60_000,
  });
  const profile = useQuery({ queryKey: ['product-production-profile', id], queryFn: () => apiFetch<ProductProductionProfile>(`/api/v1/scheduling/products/${id}/production-profile`), retry: false });
  const estimates = useQuery({ queryKey: ['product-stage-estimates', id], queryFn: () => apiFetch<ProductStageEstimateRow[]>(`/api/v1/scheduling/products/${id}/stage-estimates`), retry: false });
  const workflows = useQuery({ queryKey: ['production-workflows'], queryFn: () => apiFetch<Array<{ id: string; code: string; nameEn: string; nameAr: string; nameHe?: string | null }>>('/api/v1/production-workflows') });
  const workflowConfig = useQuery({
    queryKey: ['product-workflow-configuration', id],
    queryFn: () => apiFetch<{ workflowId: string; stageOverrides: Array<{ stageDefinitionId: string; applicability: Applicability }> } | null>(`/api/v1/products/${id}/workflow-configuration`),
    retry: false,
  });
  const stageLibrary = useQuery({ queryKey: ['production-stage-library'], queryFn: () => apiFetch<StageOption[]>('/api/v1/production-stage-library'), staleTime: 60_000 });
  const dealerPrices = useQuery({ queryKey: ['product-dealer-prices', id], queryFn: () => apiFetch<DealerPriceRow[]>(`/api/v1/products/${id}/dealer-prices`) });

  // ── identity draft ────────────────────────────────────────────────────────
  const [nameEn, setNameEn] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [nameHe, setNameHe] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [basePrice, setBasePrice] = useState<number | null>(null);
  const [photos, setPhotos] = useState<string[]>([]);
  const [description, setDescription] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  const [width, setWidth] = useState<number | null>(null);
  const [height, setHeight] = useState<number | null>(null);
  const [depth, setDepth] = useState<number | null>(null);
  const [seatHeight, setSeatHeight] = useState<number | null>(null);
  const [customMeasurements, setCustomMeasurements] = useState<CustomMeasurement[]>([]);
  const [bomLines, setBomLines] = useState<BomEditLine[]>([]);
  const [isActive, setIsActive] = useState(true);

  // ── production profile ────────────────────────────────────────────────────
  const [schedulingMode, setSchedulingMode] = useState<'basic' | 'advanced'>('basic');
  const [isSchedulingEnabled, setIsSchedulingEnabled] = useState(true);
  const [totalStandardMinutes, setTotalStandardMinutes] = useState('');
  const [profileSetupMinutes, setProfileSetupMinutes] = useState('');
  const [complexityFactor, setComplexityFactor] = useState('1');
  const [defaultBatchSize, setDefaultBatchSize] = useState('1');
  const [minimumLeadTimeDays, setMinimumLeadTimeDays] = useState('');
  const [profileBufferPercent, setProfileBufferPercent] = useState('10');
  const [stageEstimates, setStageEstimates] = useState<StageEstimateDraft[]>([]);

  // ── workflow config ───────────────────────────────────────────────────────
  const [workflowId, setWorkflowId] = useState('');
  const [workflowOverrides, setWorkflowOverrides] = useState<WorkflowOverrideDraft[]>([]);

  const data = product.data;
  useEffect(() => {
    if (!data) return;
    setNameEn(data.nameEn);
    setNameAr(data.nameAr);
    setNameHe(data.nameHe ?? '');
    setCategoryId(data.categoryId ?? null);
    setBasePrice(data.basePrice != null && data.basePrice !== '' ? Number(data.basePrice) : null);
    const merged: string[] = [];
    const add = (u?: string | null) => {
      const v = u?.trim();
      if (v && !merged.includes(v)) merged.push(v);
    };
    add(data.imageUrl);
    for (const g of data.galleryUrls ?? []) add(g);
    setPhotos(merged);
    setDescription(data.description ?? '');
    setWidth(data.width != null ? Number(data.width) : null);
    setHeight(data.height != null ? Number(data.height) : null);
    setDepth(data.depth != null ? Number(data.depth) : null);
    setSeatHeight(data.seatHeight != null ? Number(data.seatHeight) : null);
    setAdminNotes(data.adminNotes ?? '');
    setCustomMeasurements((data.customMeasurements ?? []).map((m, i) => ({ id: m.id || `m-${i}`, nameEn: m.nameEn, nameAr: m.nameAr, nameHe: m.nameHe ?? '', value: m.value ?? '' })));
    setIsActive(data.isActive);
    const lines = data.bomLines?.length ? data.bomLines : (data.bomDefaults?.materials ?? []);
    setBomLines(lines.filter((l) => l.sku).map((l) => ({ sku: l.sku ?? '', qty: String(l.qty ?? ''), category: l.category ?? '', nameEn: l.nameEn, nameAr: l.nameAr, imageUrl: 'imageUrl' in l ? (l.imageUrl ?? null) : null })));
  }, [data]);

  useEffect(() => {
    const p = profile.data;
    if (!p) return;
    setIsSchedulingEnabled(p.isSchedulingEnabled);
    setTotalStandardMinutes(p.totalStandardMinutes != null ? String(p.totalStandardMinutes) : '');
    setProfileSetupMinutes(String(p.setupMinutes ?? 0));
    setComplexityFactor(String(p.complexityFactor ?? 1));
    setDefaultBatchSize(String(p.defaultBatchSize ?? 1));
    setMinimumLeadTimeDays(p.minimumLeadTimeDays != null ? String(p.minimumLeadTimeDays) : '');
    setProfileBufferPercent(String(p.bufferPercent ?? 10));
  }, [profile.data]);

  useEffect(() => {
    const rows = estimates.data ?? [];
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
  }, [estimates.data]);

  useEffect(() => {
    const cfg = workflowConfig.data;
    if (!cfg) return;
    setWorkflowId(cfg.workflowId);
    setWorkflowOverrides((cfg.stageOverrides ?? []).map((o, i) => ({ key: `ov-${i}`, stageDefinitionId: o.stageDefinitionId, applicability: o.applicability })));
  }, [workflowConfig.data]);

  const liveBomCost = useMemo(
    () => bomLines.reduce((sum, line) => sum + (Number(line.qty) || 0) * (data?.bomLines?.find((b) => b.sku === line.sku)?.unitCost ?? 0), 0),
    [bomLines, data?.bomLines],
  );

  const computedStageMinutes = useMemo(
    () =>
      stageEstimates.reduce((sum, row) => {
        const setup = Number(row.setupMinutes || 0);
        const per = Number(row.minutesPerUnit || 0);
        const fixed = Number(row.fixedMinutes || 0);
        if (row.quantityScalingMode === 'FIXED') return sum + fixed;
        if (row.quantityScalingMode === 'LINEAR') return sum + per;
        return sum + setup + per;
      }, 0),
    [stageEstimates],
  );

  const dirty = useMemo(() => {
    if (!data) return false;
    const photosNow = [data.imageUrl, ...(data.galleryUrls ?? [])].filter(Boolean).join('|');
    return (
      nameEn !== data.nameEn ||
      nameAr !== data.nameAr ||
      nameHe !== (data.nameHe ?? '') ||
      (categoryId ?? null) !== (data.categoryId ?? null) ||
      (basePrice ?? null) !== (data.basePrice != null && data.basePrice !== '' ? Number(data.basePrice) : null) ||
      photos.join('|') !== photosNow ||
      description !== (data.description ?? '') ||
      adminNotes !== (data.adminNotes ?? '') ||
      isActive !== data.isActive ||
      (width ?? null) !== (data.width != null ? Number(data.width) : null) ||
      (height ?? null) !== (data.height != null ? Number(data.height) : null) ||
      (depth ?? null) !== (data.depth != null ? Number(data.depth) : null) ||
      (seatHeight ?? null) !== (data.seatHeight != null ? Number(data.seatHeight) : null) ||
      JSON.stringify(customMeasurements.map((m) => [m.nameEn, m.nameAr, m.nameHe ?? '', String(m.value ?? '')])) !==
        JSON.stringify((data.customMeasurements ?? []).map((m) => [m.nameEn, m.nameAr, m.nameHe ?? '', String(m.value ?? '')])) ||
      JSON.stringify(bomLines.map((l) => [l.sku, Number(l.qty) || 0])) !==
        JSON.stringify((data.bomLines?.length ? data.bomLines : (data.bomDefaults?.materials ?? [])).filter((l) => l.sku).map((l) => [l.sku, Number(l.qty) || 0]))
    );
  }, [data, nameEn, nameAr, nameHe, categoryId, basePrice, photos, description, adminNotes, isActive, width, height, depth, seatHeight, customMeasurements, bomLines]);

  const save = useMutation({
    mutationFn: async () => {
      if (!nameEn.trim() || !nameAr.trim()) throw new ApiClientError(t('namesRequired'), 400);
      return apiFetch<ProductDetail>(`/api/v1/products/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          nameEn: nameEn.trim(),
          nameAr: nameAr.trim(),
          nameHe: nameHe.trim() || null,
          categoryId: categoryId || null,
          basePrice: basePrice ?? null,
          imageUrl: photos[0] || null,
          galleryUrls: photos.slice(1),
          description: description.trim() || null,
          width,
          height,
          depth,
          seatHeight,
          adminNotes: adminNotes.trim() || null,
          customMeasurements: customMeasurements.map((m) => ({
            id: m.id,
            nameEn: m.nameEn.trim(),
            nameAr: m.nameAr.trim(),
            nameHe: String(m.nameHe ?? '').trim() || undefined,
            value: m.value !== '' && m.value != null && Number.isFinite(Number(m.value)) ? Number(m.value) : null,
          })),
          isActive,
          bomDefaults: { materials: bomLines.filter((l) => l.sku.trim()).map((l) => ({ sku: l.sku.trim(), qty: Number(l.qty) || 0, category: l.category || undefined })) },
        }),
      });
    },
    onSuccess: async () => {
      toast.success(tCommon('saved'));
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['product', id] }),
        qc.invalidateQueries({ queryKey: ['products'] }),
        qc.invalidateQueries({ queryKey: ['product-production-setup', id] }),
        qc.invalidateQueries({ queryKey: ['product-production-setup-preview', id] }),
      ]);
    },
    onError: (err) => toast.error(mutationErrorMessage(err)),
  });

  const saveProfile = useMutation({
    mutationFn: async () => {
      await apiFetch(`/api/v1/scheduling/products/${id}/production-profile`, {
        method: 'PATCH',
        body: JSON.stringify({
          isSchedulingEnabled,
          totalStandardMinutes: num(totalStandardMinutes),
          setupMinutes: Number(profileSetupMinutes) || 0,
          complexityFactor: Number(complexityFactor) || 1,
          defaultBatchSize: Number(defaultBatchSize) || 1,
          minimumLeadTimeDays: num(minimumLeadTimeDays),
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
        if (items.length > 0) await apiFetch(`/api/v1/scheduling/products/${id}/stage-estimates`, { method: 'PATCH', body: JSON.stringify({ items }) });
      }
    },
    onSuccess: async () => {
      toast.success(t('productionProfileSaved'));
      await Promise.all([qc.invalidateQueries({ queryKey: ['product-production-profile', id] }), qc.invalidateQueries({ queryKey: ['product-stage-estimates', id] })]);
    },
    onError: (err) => toast.error(mutationErrorMessage(err)),
  });

  const saveWorkflow = useMutation({
    mutationFn: () =>
      apiFetch(`/api/v1/products/${id}/workflow-configuration`, {
        method: 'PATCH',
        body: JSON.stringify({ workflowId, overrides: workflowOverrides.filter((o) => o.stageDefinitionId).map((o) => ({ stageDefinitionId: o.stageDefinitionId, applicability: o.applicability })) }),
      }),
    onSuccess: async () => {
      toast.success(tCommon('saved'));
      await Promise.all([qc.invalidateQueries({ queryKey: ['product-workflow-configuration', id] }), qc.invalidateQueries({ queryKey: ['product-production-setup', id] })]);
    },
    onError: (err) => toast.error(mutationErrorMessage(err)),
  });

  return {
    id,
    queries: { product, variants, categories, stages, profile, estimates, workflows, workflowConfig, stageLibrary, dealerPrices },
    data,
    dirty,
    liveBomCost,
    computedStageMinutes,
    identity: { nameEn, setNameEn, nameAr, setNameAr, nameHe, setNameHe, categoryId, setCategoryId, basePrice, setBasePrice, photos, setPhotos, description, setDescription, adminNotes, setAdminNotes, isActive, setIsActive },
    dims: { width, setWidth, height, setHeight, depth, setDepth, seatHeight, setSeatHeight, customMeasurements, setCustomMeasurements },
    bom: { bomLines, setBomLines },
    profileDraft: {
      schedulingMode,
      setSchedulingMode,
      isSchedulingEnabled,
      setIsSchedulingEnabled,
      totalStandardMinutes,
      setTotalStandardMinutes,
      profileSetupMinutes,
      setProfileSetupMinutes,
      complexityFactor,
      setComplexityFactor,
      defaultBatchSize,
      setDefaultBatchSize,
      minimumLeadTimeDays,
      setMinimumLeadTimeDays,
      profileBufferPercent,
      setProfileBufferPercent,
      stageEstimates,
      setStageEstimates,
    },
    workflow: { workflowId, setWorkflowId, workflowOverrides, setWorkflowOverrides },
    save,
    saveProfile,
    saveWorkflow,
  };
}

export type ProductDraft = ReturnType<typeof useProductDraft>;
