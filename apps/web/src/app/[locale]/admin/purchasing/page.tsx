'use client';

import {
  emptyMaterialsList,
  type MaterialsListRow,
} from '@/components/admin/materials-list-editor';
import { InventoryItemThumb } from '@/components/admin/inventory-item-thumb';
import { Link, useRouter } from '@/i18n/navigation';
import { apiFetch, ApiClientError } from '@/lib/api-client';
import {
  PURCHASE_ORDER_STATUSES,
  PURCHASE_REQUEST_STATUSES,
  INVOICE_STATUSES,
  statusOptions,
} from '@/lib/status-options';
import { mutationErrorMessage } from '@/hooks/use-api-mutation';
import { setDemandCart } from '@/lib/purchasing-demand-cart';
import {
  Alert,
  Button,
  EmptyState,
  ErrorState,
  Input,
  Ltr,
  Modal,
  MotionSection,
  DateRangeField,
  PageHero,
  Select,
  Skeleton,
  StatusBadge,
  Tabs,
  TabList,
  Tab,
  TabPanel,
  cn,
} from '@maher/ui';
import { localizedName } from '@maher/i18n';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';

function money(value: string | number | undefined, currency: string) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return `— ${currency}`;
  return `${n.toFixed(2)} ${currency}`;
}

interface Supplier {
  id: string;
  name: string;
  code: string;
  nameAr?: string | null;
  nameEn?: string | null;
  nameHe?: string | null;
}
interface Warehouse {
  id: string;
  code: string;
  nameEn: string;
  nameAr?: string;
}
interface POLine {
  id: string;
  description: string;
  quantity: string | number;
  inventoryItemId?: string | null;
}
interface PoPresentation {
  phase: string;
  labelKey: string;
  tone?: string;
  progress?: number;
}
interface PORow {
  id: string;
  number: string;
  status: string;
  origin?: string | null;
  warehouseId?: string | null;
  supplier?: { name: string; nameAr?: string | null; nameEn?: string | null; nameHe?: string | null };
  total?: string | number;
  lines?: POLine[];
  presentation?: PoPresentation;
}

type DemandRow = {
  inventoryItemId?: string;
  sku: string;
  nameEn: string;
  nameAr?: string | null;
  nameHe?: string | null;
  unit: string;
  category?: string | null;
  imageUrl?: string | null;
  onHandQty: number;
  reservedQty: number;
  freeQty: number;
  availableQty?: number;
  requiredQty: number;
  incomingQty: number;
  stillNeeded?: number;
  nextEta: string | null;
  nextRequiredBy: string | null;
  status: 'COVERED' | 'AT_RISK' | 'SHORTAGE' | 'NO_ETA';
  affected: Array<{
    productionOrderNumber: string;
    stageCode: string;
    qty: number;
    requiredBy: string | null;
  }>;
};

const DEMAND_CATEGORIES = [
  'WOOD',
  'FABRIC',
  'FOAM',
  'PAINT',
  'ADHESIVE',
  'METAL_ACCESSORY',
  'DECORATIVE_ACCESSORY',
  'PACKAGING',
  'OTHER',
] as const;

type PurchasingPhaseKey =
  | 'phaseDraft'
  | 'phaseOrdered'
  | 'phasePartial'
  | 'phaseReceived'
  | 'phaseClosed'
  | 'phaseCancelled';

function poPresentationLabel(
  presentation: PoPresentation | undefined,
  tPurchasing: (key: PurchasingPhaseKey) => string,
): string | null {
  if (!presentation?.labelKey) return null;
  const key = presentation.labelKey.replace(/^purchasing\./, '') as PurchasingPhaseKey;
  const known: PurchasingPhaseKey[] = [
    'phaseDraft',
    'phaseOrdered',
    'phasePartial',
    'phaseReceived',
    'phaseClosed',
    'phaseCancelled',
  ];
  if (known.includes(key)) return tPurchasing(key);
  return presentation.phase || null;
}
interface PRSupplier {
  id?: string;
  name: string;
  nameAr?: string | null;
  nameEn?: string | null;
  nameHe?: string | null;
}
interface PRRow {
  id: string;
  number: string;
  status: string;
  reason?: string | null;
  warehouseId?: string | null;
  warehouse?: {
    id: string;
    code: string;
    nameEn?: string | null;
    nameAr?: string | null;
    nameHe?: string | null;
  } | null;
  preferredSupplier?: PRSupplier | null;
  offers?: Array<{
    isSelected?: boolean;
    supplier?: PRSupplier | null;
  }>;
  purchaseOrder?: {
    id: string;
    number: string;
    status?: string;
    supplier?: PRSupplier | null;
  } | null;
}

interface SupplierInvoiceRow {
  id: string;
  number: string;
  status: string;
  total?: string | number;
  outstandingAmount?: string | number;
  paidAmount?: string | number;
  invoiceDate?: string | null;
  dueDate?: string | null;
  supplier?: { name: string; nameAr?: string | null; nameEn?: string | null; nameHe?: string | null };
  purchaseOrder?: { id: string; number: string } | null;
}

type SupplierFormState = {
  nameEn: string;
  nameAr: string;
  nameHe: string;
  companyName: string;
  phone: string;
  whatsappPhone: string;
  email: string;
  address: string;
  paymentTermsDays: string;
  leadTimeDays: string;
  rating: string;
  notes: string;
};

const emptySupplierForm = (): SupplierFormState => ({
  nameEn: '',
  nameAr: '',
  nameHe: '',
  companyName: '',
  phone: '',
  whatsappPhone: '',
  email: '',
  address: '',
  paymentTermsDays: '30',
  leadTimeDays: '7',
  rating: '',
  notes: '',
});

export default function PurchasingPage() {
  const locale = useLocale();
  const tNav = useTranslations('navigation');
  const tc = useTranslations('catalog');
  const tPurchasing = useTranslations('purchasing');
  const tCommon = useTranslations('common');
  const tStatus = useTranslations('statuses');
  const queryClient = useQueryClient();
  const router = useRouter();
  const currency = tCommon('currency');

  const [banner, setBanner] = useState<string | null>(null);
  const [supplierOpen, setSupplierOpen] = useState(false);
  const [supplierFormError, setSupplierFormError] = useState<string | null>(null);
  const [supplierForm, setSupplierForm] = useState<SupplierFormState>(emptySupplierForm);
  const [poMaterials, setPoMaterials] = useState<MaterialsListRow[]>(emptyMaterialsList());
  const [poSearch, setPoSearch] = useState('');
  const [prSearch, setPrSearch] = useState('');
  const [siSearch, setSiSearch] = useState('');
  const [poStatus, setPoStatus] = useState('');
  const [prStatus, setPrStatus] = useState('');
  const [siStatus, setSiStatus] = useState('');
  const [poSupplierId, setPoSupplierId] = useState('');
  const [prSupplierId, setPrSupplierId] = useState('');
  const [siSupplierId, setSiSupplierId] = useState('');
  const [poDateFrom, setPoDateFrom] = useState('');
  const [poDateTo, setPoDateTo] = useState('');
  const [demandQ, setDemandQ] = useState('');
  const [demandCategory, setDemandCategory] = useState('');

  const poParams = useMemo(() => {
    const params = new URLSearchParams({ pageSize: '100' });
    if (poSearch.trim()) params.set('q', poSearch.trim());
    if (poStatus) params.set('status', poStatus);
    if (poSupplierId) params.set('supplierId', poSupplierId);
    if (poDateFrom) params.set('dateFrom', poDateFrom);
    if (poDateTo) params.set('dateTo', poDateTo);
    return params.toString();
  }, [poSearch, poStatus, poSupplierId, poDateFrom, poDateTo]);

  const demandParams = useMemo(() => {
    const params = new URLSearchParams();
    if (demandQ.trim()) params.set('q', demandQ.trim());
    if (demandCategory) params.set('category', demandCategory);
    return params.toString();
  }, [demandQ, demandCategory]);

  const prParams = useMemo(() => {
    const params = new URLSearchParams({ pageSize: '100' });
    if (prSearch.trim()) params.set('q', prSearch.trim());
    if (prStatus) params.set('status', prStatus);
    if (prSupplierId) params.set('supplierId', prSupplierId);
    return params.toString();
  }, [prSearch, prStatus, prSupplierId]);

  const siParams = useMemo(() => {
    const params = new URLSearchParams({ pageSize: '100' });
    if (siSearch.trim()) params.set('q', siSearch.trim());
    if (siStatus) params.set('status', siStatus);
    if (siSupplierId) params.set('supplierId', siSupplierId);
    return params.toString();
  }, [siSearch, siStatus, siSupplierId]);

  const poQuery = useQuery({
    queryKey: ['purchase-orders', poParams],
    queryFn: () =>
      apiFetch<{ data: PORow[] }>(`/api/v1/purchase-orders?${poParams}`).then((r) => r.data),
    placeholderData: keepPreviousData,
  });
  const prQuery = useQuery({
    queryKey: ['purchase-requests', prParams],
    queryFn: () =>
      apiFetch<{ data: PRRow[] }>(`/api/v1/purchase-requests?${prParams}`).then((r) => r.data),
    placeholderData: keepPreviousData,
  });
  const siQuery = useQuery({
    queryKey: ['supplier-invoices', siParams],
    queryFn: () =>
      apiFetch<{ data: SupplierInvoiceRow[] }>(`/api/v1/supplier-invoices?${siParams}`).then(
        (r) => r.data,
      ),
    placeholderData: keepPreviousData,
  });
  const suppliersQuery = useQuery({
    queryKey: ['suppliers-pick'],
    queryFn: () =>
      apiFetch<{ data: Supplier[] }>('/api/v1/suppliers?pageSize=100&status=ACTIVE').then((r) => r.data),
  });
  const warehousesQuery = useQuery({
    queryKey: ['warehouses-pick'],
    queryFn: () =>
      apiFetch<{ data: Warehouse[] }>('/api/v1/warehouses?pageSize=50').then((r) => r.data),
  });
  const demandQuery = useQuery({
    queryKey: ['material-demand', demandParams],
    queryFn: () =>
      apiFetch<DemandRow[]>(
        `/api/v1/material-demand${demandParams ? `?${demandParams}` : ''}`,
      ),
    placeholderData: keepPreviousData,
  });

  const poStatusOpts = statusOptions(tStatus, PURCHASE_ORDER_STATUSES, {
    label: tCommon('all'),
  });
  const prStatusOpts = statusOptions(tStatus, PURCHASE_REQUEST_STATUSES, {
    label: tCommon('all'),
  });
  const siStatusOpts = statusOptions(tStatus, INVOICE_STATUSES, {
    label: tCommon('all'),
  });

  const createSupplier = useMutation({
    mutationFn: async () => {
      const nameEn = supplierForm.nameEn.trim();
      const nameAr = supplierForm.nameAr.trim();
      if (!nameEn || !nameAr) {
        throw new ApiClientError(
          `${tc('nameEn')} / ${tc('nameAr')}: ${tCommon('required')}`,
          400,
        );
      }
      return apiFetch<Supplier>('/api/v1/suppliers', {
        method: 'POST',
        body: JSON.stringify({
          name: nameEn || nameAr,
          nameEn: nameEn || undefined,
          nameAr: nameAr || undefined,
          nameHe: supplierForm.nameHe.trim() || undefined,
          companyName: supplierForm.companyName.trim() || undefined,
          phone: supplierForm.phone.trim() || undefined,
          whatsappPhone: supplierForm.whatsappPhone.trim() || undefined,
          email: supplierForm.email.trim() || undefined,
          address: supplierForm.address.trim() || undefined,
          paymentTermsDays: Number(supplierForm.paymentTermsDays) || 30,
          leadTimeDays: Number(supplierForm.leadTimeDays) || 7,
          rating:
            supplierForm.rating.trim() === '' ? undefined : Number(supplierForm.rating),
          notes: supplierForm.notes.trim() || undefined,
        }),
      });
    },
    onSuccess: async (created) => {
      setSupplierFormError(null);
      await queryClient.invalidateQueries({ queryKey: ['suppliers-pick'] });
      await queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      await queryClient.invalidateQueries({ queryKey: ['suppliers-search'] });
      setSupplierOpen(false);
      setSupplierForm(emptySupplierForm());
      setBanner(tc('supplierCreated'));
    },
    onError: (err) => setSupplierFormError(mutationErrorMessage(err)),
  });

  if ((poQuery.isLoading && !poQuery.data) || (prQuery.isLoading && !prQuery.data) || (siQuery.isLoading && !siQuery.data)) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48 maher-animate-fade" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-52 rounded-2xl maher-animate-rise" />
          ))}
        </div>
      </div>
    );
  }
  if (poQuery.isError || prQuery.isError) {
    return (
      <ErrorState
        title={tNav('purchasing')}
        onRetry={() => {
          poQuery.refetch();
          prQuery.refetch();
        }}
      />
    );
  }

  const orders = poQuery.data ?? [];
  const requests = prQuery.data ?? [];
  const supplierInvoices = siQuery.data ?? [];
  const suppliers = suppliersQuery.data ?? [];
  const warehouses = warehousesQuery.data ?? [];

  function supplierLabel(s: Supplier) {
    return s.nameAr || s.nameEn || s.nameHe
      ? localizedName(locale, s, s.name)
      : s.name;
  }

  function displaySupplierName(s?: {
    name: string;
    nameAr?: string | null;
    nameEn?: string | null;
    nameHe?: string | null;
  } | null) {
    if (!s) return '—';
    return s.nameAr || s.nameEn || s.nameHe ? localizedName(locale, s, s.name) : s.name;
  }

  function prSupplierLabel(row: PRRow) {
    const selected = row.offers?.find((o) => o.isSelected)?.supplier;
    if (selected) return displaySupplierName(selected);
    if (row.purchaseOrder?.supplier) return displaySupplierName(row.purchaseOrder.supplier);
    if (row.preferredSupplier) return displaySupplierName(row.preferredSupplier);
    const first = row.offers?.find((o) => o.supplier)?.supplier;
    if (first) return displaySupplierName(first);
    return '—';
  }

  function openNewSupplier() {
    setSupplierForm(emptySupplierForm());
    setSupplierFormError(null);
    setSupplierOpen(true);
  }

  function openDemandBuilder() {
    setDemandCart(
      poMaterials.map((row) => ({
        inventoryItemId: row.inventoryItemId,
        sku: row.sku,
        nameEn: row.nameEn,
        nameAr: row.nameAr,
        category: row.category,
        unit: row.unit,
        quantity: row.quantity,
        unitPrice: row.unitPrice,
        imageUrl: row.imageUrl,
      })),
    );
    router.push('/admin/purchasing/new');
  }

  function addDemandToPurchase(row: DemandRow) {
    const itemId = row.inventoryItemId;
    const qty = Number(row.stillNeeded ?? 0);
    if (!itemId || !(qty > 0)) return;
    setPoMaterials((prev) => {
      const existing = prev.find((r) => r.inventoryItemId === itemId);
      if (existing) {
        return prev.map((r) =>
          r.inventoryItemId === itemId
            ? { ...r, quantity: String((Number(r.quantity) || 0) + qty) }
            : r,
        );
      }
      return [
        ...prev,
        {
          key: `demand-${itemId}-${Date.now()}`,
          inventoryItemId: itemId,
          sku: row.sku,
          nameEn: row.nameEn,
          nameAr: row.nameAr ?? '',
          category: row.category ?? undefined,
          unit: row.unit?.trim() || 'pcs',
          quantity: String(qty),
          unitPrice: '0',
          imageUrl: row.imageUrl ?? null,
        },
      ];
    });
    setBanner(tc('addToPurchase'));
  }

  const supplierFilterOptions = (
    <>
      <option value="">{tc('allSuppliers')}</option>
      {suppliers.map((s) => (
        <option key={s.id} value={s.id}>
          {supplierLabel(s)}
        </option>
      ))}
    </>
  );

  return (
    <div className="space-y-6">
      <PageHero
        title={tNav('purchasing')}
        tone="soft"
        actions={
          <>
            <Button
              variant="ghost"
              className="maher-lift"
              onClick={() => router.push('/admin/purchasing/low-stock')}
            >
              {tc('lowStockOrders')}
            </Button>
            <Button
              variant="secondary"
              className="maher-lift"
              onClick={() => router.push('/admin/suppliers')}
            >
              {tc('actionSuppliers')}
            </Button>
            <Button className="maher-lift" onClick={() => router.push('/admin/purchasing/new')}>
              {tc('newPurchaseOrder')}
            </Button>
          </>
        }
      />
      {banner ? (
        <MotionSection enter="drop" className="maher-animate-bounce-in">
          <Alert variant="success">{banner}</Alert>
        </MotionSection>
      ) : null}

      <MotionSection enter="rise" delayMs={40} className="space-y-1">
        <Tabs defaultValue="orders">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <TabList>
              <Tab value="orders" count={orders.length + requests.length}>
                {tc('purchaseOrders')}
              </Tab>
              <Tab value="supplier-invoices" count={supplierInvoices.length}>
                {tc('supplierInvoices')}
              </Tab>
              <Tab value="demand" count={demandQuery.data?.length}>
                {tc('materialDemand')}
              </Tab>
            </TabList>
            <Button
              variant="secondary"
              className="maher-animate-pop maher-lift shrink-0"
              onClick={openNewSupplier}
            >
              <Plus className="size-4" aria-hidden />
              {tc('newSupplier')}
            </Button>
          </div>
          <p className="text-sm text-text-secondary">
            {tc('purchaseOrdersHint')} · {tc('purchaseRequestsHint')} ·{' '}
            {tc('supplierInvoicesHint')}
          </p>

          <TabPanel value="orders" className="maher-purchasing-panel">
            <div
              key={`orders-${poStatus}-${poSupplierId}-${poDateFrom}-${poDateTo}`}
              className="space-y-4"
            >
              <div className="maher-purchasing-filters maher-stagger mb-1 flex flex-wrap items-end gap-3">
                <label className="relative min-w-[220px] flex-1">
                  <Input
                    value={poSearch}
                    onChange={(e) => setPoSearch(e.target.value)}
                    placeholder={tc('purchasingSearchPlaceholder')}
                    withSearchIcon
                  />
                </label>
                <Select
                  value={poStatus}
                  onChange={(e) => setPoStatus(e.target.value)}
                  options={poStatusOpts}
                  className="w-48"
                  aria-label={tCommon('status')}
                />
                <Select
                  value={poSupplierId}
                  onChange={(e) => setPoSupplierId(e.target.value)}
                  className="min-w-[200px]"
                  aria-label={tc('supplier')}
                >
                  {supplierFilterOptions}
                </Select>
                <DateRangeField
                  fromLabel={tc('dateFrom')}
                  toLabel={tc('dateTo')}
                  from={poDateFrom}
                  to={poDateTo}
                  onFromChange={setPoDateFrom}
                  onToChange={setPoDateTo}
                />
              </div>
              <div
                className={`maher-purchasing-results maher-stagger grid gap-3 lg:grid-cols-2 ${
                  poQuery.isFetching ? 'opacity-70 transition-opacity' : ''
                }`}
              >
                {orders.length === 0 && requests.length === 0 ? (
                  <div className="col-span-full">
                    <EmptyState title={tc('noPurchaseOrders')} />
                  </div>
                ) : (
                  orders.map((row) => {
                    const warehouse = warehouses.find((w) => w.id === row.warehouseId);
                    const lineCount = row.lines?.length ?? 0;
                    const phaseLabel = poPresentationLabel(row.presentation, tPurchasing);
                    return (
                      <article
                        key={row.id}
                        className="maher-purchasing-card flex flex-col rounded-xl border border-border bg-surface"
                      >
                        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
                          <div className="flex items-center gap-2">
                            <StatusBadge
                              status={row.presentation?.phase ?? row.status}
                              label={phaseLabel ?? undefined}
                            />
                            {row.origin && row.origin !== 'MANUAL' ? (
                              <StatusBadge status={row.origin} />
                            ) : null}
                          </div>
                          <Link
                            href={`/admin/purchasing/${row.id}`}
                            className="rounded-md px-2 py-1 text-sm font-medium text-brand transition hover:bg-[var(--maher-brand-soft)]"
                          >
                            {tCommon('details')}
                          </Link>
                        </div>

                        <div className="flex flex-1 flex-col px-4 py-4">
                          <p className="truncate text-lg font-semibold tracking-tight text-text-primary">
                            <Ltr>{row.number}</Ltr>
                          </p>
                          <p className="mt-1 truncate text-sm text-text-secondary">
                            {displaySupplierName(row.supplier)}
                          </p>

                          <div className="mt-4 flex min-h-[4.25rem] items-stretch overflow-hidden rounded-lg bg-[var(--maher-surface-muted)]">
                            <div className="flex min-w-0 flex-1 flex-col justify-center px-3 py-2.5">
                              <p className="text-[10px] font-medium uppercase tracking-[0.06em] text-text-tertiary">
                                {tc('linesShort')}
                              </p>
                              <p className="mt-1 text-sm font-semibold text-text-primary">
                                <Ltr>{lineCount}</Ltr>
                              </p>
                            </div>
                            <div
                              className="flex shrink-0 items-center px-1 text-lg text-text-tertiary rtl:rotate-180"
                              aria-hidden
                            >
                              →
                            </div>
                            <div className="flex min-w-0 flex-[1.4] flex-col justify-center px-3 py-2.5">
                              <p className="text-[10px] font-medium uppercase tracking-[0.06em] text-text-tertiary">
                                {tc('warehouseShort')}
                              </p>
                              <p className="mt-1 truncate text-sm font-semibold text-text-primary">
                                {warehouse
                                  ? localizedName(locale, warehouse) || warehouse.code
                                  : '—'}
                              </p>
                            </div>
                          </div>

                          <div className="mt-4 text-start">
                            <p className="text-xs text-text-tertiary">{tc('totalShort')}</p>
                            <p className="mt-0.5 text-base font-semibold tracking-tight text-text-primary">
                              <Ltr>{money(row.total, currency)}</Ltr>
                            </p>
                          </div>
                        </div>
                      </article>
                    );
                  })
                )}
                {requests.map((row) => {
                  const offerCount = row.offers?.length ?? 0;
                  const linkedPo = row.purchaseOrder?.number ?? null;
                  return (
                    <article
                      key={`pr-${row.id}`}
                      className="maher-purchasing-card flex flex-col rounded-xl border border-border bg-surface"
                    >
                      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
                        <div className="flex items-center gap-2">
                          <StatusBadge status={row.status} />
                          <StatusBadge status="REQUEST" label={tc('requestChip')} />
                        </div>
                        <Link
                          href={`/admin/purchasing/requests/${row.id}`}
                          className="rounded-md px-2 py-1 text-sm font-medium text-brand transition hover:bg-[var(--maher-brand-soft)]"
                        >
                          {tCommon('details')}
                        </Link>
                      </div>
                      <div className="flex flex-1 flex-col px-4 py-4">
                        <p className="truncate text-lg font-semibold tracking-tight text-text-primary">
                          <Ltr>{row.number}</Ltr>
                        </p>
                        <p className="mt-2 truncate text-sm text-text-secondary">
                          {prSupplierLabel(row)}
                        </p>
                        <div className="mt-4 flex flex-wrap items-center gap-2">
                          <span className="rounded-md bg-[var(--maher-surface-muted)] px-2.5 py-1 text-xs font-medium text-text-secondary">
                            <Ltr>{offerCount}</Ltr> {tc('offersShort')}
                          </span>
                          {linkedPo ? (
                            <span className="rounded-md bg-[var(--maher-surface-muted)] px-2.5 py-1 text-xs font-medium text-text-secondary">
                              {tc('linkedPo')}: <Ltr>{linkedPo}</Ltr>
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          </TabPanel>

          <TabPanel value="requests" className="maher-purchasing-panel hidden">
            <div
              key={`requests-${prStatus}-${prSupplierId}`}
              className="space-y-4"
            >
              <div className="maher-purchasing-filters maher-stagger mb-1 flex flex-wrap items-end gap-3">
                <label className="relative min-w-[220px] flex-1">
                  <Input
                    value={prSearch}
                    onChange={(e) => setPrSearch(e.target.value)}
                    placeholder={tc('purchasingSearchPlaceholder')}
                    withSearchIcon
                  />
                </label>
                <Select
                  value={prStatus}
                  onChange={(e) => setPrStatus(e.target.value)}
                  options={prStatusOpts}
                  className="w-48"
                  aria-label={tCommon('status')}
                />
                <Select
                  value={prSupplierId}
                  onChange={(e) => setPrSupplierId(e.target.value)}
                  className="min-w-[200px]"
                  aria-label={tc('supplier')}
                >
                  {supplierFilterOptions}
                </Select>
              </div>
              <div
                className={`maher-purchasing-results maher-stagger grid gap-3 lg:grid-cols-2 ${
                  prQuery.isFetching ? 'opacity-70 transition-opacity' : ''
                }`}
              >
                {requests.length === 0 ? (
                  <div className="col-span-full">
                    <EmptyState title={tc('noPurchaseRequests')} />
                  </div>
                ) : (
                  requests.map((row) => {
                    const offerCount = row.offers?.length ?? 0;
                    const linkedPo = row.purchaseOrder?.number ?? null;
                    return (
                      <article
                        key={row.id}
                        className="maher-purchasing-card flex flex-col rounded-xl border border-border bg-surface"
                      >
                        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
                          <StatusBadge status={row.status} />
                          <Link
                            href={`/admin/purchasing/requests/${row.id}`}
                            className="rounded-md px-2 py-1 text-sm font-medium text-brand transition hover:bg-[var(--maher-brand-soft)]"
                          >
                            {tCommon('details')}
                          </Link>
                        </div>

                        <div className="flex flex-1 flex-col px-4 py-4">
                          <p className="truncate text-lg font-semibold tracking-tight text-text-primary">
                            <Ltr>{row.number}</Ltr>
                          </p>
                          <p className="mt-2 text-sm leading-snug text-text-primary">
                            {row.reason?.trim() || (
                              <span className="text-text-tertiary">—</span>
                            )}
                          </p>
                          <p className="mt-2 truncate text-sm text-text-secondary">
                            {prSupplierLabel(row)}
                          </p>

                          <div className="mt-4 flex flex-wrap items-center gap-2">
                            <span className="rounded-md bg-[var(--maher-surface-muted)] px-2.5 py-1 text-xs font-medium text-text-secondary">
                              <Ltr>{offerCount}</Ltr> {tc('offersShort')}
                            </span>
                            {linkedPo ? (
                              <span className="rounded-md bg-[var(--maher-brand-soft)] px-2.5 py-1 text-xs font-medium text-brand">
                                {tc('poShort')}{' '}
                                <Ltr className="inline">{linkedPo}</Ltr>
                              </span>
                            ) : (
                              <span className="rounded-md border border-dashed border-border px-2.5 py-1 text-xs text-text-tertiary">
                                {tc('poShort')} —
                              </span>
                            )}
                          </div>

                          <p className="mt-4 truncate text-xs text-text-tertiary">
                            {tc('warehouseShort')}:{' '}
                            <span className="font-medium text-text-secondary">
                              {row.warehouse
                                ? localizedName(locale, row.warehouse) || row.warehouse.code
                                : '—'}
                            </span>
                          </p>
                        </div>
                      </article>
                    );
                  })
                )}
              </div>
            </div>
          </TabPanel>

          <TabPanel value="supplier-invoices" className="maher-purchasing-panel">
            <div
              key={`invoices-${siStatus}-${siSupplierId}`}
              className="space-y-4"
            >
              <div className="maher-purchasing-filters maher-stagger mb-1 flex flex-wrap items-end gap-3">
                <label className="relative min-w-[220px] flex-1">
                  <Input
                    value={siSearch}
                    onChange={(e) => setSiSearch(e.target.value)}
                    placeholder={tc('purchasingSearchPlaceholder')}
                    withSearchIcon
                  />
                </label>
                <Select
                  value={siStatus}
                  onChange={(e) => setSiStatus(e.target.value)}
                  options={siStatusOpts}
                  className="w-48"
                  aria-label={tCommon('status')}
                />
                <Select
                  value={siSupplierId}
                  onChange={(e) => setSiSupplierId(e.target.value)}
                  className="min-w-[200px]"
                  aria-label={tc('supplier')}
                >
                  {supplierFilterOptions}
                </Select>
              </div>
              <div
                className={`maher-purchasing-results maher-stagger grid gap-3 lg:grid-cols-2 ${
                  siQuery.isFetching ? 'opacity-70 transition-opacity' : ''
                }`}
              >
                {supplierInvoices.length === 0 ? (
                  <div className="col-span-full">
                    <EmptyState title={tc('noSupplierInvoices')} />
                  </div>
                ) : (
                  supplierInvoices.map((row) => {
                    const outstanding = Number(row.outstandingAmount ?? 0);
                    const unpaid = Number.isFinite(outstanding) && outstanding > 0;
                    return (
                      <article
                        key={row.id}
                        className={cn(
                          'maher-purchasing-card flex flex-col rounded-xl border bg-surface',
                          unpaid
                            ? 'border-[color-mix(in_srgb,var(--maher-warning,_#c48a2a)_35%,var(--maher-border))]'
                            : 'border-border',
                        )}
                      >
                        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
                          <StatusBadge status={row.status} />
                          <Link
                            href={`/admin/purchasing/supplier-invoices/${row.id}`}
                            className="rounded-md px-2 py-1 text-sm font-medium text-brand transition hover:bg-[var(--maher-brand-soft)]"
                          >
                            {tCommon('details')}
                          </Link>
                        </div>

                        <div className="flex flex-1 flex-col px-4 py-4">
                          <p className="truncate text-lg font-semibold tracking-tight text-text-primary">
                            <Ltr>{row.number}</Ltr>
                          </p>
                          <p className="mt-1 truncate text-sm text-text-secondary">
                            {displaySupplierName(row.supplier)}
                          </p>

                          {row.purchaseOrder ? (
                            <p className="mt-3 text-xs text-text-tertiary">
                              {tc('poShort')}{' '}
                              <Link
                                href={`/admin/purchasing/${row.purchaseOrder.id}`}
                                className="font-medium text-brand hover:underline"
                              >
                                <Ltr className="inline">{row.purchaseOrder.number}</Ltr>
                              </Link>
                            </p>
                          ) : (
                            <p className="mt-3 text-xs text-text-tertiary">
                              {tc('poShort')} —
                            </p>
                          )}

                          <div className="mt-4 rounded-lg bg-[var(--maher-surface-muted)] px-3 py-3 text-start">
                            <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-text-tertiary">
                              {tc('outstandingShort')}
                            </p>
                            <p
                              className={cn(
                                'mt-1 text-xl font-semibold tracking-tight',
                                unpaid ? 'text-text-primary' : 'text-text-secondary',
                              )}
                            >
                              <Ltr>{money(row.outstandingAmount, currency)}</Ltr>
                            </p>
                            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-tertiary">
                              <span>
                                {tc('totalShort')}{' '}
                                <Ltr className="font-medium text-text-secondary">
                                  {money(row.total, currency)}
                                </Ltr>
                              </span>
                              <span>
                                {tc('paid')}{' '}
                                <Ltr className="font-medium text-text-secondary">
                                  {money(row.paidAmount, currency)}
                                </Ltr>
                              </span>
                            </div>
                          </div>

                          {row.dueDate ? (
                            <p className="mt-3 text-xs text-text-tertiary">
                              <Ltr>{row.dueDate.slice(0, 10)}</Ltr>
                            </p>
                          ) : null}
                        </div>
                      </article>
                    );
                  })
                )}
              </div>
            </div>
          </TabPanel>
          <TabPanel value="demand" className="maher-purchasing-panel">
            <div className="space-y-4">
              <div className="maher-purchasing-filters maher-stagger mb-1 flex flex-wrap items-end gap-3">
                <label className="relative min-w-[220px] flex-1">
                  <Input
                    value={demandQ}
                    onChange={(e) => setDemandQ(e.target.value)}
                    placeholder={tc('purchasingSearchPlaceholder')}
                    withSearchIcon
                  />
                </label>
                <Select
                  value={demandCategory}
                  onChange={(e) => setDemandCategory(e.target.value)}
                  className="min-w-[180px]"
                  aria-label={tc('category')}
                >
                  <option value="">{tCommon('all')}</option>
                  {DEMAND_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {tc(`materialCategories.${cat}`)}
                    </option>
                  ))}
                </Select>
                {poMaterials.length > 0 ? (
                  <Button className="maher-lift shrink-0" onClick={openDemandBuilder}>
                    {tc('newPurchaseOrder')} ({poMaterials.length})
                  </Button>
                ) : null}
              </div>
              {demandQuery.isLoading && !demandQuery.data ? (
                <Skeleton className="h-40 w-full" />
              ) : demandQuery.error ? (
                <ErrorState
                  title={tCommon('error')}
                  onRetry={() => void demandQuery.refetch()}
                />
              ) : (demandQuery.data ?? []).length === 0 ? (
                <EmptyState title={tc('materialDemandEmpty')} />
              ) : (
                <div
                  className={`space-y-3 ${demandQuery.isFetching ? 'opacity-70 transition-opacity' : ''}`}
                >
                  {(demandQuery.data ?? []).map((row) => {
                    const need = Number(row.stillNeeded ?? 0);
                    return (
                      <article
                        key={row.sku}
                        className="rounded-2xl border border-border bg-surface p-4"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="flex min-w-0 items-center gap-3 font-semibold" dir="ltr">
                            <InventoryItemThumb src={row.imageUrl} alt="" size={40} />
                            {row.sku}
                            <span className="ms-2 font-normal text-text-secondary">
                              {localizedName(locale, row)}
                            </span>
                          </p>
                          <div className="flex flex-wrap items-center gap-2">
                            <StatusBadge
                              status={
                                row.status === 'COVERED'
                                  ? 'READY'
                                  : row.status === 'AT_RISK'
                                    ? 'NEEDS_REVIEW'
                                    : 'FAILED'
                              }
                              label={
                                row.status === 'COVERED'
                                  ? tc('demandCovered')
                                  : row.status === 'AT_RISK'
                                    ? tc('demandAtRisk')
                                    : row.status === 'SHORTAGE'
                                      ? tc('demandShortage')
                                      : tc('demandNoEta')
                              }
                            />
                            {need > 0 && row.inventoryItemId ? (
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => addDemandToPurchase(row)}
                              >
                                {tc('addToPurchase')}
                              </Button>
                            ) : null}
                          </div>
                        </div>
                        <p className="mt-2 text-sm text-text-secondary" dir="ltr">
                          {row.availableQty ?? row.freeQty} {row.unit} {tc('availableQty')} ·{' '}
                          {row.requiredQty} required · {row.incomingQty} {tc('incomingQty')}
                          {need > 0 ? ` · ${need} ${tc('stillNeeded')}` : ''}
                          {row.nextRequiredBy
                            ? ` · ${tc('requiredBy')} ${row.nextRequiredBy.slice(0, 10)}`
                            : ''}
                        </p>
                        <ul className="mt-2 space-y-1 text-sm text-text-tertiary">
                          {row.affected.map((hit) => (
                            <li key={`${hit.productionOrderNumber}-${hit.stageCode}`} dir="ltr">
                              {hit.productionOrderNumber} · {hit.stageCode} × {hit.qty}
                              {hit.requiredBy ? ` · ${hit.requiredBy.slice(0, 10)}` : ''}
                            </li>
                          ))}
                        </ul>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          </TabPanel>
        </Tabs>
      </MotionSection>

      <Modal
        open={supplierOpen}
        onClose={() => !createSupplier.isPending && setSupplierOpen(false)}
        title={tc('newSupplier')}
        className="max-w-xl"
        footer={
          <>
            <Button
              variant="ghost"
              disabled={createSupplier.isPending}
              onClick={() => setSupplierOpen(false)}
            >
              {tCommon('cancel')}
            </Button>
            <Button loading={createSupplier.isPending} onClick={() => createSupplier.mutate()}>
              {tCommon('save')}
            </Button>
          </>
        }
      >
        <div className="maher-form-section grid gap-3 sm:grid-cols-2">
          {supplierFormError ? (
            <Alert variant="error" className="sm:col-span-2">
              {supplierFormError}
            </Alert>
          ) : null}
          <Input
            label={tc('nameEn')}
            required
            value={supplierForm.nameEn}
            onChange={(e) => setSupplierForm((f) => ({ ...f, nameEn: e.target.value }))}
          />
          <Input
            label={tc('nameAr')}
            required
            value={supplierForm.nameAr}
            onChange={(e) => setSupplierForm((f) => ({ ...f, nameAr: e.target.value }))}
          />
          <Input
            label={tc('nameHe')}
            value={supplierForm.nameHe}
            onChange={(e) => setSupplierForm((f) => ({ ...f, nameHe: e.target.value }))}
          />
          <Input
            label={tc('company')}
            value={supplierForm.companyName}
            onChange={(e) => setSupplierForm((f) => ({ ...f, companyName: e.target.value }))}
          />
          <Input
            label={tc('phone')}
            value={supplierForm.phone}
            onChange={(e) => setSupplierForm((f) => ({ ...f, phone: e.target.value }))}
          />
          <Input
            label={tc('whatsappPhone')}
            value={supplierForm.whatsappPhone}
            onChange={(e) => setSupplierForm((f) => ({ ...f, whatsappPhone: e.target.value }))}
            hint={tc('whatsappPhoneHint')}
          />
          <Input
            label={tc('email')}
            type="email"
            value={supplierForm.email}
            onChange={(e) => setSupplierForm((f) => ({ ...f, email: e.target.value }))}
          />
          <div className="sm:col-span-2">
            <Input
              label={tCommon('address')}
              value={supplierForm.address}
              onChange={(e) => setSupplierForm((f) => ({ ...f, address: e.target.value }))}
            />
          </div>
          <Input
            label={tc('paymentTermsDays')}
            type="number"
            value={supplierForm.paymentTermsDays}
            onChange={(e) => setSupplierForm((f) => ({ ...f, paymentTermsDays: e.target.value }))}
          />
          <Input
            label={tc('leadTimeDays')}
            type="number"
            value={supplierForm.leadTimeDays}
            onChange={(e) => setSupplierForm((f) => ({ ...f, leadTimeDays: e.target.value }))}
          />
          <Input
            label={tc('rating')}
            type="number"
            value={supplierForm.rating}
            onChange={(e) => setSupplierForm((f) => ({ ...f, rating: e.target.value }))}
          />
          <div className="sm:col-span-2">
            <Input
              label={tc('notes')}
              value={supplierForm.notes}
              onChange={(e) => setSupplierForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
