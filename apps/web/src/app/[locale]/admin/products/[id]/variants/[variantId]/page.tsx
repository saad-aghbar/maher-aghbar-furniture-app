'use client';

import { useCatalogCopy } from '@/components/catalog/catalog-shared';
import { ProductProductionSetup } from '@/components/catalog/product-production-setup';
import { ProductWorkflowTimes } from '@/components/workflow/product-workflow-times';
import { Link } from '@/i18n/navigation';
import { mutationErrorMessage } from '@/hooks/use-api-mutation';
import { apiFetch } from '@/lib/api-client';
import { useKitCopy } from '@/lib/kit-copy';
import { localizedName } from '@maher/i18n';
import {
  Board,
  BoardSkeleton,
  Button,
  Combobox,
  ConfirmDialog,
  DetailHero,
  ErrorBoard,
  Figure,
  FormFooter,
  Input,
  Ledger,
  LedgerRow,
  Menu,
  Meter,
  MoneyField,
  NumberField,
  SectionTabs,
  Stamp,
  TextArea,
  useToast,
} from '@maher/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, MoreHorizontal, Plus, RefreshCw, Star, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

type SpecGroup = { id: string; code: string; nameEn: string; nameAr: string; nameHe?: string | null; isActive: boolean };
type SpecValue = { id: string; groupId: string; code: string; nameEn: string; nameAr: string; nameHe?: string | null; isActive: boolean };

type VariantDetail = {
  id: string;
  productId: string;
  sku: string;
  code: string;
  nameAr: string;
  nameEn: string;
  nameHe?: string | null;
  isDefault: boolean;
  isActive: boolean;
  basePrice?: number | string | null;
  manufacturingCost?: number | string | null;
  measurements?: Array<{ key: string; labelAr?: string | null; labelEn?: string | null; value?: number | string | null; unit: string }>;
  composition?: Array<{ labelAr?: string | null; labelEn?: string | null; qty: number }>;
  includedItems?: Array<{ nameAr?: string | null; nameEn?: string | null; qty: number; width?: number | null; height?: number | null; unit?: string | null }>;
  factoryNotesAr?: string | null;
  factoryNotesEn?: string | null;
  factoryNotesHe?: string | null;
  workflowId?: string | null;
  options?: Array<{ specOptionValueId: string; specOptionValue?: { groupId: string } }>;
  product?: { nameAr: string; nameEn: string; nameHe?: string | null };
};

type VariantCost = {
  materials: { total: number; breakdown?: Array<{ sku?: string; nameEn?: string; nameAr?: string; qty?: number; unitCost?: number; lineCost?: number }> };
  labor: { minutes: number; hours: number; cost: number };
  manufacturingCost: number;
};

type MeasureRow = { key: string; labelAr: string; labelEn: string; value: string; unit: string };
type PieceRow = { labelAr: string; labelEn: string; qty: string };
type IncludedRow = { nameAr: string; nameEn: string; qty: string; width: string; height: string; unit: string };

const TABS = ['spec', 'cost', 'setup'] as const;

export default function ProductVariantEditorPage() {
  const params = useParams<{ id: string; variantId: string }>();
  const productId = params.id;
  const variantId = params.variantId;
  const t = useTranslations('catalog');
  const tCommon = useTranslations('common');
  const tSales = useTranslations('sales');
  const copy = useCatalogCopy();
  const kit = useKitCopy();
  const toast = useToast();
  const qc = useQueryClient();
  const router = useRouter();
  const [tab, setTab] = useState<(typeof TABS)[number]>('spec');
  const [confirm, setConfirm] = useState<'copy' | 'deactivate' | null>(null);

  const [nameAr, setNameAr] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [nameHe, setNameHe] = useState('');
  const [basePrice, setBasePrice] = useState<number | null>(null);
  const [measurements, setMeasurements] = useState<MeasureRow[]>([]);
  const [composition, setComposition] = useState<PieceRow[]>([]);
  const [included, setIncluded] = useState<IncludedRow[]>([]);
  const [optionByGroup, setOptionByGroup] = useState<Record<string, string>>({});
  const [factoryNotesAr, setFactoryNotesAr] = useState('');
  const [factoryNotesEn, setFactoryNotesEn] = useState('');
  const [factoryNotesHe, setFactoryNotesHe] = useState('');

  const variant = useQuery({ queryKey: ['product-variant', productId, variantId], queryFn: () => apiFetch<VariantDetail>(`/api/v1/products/${productId}/variants/${variantId}`) });
  const product = useQuery({ queryKey: ['product', productId], queryFn: () => apiFetch<{ nameAr: string; nameEn: string; nameHe?: string | null; sku: string }>(`/api/v1/products/${productId}`) });
  const groups = useQuery({ queryKey: ['spec-option-groups'], queryFn: () => apiFetch<{ data: SpecGroup[] }>('/api/v1/spec-option-groups?pageSize=50').then((r) => r.data) });
  const values = useQuery({ queryKey: ['spec-option-values'], queryFn: () => apiFetch<{ data: SpecValue[] }>('/api/v1/spec-option-values?pageSize=200').then((r) => r.data) });
  const cost = useQuery({ queryKey: ['product-variant-cost', productId, variantId], queryFn: () => apiFetch<VariantCost>(`/api/v1/products/${productId}/variants/${variantId}/cost`), enabled: tab === 'cost' });

  useEffect(() => {
    const v = variant.data;
    if (!v) return;
    setNameAr(v.nameAr);
    setNameEn(v.nameEn);
    setNameHe(v.nameHe ?? '');
    setBasePrice(v.basePrice != null && v.basePrice !== '' ? Number(v.basePrice) : null);
    setMeasurements((v.measurements ?? []).map((m, i) => ({ key: m.key || `m-${i}`, labelAr: m.labelAr ?? '', labelEn: m.labelEn ?? '', value: m.value == null ? '' : String(m.value), unit: m.unit || 'cm' })));
    setComposition((v.composition ?? []).map((r) => ({ labelAr: r.labelAr ?? '', labelEn: r.labelEn ?? '', qty: String(r.qty ?? 1) })));
    setIncluded((v.includedItems ?? []).map((r) => ({ nameAr: r.nameAr ?? '', nameEn: r.nameEn ?? '', qty: String(r.qty ?? 1), width: r.width != null ? String(r.width) : '', height: r.height != null ? String(r.height) : '', unit: r.unit || 'cm' })));
    const map: Record<string, string> = {};
    for (const opt of v.options ?? []) if (opt.specOptionValue?.groupId) map[opt.specOptionValue.groupId] = opt.specOptionValueId;
    setOptionByGroup(map);
    setFactoryNotesAr(v.factoryNotesAr ?? '');
    setFactoryNotesEn(v.factoryNotesEn ?? '');
    setFactoryNotesHe(v.factoryNotesHe ?? '');
  }, [variant.data]);

  const dirty = useMemo(() => {
    const v = variant.data;
    if (!v) return false;
    const base = v.basePrice != null && v.basePrice !== '' ? Number(v.basePrice) : null;
    return (
      nameAr !== v.nameAr ||
      nameEn !== v.nameEn ||
      nameHe !== (v.nameHe ?? '') ||
      basePrice !== base ||
      factoryNotesAr !== (v.factoryNotesAr ?? '') ||
      factoryNotesEn !== (v.factoryNotesEn ?? '') ||
      factoryNotesHe !== (v.factoryNotesHe ?? '') ||
      JSON.stringify(measurements) !== JSON.stringify((v.measurements ?? []).map((m, i) => ({ key: m.key || `m-${i}`, labelAr: m.labelAr ?? '', labelEn: m.labelEn ?? '', value: m.value == null ? '' : String(m.value), unit: m.unit || 'cm' }))) ||
      JSON.stringify(composition) !== JSON.stringify((v.composition ?? []).map((r) => ({ labelAr: r.labelAr ?? '', labelEn: r.labelEn ?? '', qty: String(r.qty ?? 1) }))) ||
      JSON.stringify(included) !== JSON.stringify((v.includedItems ?? []).map((r) => ({ nameAr: r.nameAr ?? '', nameEn: r.nameEn ?? '', qty: String(r.qty ?? 1), width: r.width != null ? String(r.width) : '', height: r.height != null ? String(r.height) : '', unit: r.unit || 'cm' }))) ||
      JSON.stringify(Object.values(optionByGroup).filter(Boolean).sort()) !== JSON.stringify((v.options ?? []).map((o) => o.specOptionValueId).sort())
    );
  }, [variant.data, nameAr, nameEn, nameHe, basePrice, factoryNotesAr, factoryNotesEn, factoryNotesHe, measurements, composition, included, optionByGroup]);

  const invalidate = () => Promise.all([qc.invalidateQueries({ queryKey: ['product-variant', productId, variantId] }), qc.invalidateQueries({ queryKey: ['product-variants', productId] }), qc.invalidateQueries({ queryKey: ['product-variant-cost', productId, variantId] })]);

  const save = useMutation({
    mutationFn: () =>
      apiFetch(`/api/v1/products/${productId}/variants/${variantId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          nameAr,
          nameEn: nameEn.trim() || undefined,
          nameHe: nameHe.trim() || null,
          basePrice,
          measurements: measurements.map((m) => ({ key: m.key, labelAr: m.labelAr, labelEn: m.labelEn, value: m.value === '' ? null : Number(m.value), unit: m.unit })),
          composition: composition.map((r) => ({ labelAr: r.labelAr, labelEn: r.labelEn, qty: Number(r.qty) || 1 })),
          includedItems: included.map((r) => ({ nameAr: r.nameAr, nameEn: r.nameEn, qty: Number(r.qty) || 1, width: r.width ? Number(r.width) : null, height: r.height ? Number(r.height) : null, unit: r.unit })),
          factoryNotesAr: factoryNotesAr || null,
          factoryNotesEn: factoryNotesEn || null,
          factoryNotesHe: factoryNotesHe || null,
          options: Object.values(optionByGroup).filter(Boolean).map((specOptionValueId) => ({ specOptionValueId })),
        }),
      }),
    onSuccess: async () => {
      toast.success(t('variantSaved'));
      await invalidate();
    },
    onError: (err) => toast.error(mutationErrorMessage(err)),
  });
  const copyFromStandard = useMutation({
    mutationFn: () => apiFetch(`/api/v1/products/${productId}/variants/${variantId}/copy-from-standard`, { method: 'POST' }),
    onSuccess: async () => {
      setConfirm(null);
      toast.success(t('variantSaved'));
      await invalidate();
    },
    onError: (err) => toast.error(mutationErrorMessage(err)),
  });
  const duplicate = useMutation({
    mutationFn: () => apiFetch<{ id: string }>(`/api/v1/products/${productId}/variants/${variantId}/duplicate`, { method: 'POST' }),
    onSuccess: async (row) => {
      await invalidate();
      router.push(`/${copy.locale}/admin/products/${productId}/variants/${row.id}`);
    },
    onError: (err) => toast.error(mutationErrorMessage(err)),
  });
  const deactivate = useMutation({
    mutationFn: () => apiFetch(`/api/v1/products/${productId}/variants/${variantId}/deactivate`, { method: 'POST' }),
    onSuccess: async () => {
      setConfirm(null);
      await invalidate();
      router.push(`/${copy.locale}/admin/products/${productId}?tab=variants`);
    },
    onError: (err) => toast.error(mutationErrorMessage(err)),
  });
  const makeDefault = useMutation({
    mutationFn: () => apiFetch(`/api/v1/products/${productId}/variants/${variantId}`, { method: 'PATCH', body: JSON.stringify({ isDefault: true }) }),
    onSuccess: async () => {
      toast.success(tCommon('saved'));
      await invalidate();
    },
    onError: (err) => toast.error(mutationErrorMessage(err)),
  });

  if (variant.isLoading) return <BoardSkeleton rows={6} />;
  if (variant.isError || !variant.data) return <ErrorBoard title={t('editVariant')} description={mutationErrorMessage(variant.error)} onRetry={() => variant.refetch()} />;
  const v = variant.data;
  const productName = product.data ? localizedName(copy.locale, product.data) : '';
  const mfg = Number(v.manufacturingCost ?? cost.data?.manufacturingCost ?? NaN);
  const margin = copy.margin(basePrice, mfg);
  const activeGroups = (groups.data ?? []).filter((g) => g.isActive);
  const chosen = activeGroups.filter((g) => optionByGroup[g.id]).length;

  return (
    <div className="maher-stagger space-y-5 pb-24 md:pb-0">
      <DetailHero
        back={{ label: productName || t('products'), href: `/admin/products/${productId}?tab=variants` }}
        LinkComponent={Link}
        code={v.sku}
        title={localizedName(copy.locale, { nameAr, nameEn, nameHe }) || v.code}
        subtitle={productName ? `${productName} · ${v.code}` : v.code}
        status={v.isDefault ? { label: t('defaultVariant'), tone: 'warning' } : { label: v.isActive ? t('active') : t('variantInactive'), tone: v.isActive ? 'success' : 'neutral' }}
        facts={[
          { label: t('basePrice'), value: copy.money(basePrice), ltr: true },
          { label: tSales('productionPrice'), value: copy.money(Number.isFinite(mfg) ? mfg : null), ltr: true },
          { label: tSales('profit'), value: margin == null ? '—' : `${margin}%`, ltr: true, tone: margin == null ? undefined : margin < 0 ? 'error' : margin < 20 ? 'warning' : 'success' },
          { label: t('measurements'), value: String(measurements.length), ltr: true },
          { label: tSales('desk.options'), value: `${chosen}/${activeGroups.length}`, ltr: true },
        ]}
        primary={
          <Button loading={save.isPending} disabled={!dirty} onClick={() => save.mutate()}>
            {tCommon('save')}
          </Button>
        }
        actions={
          <Menu
            aria-label={tCommon('more')}
            trigger={<Button variant="secondary" aria-label={tCommon('more')}><MoreHorizontal className="h-4 w-4" /></Button>}
            items={[
              { id: 'copy', label: t('copyFromStandard'), icon: <RefreshCw className="h-4 w-4" />, hint: t('copyFromStandardHint'), disabled: v.isDefault, onSelect: () => setConfirm('copy') },
              { id: 'default', label: t('defaultVariant'), icon: <Star className="h-4 w-4" />, disabled: v.isDefault || !v.isActive, onSelect: () => makeDefault.mutate() },
              { id: 'dup', label: t('duplicateVariant'), icon: <Copy className="h-4 w-4" />, onSelect: () => duplicate.mutate() },
              { id: 'off', label: t('deactivateVariant'), tone: 'error', separator: true, disabled: v.isDefault || !v.isActive, onSelect: () => setConfirm('deactivate') },
            ]}
          />
        }
      >
        <SectionTabs
          size="sm"
          aria-label={t('editVariant')}
          value={tab}
          onChange={(id) => setTab(id as (typeof TABS)[number])}
          items={[
            { id: 'spec', label: tSales('desk.tabSpec') },
            { id: 'cost', label: t('costs') },
            { id: 'setup', label: tSales('desk.tabSetup') },
          ]}
        />
      </DetailHero>

      {tab === 'spec' ? (
        <div className="grid gap-5 xl:grid-cols-2">
          <Board tone="brand" wash="top">
            <Board.Header title={t('editVariant')} description={t('variantsHint')} />
            <Board.Body className="grid gap-4 sm:grid-cols-2">
              <Input label={t('variantNameAr')} value={nameAr} onChange={(e) => setNameAr(e.target.value)} dir="rtl" />
              <Input label={t('englishOptional')} value={nameEn} onChange={(e) => setNameEn(e.target.value)} dir="ltr" />
              <Input label={t('nameHe')} value={nameHe} onChange={(e) => setNameHe(e.target.value)} dir="rtl" />
              <MoneyField label={t('basePrice')} currency="ILS" value={basePrice} onChange={setBasePrice} min={0} />
              <Input label={t('variantCode')} value={v.code} disabled dir="ltr" />
              <Input label={t('sku')} value={v.sku} disabled dir="ltr" />
            </Board.Body>
          </Board>

          <Board tone="info">
            <Board.Header title={tSales('desk.options')} description={tSales('desk.optionsHint')} />
            {activeGroups.length === 0 ? (
              <Board.Empty title={t('noSpecOption')} />
            ) : (
              <Board.Body className="grid gap-4 sm:grid-cols-2">
                {activeGroups.map((group) => (
                  <Combobox
                    key={group.id}
                    label={localizedName(copy.locale, group)}
                    value={optionByGroup[group.id] || null}
                    onChange={(val) => setOptionByGroup((prev) => ({ ...prev, [group.id]: val ?? '' }))}
                    options={(values.data ?? []).filter((x) => x.groupId === group.id && x.isActive).map((x) => ({ value: x.id, label: localizedName(copy.locale, x), description: x.code }))}
                    placeholder={t('noSpecOption')}
                    emptyText={kit.combobox.empty}
                    clearLabel={kit.combobox.clear}
                  />
                ))}
              </Board.Body>
            )}
          </Board>

          <RowsBoard<MeasureRow>
            title={t('measurements')}
            addLabel={t('addMeasurementRow')}
            rows={measurements}
            setRows={setMeasurements}
            blank={() => ({ key: `m-${Date.now()}`, labelAr: '', labelEn: '', value: '', unit: 'cm' })}
            render={(row, patch) => (
              <>
                <Input aria-label={t('variantNameAr')} placeholder={t('variantNameAr')} value={row.labelAr} onChange={(e) => patch({ labelAr: e.target.value })} dir="rtl" />
                <Input aria-label={t('englishOptional')} placeholder={t('englishOptional')} value={row.labelEn} onChange={(e) => patch({ labelEn: e.target.value })} dir="ltr" />
                <NumberField aria-label={t('measurementValue')} placeholder={t('measurementValue')} value={row.value === '' ? null : Number(row.value)} onChange={(n) => patch({ value: n == null ? '' : String(n) })} unit={row.unit} decimals={2} />
              </>
            )}
            columns="sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_140px_auto]"
          />

          <RowsBoard<PieceRow>
            title={t('composition')}
            description={t('compositionHint')}
            addLabel={t('addCompositionRow')}
            rows={composition}
            setRows={setComposition}
            blank={() => ({ labelAr: '', labelEn: '', qty: '1' })}
            render={(row, patch) => (
              <>
                <Input aria-label={t('variantNameAr')} placeholder={t('variantNameAr')} value={row.labelAr} onChange={(e) => patch({ labelAr: e.target.value })} dir="rtl" />
                <Input aria-label={t('englishOptional')} placeholder={t('englishOptional')} value={row.labelEn} onChange={(e) => patch({ labelEn: e.target.value })} dir="ltr" />
                <NumberField aria-label={t('variantQty')} value={row.qty === '' ? null : Number(row.qty)} onChange={(n) => patch({ qty: n == null ? '' : String(n) })} min={1} />
              </>
            )}
            columns="sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_110px_auto]"
          />

          <RowsBoard<IncludedRow>
            title={t('includedItems')}
            description={t('includedItemsHint')}
            addLabel={t('addIncludedItem')}
            rows={included}
            setRows={setIncluded}
            blank={() => ({ nameAr: '', nameEn: '', qty: '1', width: '', height: '', unit: 'cm' })}
            render={(row, patch) => (
              <>
                <Input aria-label={t('variantNameAr')} placeholder={t('variantNameAr')} value={row.nameAr} onChange={(e) => patch({ nameAr: e.target.value })} dir="rtl" />
                <NumberField aria-label={t('variantQty')} value={row.qty === '' ? null : Number(row.qty)} onChange={(n) => patch({ qty: n == null ? '' : String(n) })} min={1} />
                <NumberField aria-label={t('width')} placeholder={t('width')} value={row.width === '' ? null : Number(row.width)} onChange={(n) => patch({ width: n == null ? '' : String(n) })} unit={row.unit} />
                <NumberField aria-label={t('height')} placeholder={t('height')} value={row.height === '' ? null : Number(row.height)} onChange={(n) => patch({ height: n == null ? '' : String(n) })} unit={row.unit} />
              </>
            )}
            columns="sm:grid-cols-[minmax(0,1fr)_90px_120px_120px_auto]"
          />

          <Board tone="neutral" className="xl:col-span-2">
            <Board.Header title={t('factoryNotes')} description={t('factoryNotesHint')} />
            <Board.Body className="grid gap-4 lg:grid-cols-3">
              <TextArea autoGrow label={t('factoryNotesAr')} value={factoryNotesAr} onChange={(e) => setFactoryNotesAr(e.target.value)} rows={4} dir="rtl" />
              <TextArea autoGrow label={t('factoryNotesEn')} value={factoryNotesEn} onChange={(e) => setFactoryNotesEn(e.target.value)} rows={4} dir="ltr" />
              <TextArea autoGrow label={t('factoryNotesHe')} value={factoryNotesHe} onChange={(e) => setFactoryNotesHe(e.target.value)} rows={4} dir="rtl" />
            </Board.Body>
          </Board>
        </div>
      ) : null}

      {tab === 'cost' ? (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
          <Board tone={margin != null && margin < 0 ? 'error' : margin != null && margin < 20 ? 'warning' : 'success'} wash="top">
            <Board.Header title={t('costs')} actions={<Button size="sm" variant="secondary" leadingIcon={<RefreshCw className="h-4 w-4" />} loading={cost.isFetching} onClick={() => cost.refetch()}>{tSales('desk.recalculate')}</Button>} />
            <Board.Body className="space-y-4">
              {cost.isLoading ? (
                <BoardSkeleton header={false} rows={3} />
              ) : cost.data ? (
                <>
                  <Figure value={copy.money(cost.data.manufacturingCost)} label={tSales('productionPrice')} locale={copy.locale} />
                  <Ledger>
                    <LedgerRow label={t('bomMaterials')} value={copy.money(cost.data.materials.total)} tone="brand" stamp />
                    <LedgerRow label={tSales('desk.labor')} value={copy.money(cost.data.labor.cost)} hint={`${Math.round(cost.data.labor.minutes)} ${t('minutesUnit')}`} tone="info" stamp />
                    <LedgerRow label={t('basePrice')} value={copy.money(basePrice)} />
                    <LedgerRow label={tSales('profit')} value={margin == null ? '—' : `${margin}%`} tone={margin == null ? undefined : margin < 0 ? 'error' : margin < 20 ? 'warning' : 'success'} stamp={margin != null} />
                  </Ledger>
                  {basePrice && basePrice > 0 ? <Meter value={Math.min(cost.data.manufacturingCost, basePrice)} max={basePrice} label={tSales('desk.costShare')} valueLabel={`${Math.round((cost.data.manufacturingCost / basePrice) * 100)}%`} tone={cost.data.manufacturingCost > basePrice ? 'error' : 'brand'} /> : null}
                </>
              ) : (
                <p className="text-[13px] text-[var(--maher-text-tertiary)]">{mutationErrorMessage(cost.error)}</p>
              )}
            </Board.Body>
          </Board>
          <Board tone="neutral">
            <Board.Header title={t('bomMaterials')} />
            {cost.data?.materials.breakdown?.length ? (
              <Ledger className="px-5 pb-2">
                {cost.data.materials.breakdown.map((line, i) => (
                  <LedgerRow key={`${line.sku}-${i}`} label={localizedName(copy.locale, { nameEn: line.nameEn, nameAr: line.nameAr }) || line.sku || '—'} hint={line.qty != null ? `× ${line.qty}` : undefined} value={copy.money(line.lineCost ?? (line.qty ?? 0) * (line.unitCost ?? 0))} />
                ))}
              </Ledger>
            ) : (
              <Board.Empty title={t('noBomMaterials')} description={t('copyFromStandardHint')} action={!v.isDefault ? <Button size="sm" variant="secondary" onClick={() => setConfirm('copy')}>{t('copyFromStandard')}</Button> : undefined} />
            )}
          </Board>
        </div>
      ) : null}

      {tab === 'setup' ? (
        <div className="space-y-5">
          {v.workflowId ? <ProductWorkflowTimes productId={productId} workflowId={v.workflowId} variantId={variantId} /> : null}
          <ProductProductionSetup productId={productId} variantId={variantId} />
        </div>
      ) : null}

      {dirty ? (
        <FormFooter
          dirty
          dirtyLabel={kit.unsaved}
          primary={
            <Button loading={save.isPending} onClick={() => save.mutate()}>
              {tCommon('save')}
            </Button>
          }
          secondary={
            <Button variant="ghost" onClick={() => variant.refetch()}>
              {tCommon('cancel')}
            </Button>
          }
        />
      ) : null}

      <ConfirmDialog
        open={confirm === 'copy'}
        title={t('copyFromStandard')}
        description={t('copyFromStandardHint')}
        confirmLabel={t('copyFromStandard')}
        cancelLabel={tCommon('cancel')}
        loading={copyFromStandard.isPending}
        onClose={() => setConfirm(null)}
        onConfirm={() => copyFromStandard.mutate()}
      />
      <ConfirmDialog
        open={confirm === 'deactivate'}
        title={t('deactivateVariant')}
        description={localizedName(copy.locale, v)}
        danger
        confirmLabel={t('deactivateVariant')}
        cancelLabel={tCommon('cancel')}
        loading={deactivate.isPending}
        onClose={() => setConfirm(null)}
        onConfirm={() => deactivate.mutate()}
      />
    </div>
  );
}

function RowsBoard<Row>({
  title,
  description,
  addLabel,
  rows,
  setRows,
  blank,
  render,
  columns,
}: {
  title: string;
  description?: string;
  addLabel: string;
  rows: Row[];
  setRows: (fn: (prev: Row[]) => Row[]) => void;
  blank: () => Row;
  render: (row: Row, patch: (next: Partial<Row>) => void) => React.ReactNode;
  columns: string;
}) {
  const tCommon = useTranslations('common');
  return (
    <Board tone="neutral">
      <Board.Header
        title={title}
        description={description}
        meta={rows.length ? <Stamp tone="neutral" size="sm">{rows.length}</Stamp> : undefined}
        actions={
          <Button size="sm" variant="secondary" leadingIcon={<Plus className="h-4 w-4" />} onClick={() => setRows((prev) => [...prev, blank()])}>
            {addLabel}
          </Button>
        }
      />
      {rows.length === 0 ? (
        <Board.Empty title={addLabel} description={description} />
      ) : (
        <ul className="divide-y divide-[var(--maher-border)]">
          {rows.map((row, index) => (
            <li key={index} className={`grid gap-2 px-5 py-3 ${columns} sm:items-center`}>
              {render(row, (next) => setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...next } : r))))}
              <Button size="sm" variant="ghost" aria-label={tCommon('remove')} onClick={() => setRows((prev) => prev.filter((_, i) => i !== index))}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Board>
  );
}
