'use client';

import { DealerCombobox } from '@/components/orders/dealer-combobox';
import { ProductProductionSetup } from '@/components/catalog/product-production-setup';
import { Link } from '@/i18n/navigation';
import { mutationErrorMessage } from '@/hooks/use-api-mutation';
import { API_URL, ApiClientError, apiFetch, apiUpload } from '@/lib/api-client';
import { useKitCopy } from '@/lib/kit-copy';
import { localizedName } from '@maher/i18n';
import {
  Alert,
  Board,
  BoardSkeleton,
  Button,
  CameraCapture,
  Combobox,
  ConfirmDialog,
  DataBoard,
  DetailHero,
  ErrorBoard,
  Figure,
  FormFooter,
  ImageSourceField,
  Input,
  KeyFacts,
  Ledger,
  LedgerRow,
  Ltr,
  Menu,
  Meter,
  MoneyField,
  NumberField,
  SectionTabs,
  Sheet,
  Stamp,
  Switch,
  TextArea,
  useToast,
  type DataColumn,
} from '@maher/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Armchair, Copy, MoreHorizontal, Plus, Sparkles, Star, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useMemo, useState } from 'react';
import { useCatalogCopy, useTranslateName } from '../catalog-shared';
import { BomPanel, ProductionTimePanel, WorkflowPanel } from './production-panels';
import { useProductDraft, type CustomMeasurement, type DealerPriceRow, type ProductDraft, type VariantRow } from './use-product-draft';

const TABS = ['overview', 'variants', 'bom', 'workflow', 'time', 'setup', 'pricing'] as const;
type Tab = (typeof TABS)[number];

export function ProductHub({ id }: { id: string }) {
  const draft = useProductDraft(id);
  const copy = useCatalogCopy();
  const t = useTranslations('catalog');
  const tCommon = useTranslations('common');
  const tSales = useTranslations('sales');
  const kit = useKitCopy();
  const router = useRouter();
  const search = useSearchParams();
  const tab = (TABS as readonly string[]).includes(search.get('tab') ?? '') ? (search.get('tab') as Tab) : 'overview';
  const setTab = useCallback(
    (next: string) => {
      const sp = new URLSearchParams(search.toString());
      if (next === 'overview') sp.delete('tab');
      else sp.set('tab', next);
      router.replace(`?${sp.toString()}`, { scroll: false });
    },
    [router, search],
  );

  const { product } = draft.queries;
  if (product.isLoading) return <BoardSkeleton rows={6} />;
  if (product.isError || !draft.data) return <ErrorBoard title={t('product')} description={mutationErrorMessage(product.error)} onRetry={() => product.refetch()} />;

  const data = draft.data;
  const title = localizedName(copy.locale, { nameEn: draft.identity.nameEn, nameAr: draft.identity.nameAr, nameHe: draft.identity.nameHe }) || data.sku;
  const productionCost = draft.liveBomCost > 0 ? draft.liveBomCost : Number(data.productionCost ?? data.manufacturingCost ?? 0);
  const margin = copy.margin(draft.identity.basePrice, productionCost);
  const leadMinutes = draft.computedStageMinutes > 0 ? draft.computedStageMinutes : Number(draft.profileDraft.totalStandardMinutes || 0);
  const variants = draft.queries.variants.data ?? [];
  const prices = draft.queries.dealerPrices.data ?? [];

  const tabs = [
    { id: 'overview', label: tSales('desk.tabOverview') },
    { id: 'variants', label: t('variants'), count: variants.length },
    { id: 'bom', label: t('bomMaterials'), count: draft.bom.bomLines.length },
    { id: 'workflow', label: tSales('desk.tabWorkflow') },
    { id: 'time', label: t('productionTime') },
    { id: 'setup', label: tSales('desk.tabSetup') },
    { id: 'pricing', label: tSales('desk.tabPricing'), count: prices.length },
  ];

  return (
    <div className="maher-stagger space-y-5 pb-24 md:pb-0">
      <DetailHero
        back={{ label: t('products'), href: '/admin/products' }}
        LinkComponent={Link}
        code={data.sku}
        title={title}
        subtitle={data.category ? localizedName(copy.locale, data.category) : t('productsShopHint')}
        status={{ label: draft.identity.isActive ? t('active') : t('inactive'), tone: draft.identity.isActive ? 'success' : 'neutral' }}
        media={
          <span className="block h-20 w-20 overflow-hidden rounded-[14px] bg-[var(--maher-surface-muted)] sm:h-24 sm:w-24">
            {draft.identity.photos[0] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={draft.identity.photos[0]} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-[var(--maher-text-tertiary)]">
                <Armchair className="h-8 w-8 opacity-50" />
              </span>
            )}
          </span>
        }
        facts={[
          { label: t('basePrice'), value: copy.money(draft.identity.basePrice), ltr: true },
          { label: tSales('productionPrice'), value: copy.money(productionCost), ltr: true, tone: productionCost > Number(draft.identity.basePrice ?? 0) && Number(draft.identity.basePrice ?? 0) > 0 ? 'error' : undefined },
          { label: tSales('profit'), value: margin == null ? '—' : `${margin}%`, ltr: true, tone: margin == null ? undefined : margin < 0 ? 'error' : margin < 20 ? 'warning' : 'success' },
          { label: t('productionTime'), value: leadMinutes > 0 ? `${Math.round(leadMinutes)} ${t('minutesUnit')}` : '—', ltr: true },
          { label: t('variants'), value: String(variants.length), ltr: true },
        ]}
        primary={
          <Button loading={draft.save.isPending} disabled={!draft.dirty} onClick={() => draft.save.mutate()}>
            {tCommon('save')}
          </Button>
        }
        actions={
          <Menu
            aria-label={tCommon('more')}
            trigger={<Button variant="secondary" aria-label={tCommon('more')}><MoreHorizontal className="h-4 w-4" /></Button>}
            items={[
              { id: 'toggle', label: draft.identity.isActive ? tSales('desk.deactivate') : tSales('desk.activate'), onSelect: () => draft.identity.setIsActive(!draft.identity.isActive) },
              { id: 'bom', label: t('bomMaterials'), onSelect: () => setTab('bom') },
              { id: 'setup', label: tSales('desk.tabSetup'), onSelect: () => setTab('setup') },
            ]}
          />
        }
      >
        <SectionTabs items={tabs} value={tab} onChange={setTab} size="sm" aria-label={t('product')} />
      </DetailHero>

      {tab === 'overview' ? <OverviewPanel draft={draft} /> : null}
      {tab === 'variants' ? <VariantsPanel draft={draft} /> : null}
      {tab === 'bom' ? <BomPanel draft={draft} /> : null}
      {tab === 'workflow' ? <WorkflowPanel draft={draft} /> : null}
      {tab === 'time' ? <ProductionTimePanel draft={draft} /> : null}
      {tab === 'setup' ? <ProductProductionSetup productId={id} /> : null}
      {tab === 'pricing' ? <PricingPanel draft={draft} /> : null}

      {draft.dirty ? (
        <FormFooter
          dirty
          dirtyLabel={kit.unsaved}
          primary={
            <Button loading={draft.save.isPending} onClick={() => draft.save.mutate()}>
              {tCommon('save')}
            </Button>
          }
          secondary={
            <Button variant="ghost" onClick={() => draft.queries.product.refetch()}>
              {tCommon('cancel')}
            </Button>
          }
        />
      ) : null}
    </div>
  );
}

/* ── Overview ────────────────────────────────────────────────────────────── */

function OverviewPanel({ draft }: { draft: ProductDraft }) {
  const t = useTranslations('catalog');
  const tCommon = useTranslations('common');
  const tSales = useTranslations('sales');
  const copy = useCatalogCopy();
  const kit = useKitCopy();
  const toast = useToast();
  const translate = useTranslateName();
  const { identity: f, dims } = draft;
  const [measureOpen, setMeasureOpen] = useState(false);
  const [measure, setMeasure] = useState<{ nameEn: string; nameAr: string; nameHe: string; value: string }>({ nameEn: '', nameAr: '', nameHe: '', value: '' });
  const [measureError, setMeasureError] = useState<string | null>(null);
  const cats = draft.queries.categories.data ?? [];

  const upload = async (files: File[] | FileList) => {
    const uploaded: string[] = [];
    for (const file of Array.from(files)) {
      const form = new FormData();
      form.append('file', file);
      const res = await apiUpload<{ downloadPath: string }>('/api/v1/uploads?category=PRODUCT_IMAGE', form);
      uploaded.push(`${API_URL}${res.downloadPath}`);
    }
    f.setPhotos((prev) => {
      const next = [...prev];
      for (const u of uploaded) if (!next.includes(u)) next.push(u);
      return next;
    });
  };

  async function suggest() {
    const source = f.nameAr.trim() ? { text: f.nameAr.trim(), sourceLocale: 'ar' as const } : f.nameEn.trim() ? { text: f.nameEn.trim(), sourceLocale: 'en' as const } : null;
    if (!source) return;
    try {
      const res = await translate.mutateAsync(source);
      if (!f.nameEn.trim()) f.setNameEn(res.nameEn);
      if (!f.nameAr.trim()) f.setNameAr(res.nameAr);
      if (!f.nameHe.trim()) f.setNameHe(res.nameHe);
    } catch (err) {
      toast.error(mutationErrorMessage(err));
    }
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
      {/* Media */}
      <Board tone="neutral">
        <Board.Header title={tSales('desk.media')} description={t('imageUrlHint')} />
        <div className="px-5 pb-5">
          <div className="relative aspect-[5/4] overflow-hidden rounded-[14px] bg-[var(--maher-surface-muted)]">
            {f.photos[0] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={f.photos[0]} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-[var(--maher-text-tertiary)]">
                <Armchair className="h-12 w-12 opacity-40" />
                <span className="text-[12px]">{t('changeProductPhoto')}</span>
              </div>
            )}
          </div>
          {f.photos.length > 0 ? (
            <ul className="mt-3 flex flex-wrap gap-2">
              {f.photos.map((url, i) => (
                <li key={`${url}-${i}`} className="group/photo relative">
                  <button
                    type="button"
                    className={`maher-press block h-16 w-16 overflow-hidden rounded-[10px] border ${i === 0 ? 'border-[var(--maher-brand)]' : 'border-[var(--maher-border)]'}`}
                    onClick={() => f.setPhotos((prev) => [prev[i]!, ...prev.filter((_, idx) => idx !== i)])}
                    title={tSales('desk.makeCover')}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="" className="h-full w-full object-cover" />
                  </button>
                  <button
                    type="button"
                    aria-label={t('removeProductPhoto')}
                    className="absolute -end-1.5 -top-1.5 hidden h-5 w-5 items-center justify-center rounded-full bg-[var(--maher-text-primary)] text-[var(--maher-surface)] group-hover/photo:flex"
                    onClick={() => f.setPhotos((prev) => prev.filter((_, idx) => idx !== i))}
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          <div className="mt-4 space-y-3">
            <ImageSourceField label={t('changeProductPhoto')} value="" onChange={(url) => url && f.setPhotos((prev) => (prev.includes(url) ? prev : [...prev, url]))} uploadLabel={tCommon('uploadFromDevice')} uploadingLabel={tCommon('uploading')} allowUrl={false} multiple showPreview={false} onUploadFiles={upload} />
            <CameraCapture label={t('takeProductPhoto')} onUploadFile={(file: File) => upload([file])} />
          </div>
        </div>
      </Board>

      <div className="space-y-5">
        {/* Identity */}
        <Board tone="brand" wash="top">
          <Board.Header
            title={t('product')}
            actions={
              <Button variant="secondary" size="sm" leadingIcon={<Sparkles className="h-4 w-4" />} loading={translate.isPending} disabled={!f.nameAr.trim() && !f.nameEn.trim()} onClick={() => void suggest()}>
                {tSales('desk.suggestNames')}
              </Button>
            }
          />
          <Board.Body className="grid gap-4 sm:grid-cols-2">
            <Input label={t('nameAr')} value={f.nameAr} onChange={(e) => f.setNameAr(e.target.value)} dir="rtl" />
            <Input label={t('nameEn')} value={f.nameEn} onChange={(e) => f.setNameEn(e.target.value)} dir="ltr" />
            <Input label={t('nameHe')} value={f.nameHe} onChange={(e) => f.setNameHe(e.target.value)} dir="rtl" />
            <Combobox label={t('category')} value={f.categoryId} onChange={(v) => f.setCategoryId(v)} options={cats.map((c) => ({ value: c.id, label: localizedName(copy.locale, c), description: c.code }))} placeholder={t('select')} emptyText={kit.combobox.empty} clearLabel={kit.combobox.clear} />
            <div className="sm:col-span-2">
              <TextArea autoGrow label={t('description')} value={f.description} onChange={(e) => f.setDescription(e.target.value)} rows={3} />
            </div>
            <div className="sm:col-span-2">
              <Switch checked={f.isActive} onChange={f.setIsActive} label={t('active')} description={t('productsShopHint')} />
            </div>
          </Board.Body>
        </Board>

        {/* Measurements */}
        <Board tone="info">
          <Board.Header
            title={t('measurements')}
            actions={
              <Button size="sm" variant="secondary" leadingIcon={<Plus className="h-4 w-4" />} onClick={() => (setMeasure({ nameEn: '', nameAr: '', nameHe: '', value: '' }), setMeasureError(null), setMeasureOpen(true))}>
                {t('addMeasurement')}
              </Button>
            }
          />
          <Board.Body className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <NumberField label={t('width')} unit="cm" value={dims.width} onChange={dims.setWidth} min={0} />
              <NumberField label={t('height')} unit="cm" value={dims.height} onChange={dims.setHeight} min={0} />
              <NumberField label={t('depth')} unit="cm" value={dims.depth} onChange={dims.setDepth} min={0} />
              <NumberField label={t('seatHeight')} unit="cm" value={dims.seatHeight} onChange={dims.setSeatHeight} min={0} />
            </div>
            {dims.customMeasurements.length === 0 ? (
              <p className="text-[12px] text-[var(--maher-text-tertiary)]">{t('noCustomMeasurements')}</p>
            ) : (
              <ul className="divide-y divide-[var(--maher-border)] rounded-[12px] border border-[var(--maher-border)]">
                {dims.customMeasurements.map((m) => (
                  <li key={m.id} className="grid gap-2 px-3 py-2 sm:grid-cols-[minmax(0,1fr)_128px_auto] sm:items-center">
                    <div className="min-w-0">
                      <p className="truncate text-[14px] font-medium text-[var(--maher-text-primary)]">{localizedName(copy.locale, m)}</p>
                      <p className="truncate text-[11px] text-[var(--maher-text-tertiary)]">
                        {m.nameEn} · {m.nameAr}
                        {m.nameHe ? ` · ${m.nameHe}` : ''}
                      </p>
                    </div>
                    <NumberField aria-label={t('measurementValue')} unit="cm" value={m.value === '' || m.value == null ? null : Number(m.value)} onChange={(v) => dims.setCustomMeasurements((prev) => prev.map((row) => (row.id === m.id ? { ...row, value: v == null ? '' : v } : row)))} />
                    <Button size="sm" variant="ghost" aria-label={tCommon('remove')} onClick={() => dims.setCustomMeasurements((prev) => prev.filter((row) => row.id !== m.id))}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </Board.Body>
        </Board>

        {/* Admin notes */}
        <Board tone="neutral">
          <Board.Header title={t('adminNotes')} description={t('adminNotesHint')} />
          <Board.Body>
            <TextArea autoGrow value={f.adminNotes} onChange={(e) => f.setAdminNotes(e.target.value)} placeholder={t('adminNotesPlaceholder')} rows={5} />
          </Board.Body>
        </Board>
      </div>

      <Sheet
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
                if (!measure.nameEn.trim() || !measure.nameAr.trim()) return setMeasureError(t('measurementNamesRequired'));
                const row: CustomMeasurement = { id: `m-${Date.now().toString(36)}`, nameEn: measure.nameEn.trim(), nameAr: measure.nameAr.trim(), nameHe: measure.nameHe.trim(), value: measure.value };
                dims.setCustomMeasurements((prev) => [...prev, row]);
                setMeasureOpen(false);
              }}
            >
              {tCommon('add')}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {measureError ? <Alert variant="error">{measureError}</Alert> : null}
          <Input label={t('measurementNameAr')} value={measure.nameAr} onChange={(e) => setMeasure({ ...measure, nameAr: e.target.value })} dir="rtl" />
          <Input label={t('measurementNameEn')} value={measure.nameEn} onChange={(e) => setMeasure({ ...measure, nameEn: e.target.value })} dir="ltr" />
          <Input label={t('measurementNameHe')} value={measure.nameHe} onChange={(e) => setMeasure({ ...measure, nameHe: e.target.value })} dir="rtl" />
          <NumberField label={t('measurementValue')} unit="cm" value={measure.value === '' ? null : Number(measure.value)} onChange={(v) => setMeasure({ ...measure, value: v == null ? '' : String(v) })} />
        </div>
      </Sheet>
    </div>
  );
}

/* ── Variants ────────────────────────────────────────────────────────────── */

function VariantsPanel({ draft }: { draft: ProductDraft }) {
  const t = useTranslations('catalog');
  const tCommon = useTranslations('common');
  const tSales = useTranslations('sales');
  const copy = useCatalogCopy();
  const toast = useToast();
  const qc = useQueryClient();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ code: '', nameAr: '', nameEn: '', nameHe: '' });
  const [error, setError] = useState<string | null>(null);
  const [deactivate, setDeactivate] = useState<VariantRow | null>(null);
  const rows = draft.queries.variants.data ?? [];
  const translate = useTranslateName();

  const create = useMutation({
    mutationFn: async () => {
      if (!form.code.trim() || !form.nameAr.trim() || !form.nameEn.trim()) throw new ApiClientError(t('namesRequired'), 400);
      return apiFetch<{ id: string }>(`/api/v1/products/${draft.id}/variants`, { method: 'POST', body: JSON.stringify({ code: form.code.trim(), nameAr: form.nameAr.trim(), nameEn: form.nameEn.trim(), nameHe: form.nameHe.trim() || undefined }) });
    },
    onSuccess: async (row) => {
      setOpen(false);
      await qc.invalidateQueries({ queryKey: ['product-variants', draft.id] });
      router.push(`/${copy.locale}/admin/products/${draft.id}/variants/${row.id}`);
    },
    onError: (err) => setError(mutationErrorMessage(err)),
  });
  const duplicate = useMutation({
    mutationFn: (v: VariantRow) => apiFetch<{ id: string }>(`/api/v1/products/${draft.id}/variants/${v.id}/duplicate`, { method: 'POST' }),
    onSuccess: async () => {
      toast.success(tCommon('saved'));
      await qc.invalidateQueries({ queryKey: ['product-variants', draft.id] });
    },
    onError: (err) => toast.error(mutationErrorMessage(err)),
  });
  const deactivateMut = useMutation({
    mutationFn: (v: VariantRow) => apiFetch(`/api/v1/products/${draft.id}/variants/${v.id}/deactivate`, { method: 'POST' }),
    onSuccess: async () => {
      setDeactivate(null);
      toast.success(tCommon('saved'));
      await qc.invalidateQueries({ queryKey: ['product-variants', draft.id] });
    },
    onError: (err) => toast.error(mutationErrorMessage(err)),
  });
  const makeDefault = useMutation({
    mutationFn: (v: VariantRow) => apiFetch(`/api/v1/products/${draft.id}/variants/${v.id}`, { method: 'PATCH', body: JSON.stringify({ isDefault: true }) }),
    onSuccess: async () => {
      toast.success(tCommon('saved'));
      await qc.invalidateQueries({ queryKey: ['product-variants', draft.id] });
    },
    onError: (err) => toast.error(mutationErrorMessage(err)),
  });

  const columns: DataColumn<VariantRow>[] = [
    {
      key: 'name',
      header: t('variants'),
      cell: (v) => (
        <span className="flex items-center gap-2">
          {v.isDefault ? <Star className="h-3.5 w-3.5 fill-[var(--maher-warning)] text-[var(--maher-warning)]" aria-hidden /> : null}
          <span className="min-w-0">
            <span className="block truncate font-semibold text-[var(--maher-text-primary)]">{localizedName(copy.locale, v)}</span>
            <Ltr className="block text-[12px] text-[var(--maher-text-tertiary)]">{v.sku}</Ltr>
          </span>
        </span>
      ),
    },
    { key: 'code', header: t('variantCode'), hideBelow: 'md', cell: (v) => <Ltr>{v.code}</Ltr> },
    {
      key: 'status',
      header: tCommon('status'),
      cell: (v) => (
        <span className="flex flex-wrap gap-1.5">
          {v.isDefault ? <Stamp tone="warning" size="sm">{t('defaultVariant')}</Stamp> : null}
          <Stamp tone={v.isActive ? 'success' : 'neutral'} size="sm">
            {v.isActive ? t('active') : t('variantInactive')}
          </Stamp>
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      numeric: true,
      cell: (v) => (
        <Menu
          aria-label={tCommon('more')}
          trigger={<Button size="sm" variant="ghost" aria-label={tCommon('more')}><MoreHorizontal className="h-4 w-4" /></Button>}
          items={[
            { id: 'open', label: tCommon('open'), href: `/admin/products/${draft.id}/variants/${v.id}` },
            { id: 'default', label: t('defaultVariant'), icon: <Star className="h-4 w-4" />, disabled: v.isDefault || !v.isActive, onSelect: () => makeDefault.mutate(v) },
            { id: 'dup', label: tSales('desk.duplicate'), icon: <Copy className="h-4 w-4" />, onSelect: () => duplicate.mutate(v) },
            { id: 'off', label: tSales('desk.deactivate'), tone: 'error', disabled: !v.isActive || v.isDefault, separator: true, onSelect: () => setDeactivate(v) },
          ]}
          LinkComponent={Link}
        />
      ),
    },
  ];

  return (
    <>
      <DataBoard<VariantRow>
        aria-label={t('variants')}
        title={t('variants')}
        description={t('variantsHint')}
        tone="brand"
        columns={columns}
        rows={rows}
        rowKey={(v) => v.id}
        rowHref={(v) => `/admin/products/${draft.id}/variants/${v.id}`}
        LinkComponent={Link}
        loading={draft.queries.variants.isLoading}
        actions={
          <Button size="sm" leadingIcon={<Plus className="h-4 w-4" />} onClick={() => (setForm({ code: rows.length === 0 ? 'STD' : '', nameAr: '', nameEn: '', nameHe: '' }), setError(null), setOpen(true))}>
            {t('addVariant')}
          </Button>
        }
        mobileRow={(v) => ({ title: localizedName(copy.locale, v), meta: v.code, trailing: <Stamp tone={v.isActive ? 'success' : 'neutral'} size="sm">{v.isActive ? t('active') : t('variantInactive')}</Stamp> })}
        empty={<Board.Empty title={t('noVariants')} action={<Button size="sm" onClick={() => setOpen(true)}>{t('addVariant')}</Button>} />}
      />

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title={t('addVariant')}
        description={t('variantsHint')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              {tCommon('cancel')}
            </Button>
            <Button loading={create.isPending} onClick={() => create.mutate()}>
              {tCommon('save')}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {error ? <Alert variant="error">{error}</Alert> : null}
          <Input label={t('variantCode')} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} dir="ltr" />
          <Input label={t('variantNameAr')} value={form.nameAr} onChange={(e) => setForm({ ...form, nameAr: e.target.value })} dir="rtl" />
          <Input label={t('variantNameEn')} value={form.nameEn} onChange={(e) => setForm({ ...form, nameEn: e.target.value })} dir="ltr" />
          <Input label={t('nameHe')} value={form.nameHe} onChange={(e) => setForm({ ...form, nameHe: e.target.value })} dir="rtl" />
          <Button
            variant="secondary"
            size="sm"
            leadingIcon={<Sparkles className="h-4 w-4" />}
            loading={translate.isPending}
            disabled={!form.nameAr.trim() && !form.nameEn.trim()}
            onClick={async () => {
              const src = form.nameAr.trim() ? { text: form.nameAr.trim(), sourceLocale: 'ar' as const } : { text: form.nameEn.trim(), sourceLocale: 'en' as const };
              try {
                const res = await translate.mutateAsync(src);
                setForm((prev) => ({ ...prev, nameEn: prev.nameEn.trim() || res.nameEn, nameAr: prev.nameAr.trim() || res.nameAr, nameHe: prev.nameHe.trim() || res.nameHe }));
              } catch (err) {
                setError(mutationErrorMessage(err));
              }
            }}
          >
            {tSales('desk.suggestNames')}
          </Button>
        </div>
      </Sheet>

      <ConfirmDialog
        open={Boolean(deactivate)}
        title={tSales('desk.deactivate')}
        description={deactivate ? localizedName(copy.locale, deactivate) : ''}
        danger
        confirmLabel={tSales('desk.deactivate')}
        cancelLabel={tCommon('cancel')}
        loading={deactivateMut.isPending}
        onClose={() => setDeactivate(null)}
        onConfirm={() => deactivate && deactivateMut.mutate(deactivate)}
      />
    </>
  );
}

/* ── Pricing ─────────────────────────────────────────────────────────────── */

function PricingPanel({ draft }: { draft: ProductDraft }) {
  const t = useTranslations('catalog');
  const tCustomers = useTranslations('customers');
  const tCommon = useTranslations('common');
  const tSales = useTranslations('sales');
  const copy = useCatalogCopy();
  const toast = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [price, setPrice] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<DealerPriceRow | null>(null);
  const rowsData = draft.queries.dealerPrices.data;
  const rows = useMemo(() => rowsData ?? [], [rowsData]);
  const sell = Number(draft.identity.basePrice);
  const cost = draft.liveBomCost > 0 ? draft.liveBomCost : Number(draft.data?.productionCost ?? draft.data?.manufacturingCost ?? 0);
  const margin = copy.margin(sell, cost);

  const stats = useMemo(() => {
    const nums = rows.map((r) => Number(r.price)).filter((n) => Number.isFinite(n));
    if (!nums.length) return null;
    return { min: Math.min(...nums), max: Math.max(...nums), below: nums.filter((n) => n < cost).length };
  }, [rows, cost]);

  const save = useMutation({
    mutationFn: async () => {
      if (!customerId || price == null || price < 0) throw new ApiClientError(tCustomers('dealerPriceRequired'), 400);
      return apiFetch(`/api/v1/customers/${customerId}/dealer-prices`, { method: 'POST', body: JSON.stringify({ productId: draft.id, price }) });
    },
    onSuccess: async () => {
      setOpen(false);
      setCustomerId(null);
      setPrice(null);
      toast.success(t('sellerPriceSaved'));
      await qc.invalidateQueries({ queryKey: ['product-dealer-prices', draft.id] });
    },
    onError: (err) => setError(mutationErrorMessage(err)),
  });
  const remove = useMutation({
    mutationFn: (row: DealerPriceRow) => apiFetch(`/api/v1/customers/${row.customer?.id ?? row.customerId}/dealer-prices/${row.id}`, { method: 'DELETE' }),
    onSuccess: async () => {
      setRemoving(null);
      await qc.invalidateQueries({ queryKey: ['product-dealer-prices', draft.id] });
    },
    onError: (err) => toast.error(mutationErrorMessage(err)),
  });

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
      <div className="space-y-5">
        <Board tone={margin != null && margin < 0 ? 'error' : margin != null && margin < 20 ? 'warning' : 'success'} wash="top">
          <Board.Header title={t('costs')} description={t('basePriceHint')} />
          <Board.Body className="space-y-4">
            <MoneyField label={t('basePrice')} currency="ILS" size="lg" value={draft.identity.basePrice} onChange={draft.identity.setBasePrice} min={0} />
            <Ledger>
              <LedgerRow label={tSales('productionPrice')} value={copy.money(cost)} />
              <LedgerRow label={tSales('profit')} value={margin == null ? '—' : `${copy.money(Number.isFinite(sell) ? sell - cost : null)} · ${margin}%`} tone={margin == null ? undefined : margin < 0 ? 'error' : margin < 20 ? 'warning' : 'success'} stamp={margin != null} />
            </Ledger>
            {Number.isFinite(sell) && sell > 0 ? <Meter value={Math.min(cost, sell)} max={sell} label={tSales('desk.costShare')} valueLabel={`${Math.round((cost / sell) * 100)}%`} tone={cost > sell ? 'error' : 'brand'} /> : null}
          </Board.Body>
        </Board>
        {stats ? (
          <Board tone="neutral">
            <Board.Header title={tSales('desk.dealerPriceSpread')} />
            <Board.Body className="grid grid-cols-3 gap-3">
              <Figure size="sm" value={copy.money(stats.min)} label={tSales('desk.lowest')} locale={copy.locale} />
              <Figure size="sm" value={copy.money(stats.max)} label={tSales('desk.highest')} locale={copy.locale} />
              <Figure size="sm" value={stats.below} label={tSales('desk.belowCost')} tone={stats.below ? 'error' : 'success'} />
            </Board.Body>
          </Board>
        ) : null}
      </div>

      <Board tone="brand">
        <Board.Header
          title={t('sellerPrices')}
          description={t('sellerPricesHint')}
          actions={
            <Button size="sm" leadingIcon={<Plus className="h-4 w-4" />} onClick={() => (setCustomerId(null), setPrice(Number.isFinite(sell) ? sell : null), setError(null), setOpen(true))}>
              {t('addSellerPrice')}
            </Button>
          }
        />
        {rows.length === 0 ? (
          <Board.Empty title={tCustomers('noPrices')} description={t('sellerPricesHint')} />
        ) : (
          <Ledger className="px-5 pb-2">
            {rows.map((row) => {
              const p = Number(row.price);
              const tone = p < cost ? 'error' : Number.isFinite(sell) && p < sell ? 'warning' : 'success';
              return (
                <LedgerRow
                  key={row.id}
                  tone={tone}
                  stamp
                  label={row.customer ? localizedName(copy.locale, row.customer, row.customer.name ?? '—') : '—'}
                  hint={row.customer?.code}
                  value={
                    <span className="flex items-center gap-2">
                      <Ltr className="font-semibold">{copy.money(p, row.currency)}</Ltr>
                      <Button size="sm" variant="ghost" aria-label={tCommon('remove')} onClick={() => setRemoving(row)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </span>
                  }
                />
              );
            })}
          </Ledger>
        )}
      </Board>

      <Sheet
        open={open}
        onClose={() => !save.isPending && setOpen(false)}
        title={t('addSellerPrice')}
        description={t('sellerPricesHint')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              {tCommon('cancel')}
            </Button>
            <Button loading={save.isPending} onClick={() => save.mutate()}>
              {tCommon('save')}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {error ? <Alert variant="error">{error}</Alert> : null}
          <DealerCombobox label={t('customer')} value={customerId} onChange={setCustomerId} />
          <MoneyField label={tCustomers('dealerPrice')} currency="ILS" value={price} onChange={setPrice} min={0} />
          {price != null && cost > 0 ? (
            <KeyFacts
              columns={2}
              facts={[
                { label: tSales('productionPrice'), value: copy.money(cost), ltr: true },
                { label: tSales('profit'), value: `${copy.margin(price, cost) ?? 0}%`, ltr: true },
              ]}
            />
          ) : null}
        </div>
      </Sheet>

      <ConfirmDialog
        open={Boolean(removing)}
        title={tCommon('remove')}
        description={removing?.customer ? localizedName(copy.locale, removing.customer, removing.customer.name ?? '') : ''}
        danger
        confirmLabel={tCommon('remove')}
        cancelLabel={tCommon('cancel')}
        loading={remove.isPending}
        onClose={() => setRemoving(null)}
        onConfirm={() => removing && remove.mutate(removing)}
      />
    </div>
  );
}
