'use client';

import {
  MaterialsListEditor,
  emptyMaterialsList,
  type MaterialsListRow,
} from '@/components/admin/materials-list-editor';
import { SupplierSearchPicker } from '@/components/admin/supplier-search-picker';
import { Link, useRouter } from '@/i18n/navigation';
import { apiFetch, ApiClientError } from '@/lib/api-client';
import {
  PURCHASE_ORDER_STATUSES,
  PURCHASE_REQUEST_STATUSES,
  INVOICE_STATUSES,
  statusOptions,
} from '@/lib/status-options';
import { mutationErrorMessage } from '@/hooks/use-api-mutation';
import {
  Alert,
  Button,
  EmptyState,
  ErrorState,
  Input,
  Ltr,
  Modal,
  MotionSection,
  PageHero,
  Select,
  Skeleton,
  StatusBadge,
  Tabs,
  TabList,
  Tab,
  TabPanel,
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
interface PORow {
  id: string;
  number: string;
  status: string;
  warehouseId?: string | null;
  supplier?: { name: string; nameAr?: string | null; nameEn?: string | null; nameHe?: string | null };
  total?: string | number;
  lines?: POLine[];
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
  email: string;
  address: string;
  paymentTermsDays: string;
  leadTimeDays: string;
  rating: string;
  isCertified: boolean;
  notes: string;
};

const emptySupplierForm = (): SupplierFormState => ({
  nameEn: '',
  nameAr: '',
  nameHe: '',
  companyName: '',
  phone: '',
  email: '',
  address: '',
  paymentTermsDays: '30',
  leadTimeDays: '7',
  rating: '',
  isCertified: true,
  notes: '',
});

export default function PurchasingPage() {
  const locale = useLocale();
  const tNav = useTranslations('navigation');
  const tc = useTranslations('catalog');
  const tCommon = useTranslations('common');
  const tStatus = useTranslations('statuses');
  const queryClient = useQueryClient();
  const router = useRouter();
  const currency = tCommon('currency');

  const [banner, setBanner] = useState<string | null>(null);
  const [poOpen, setPoOpen] = useState(false);
  const [prOpen, setPrOpen] = useState(false);
  const [supplierOpen, setSupplierOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [supplierFormError, setSupplierFormError] = useState<string | null>(null);
  const [supplierForm, setSupplierForm] = useState<SupplierFormState>(emptySupplierForm);
  const [supplierId, setSupplierId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [poMaterials, setPoMaterials] = useState<MaterialsListRow[]>(emptyMaterialsList());
  const [prMaterials, setPrMaterials] = useState<MaterialsListRow[]>(emptyMaterialsList());
  const [prReason, setPrReason] = useState('');
  const [prPreferredSupplierId, setPrPreferredSupplierId] = useState('');
  const [poSearch, setPoSearch] = useState('');
  const [prSearch, setPrSearch] = useState('');
  const [siSearch, setSiSearch] = useState('');
  const [poStatus, setPoStatus] = useState('');
  const [prStatus, setPrStatus] = useState('');
  const [siStatus, setSiStatus] = useState('');
  const [poSupplierId, setPoSupplierId] = useState('');
  const [prSupplierId, setPrSupplierId] = useState('');
  const [siSupplierId, setSiSupplierId] = useState('');

  const poParams = useMemo(() => {
    const params = new URLSearchParams({ pageSize: '100' });
    if (poSearch.trim()) params.set('q', poSearch.trim());
    if (poStatus) params.set('status', poStatus);
    if (poSupplierId) params.set('supplierId', poSupplierId);
    return params.toString();
  }, [poSearch, poStatus, poSupplierId]);

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
      apiFetch<{ data: Supplier[] }>('/api/v1/suppliers?pageSize=100').then((r) => r.data),
  });
  const warehousesQuery = useQuery({
    queryKey: ['warehouses-pick'],
    queryFn: () =>
      apiFetch<{ data: Warehouse[] }>('/api/v1/warehouses?pageSize=50').then((r) => r.data),
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

  const createPo = useMutation({
    mutationFn: async () => {
      const lines = poMaterials
        .filter((row) => row.inventoryItemId && Number(row.quantity) > 0)
        .map((row) => ({
          description:
            localizedName(locale, { nameEn: row.nameEn, nameAr: row.nameAr }) || row.sku,
          quantity: Number(row.quantity),
          unitPrice: Number(row.unitPrice) || 0,
          inventoryItemId: row.inventoryItemId,
          unit: row.unit || 'pcs',
        }));
      if (!supplierId) {
        throw new ApiClientError(tc('selectSupplierRequired'), 400);
      }
      if (lines.length === 0) {
        throw new ApiClientError(tc('selectMaterialRequired'), 400);
      }
      return apiFetch('/api/v1/purchase-orders', {
        method: 'POST',
        body: JSON.stringify({
          supplierId,
          warehouseId: warehouseId || undefined,
          lines,
        }),
      });
    },
    onSuccess: async () => {
      setFormError(null);
      await queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      setPoOpen(false);
      setBanner(tc('purchaseOrderCreated'));
    },
    onError: (err) => setFormError(mutationErrorMessage(err)),
  });

  const createPr = useMutation({
    mutationFn: async () => {
      const lines = prMaterials
        .filter((row) => row.inventoryItemId && Number(row.quantity) > 0)
        .map((row) => ({
          description:
            localizedName(locale, { nameEn: row.nameEn, nameAr: row.nameAr }) || row.sku,
          quantity: Number(row.quantity),
          inventoryItemId: row.inventoryItemId,
          unit: row.unit || 'pcs',
        }));
      if (!prPreferredSupplierId) {
        throw new ApiClientError(tc('selectSupplierRequired'), 400);
      }
      if (lines.length === 0) {
        throw new ApiClientError(tc('selectMaterialRequired'), 400);
      }
      return apiFetch('/api/v1/purchase-requests', {
        method: 'POST',
        body: JSON.stringify({
          reason: prReason.trim() || undefined,
          warehouseId: warehouseId || undefined,
          preferredSupplierId: prPreferredSupplierId,
          lines,
        }),
      });
    },
    onSuccess: async () => {
      setFormError(null);
      await queryClient.invalidateQueries({ queryKey: ['purchase-requests'] });
      setPrOpen(false);
      setBanner(tc('purchaseRequestSubmitted'));
    },
    onError: (err) => setFormError(mutationErrorMessage(err)),
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
          email: supplierForm.email.trim() || undefined,
          address: supplierForm.address.trim() || undefined,
          paymentTermsDays: Number(supplierForm.paymentTermsDays) || 30,
          leadTimeDays: Number(supplierForm.leadTimeDays) || 7,
          rating:
            supplierForm.rating.trim() === '' ? undefined : Number(supplierForm.rating),
          isCertified: Boolean(supplierForm.isCertified),
          notes: supplierForm.notes.trim() || undefined,
        }),
      });
    },
    onSuccess: async (created) => {
      setSupplierFormError(null);
      await queryClient.invalidateQueries({ queryKey: ['suppliers-pick'] });
      await queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      await queryClient.invalidateQueries({ queryKey: ['suppliers-search'] });
      if (created?.id) setSupplierId(created.id);
      setSupplierOpen(false);
      setSupplierForm(emptySupplierForm());
      setBanner(tc('supplierCreated'));
    },
    onError: (err) => setSupplierFormError(mutationErrorMessage(err)),
  });

  const fromLowStock = useMutation({
    mutationFn: () =>
      apiFetch<{ id: string }>('/api/v1/purchase-requests/from-low-stock', { method: 'POST' }),
    onSuccess: async (created) => {
      await queryClient.invalidateQueries({ queryKey: ['purchase-requests'] });
      setBanner(tc('prFromLowStockCreated'));
      if (created?.id) router.push(`/purchasing/requests/${created.id}`);
    },
    onError: (err) => setBanner(mutationErrorMessage(err)),
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

  function resetPoForm() {
    setSupplierId('');
    setWarehouseId(warehouses[0]?.id ?? '');
    setPoMaterials(emptyMaterialsList());
    setFormError(null);
  }

  function resetPrForm() {
    setWarehouseId(warehouses[0]?.id ?? '');
    setPrReason('');
    setPrPreferredSupplierId('');
    setPrMaterials(emptyMaterialsList());
    setFormError(null);
  }

  function openNewSupplier() {
    setSupplierForm(emptySupplierForm());
    setSupplierFormError(null);
    setSupplierOpen(true);
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
              loading={fromLowStock.isPending}
              onClick={() => fromLowStock.mutate()}
            >
              {tc('fromLowStock')}
            </Button>
            <Button
              variant="secondary"
              className="maher-lift"
              onClick={() => {
                resetPrForm();
                setPrOpen(true);
              }}
            >
              {tc('newPurchaseRequest')}
            </Button>
            <Button
              className="maher-lift"
              onClick={() => {
                resetPoForm();
                setPoOpen(true);
              }}
            >
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
              <Tab value="orders" count={orders.length}>
                {tc('purchaseOrders')}
              </Tab>
              <Tab value="requests" count={requests.length}>
                {tc('purchaseRequests')}
              </Tab>
              <Tab value="supplier-invoices" count={supplierInvoices.length}>
                {tc('supplierInvoices')}
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

          <TabPanel value="orders" className="maher-purchasing-panel">
            <div
              key={`orders-${poStatus}-${poSupplierId}`}
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
              </div>
              <div
                className={`maher-purchasing-results maher-stagger grid gap-4 sm:grid-cols-2 xl:grid-cols-3 ${
                  poQuery.isFetching ? 'opacity-70 transition-opacity' : ''
                }`}
              >
                {orders.length === 0 ? (
                  <div className="col-span-full">
                    <EmptyState title={tc('noPurchaseOrders')} />
                  </div>
                ) : (
                  orders.map((row) => {
                    const warehouse = warehouses.find((w) => w.id === row.warehouseId);
                    return (
                      <div
                        key={row.id}
                        className="maher-list-card maher-purchasing-card group relative flex flex-col rounded-2xl border border-border bg-surface p-6 transition duration-200 hover:-translate-y-0.5 hover:border-brand/30 hover:shadow-[var(--maher-shadow-md)]"
                      >
                        <Link
                          href={`/purchasing/${row.id}`}
                          className="absolute inset-0 z-0 rounded-2xl"
                          aria-label={row.number}
                        />
                        <div className="relative z-[1] flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <Ltr className="block truncate text-xl font-semibold tracking-tight text-text-primary transition-colors group-hover:text-brand">
                              {row.number}
                            </Ltr>
                            <p className="mt-1 truncate text-sm text-text-secondary">
                              {displaySupplierName(row.supplier)}
                            </p>
                          </div>
                          <StatusBadge status={row.status} />
                        </div>
                        <div className="relative z-[1] mt-6 maher-card-rule-y py-3">
                          <div className="grid grid-cols-3">
                            <div className="flex min-w-0 flex-col items-center gap-1.5 px-2.5 py-0.5 text-center">
                              <span className="h-4 w-full truncate text-center text-[11px] leading-4 text-text-tertiary">
                                {tc('linesShort')}
                              </span>
                              <span
                                dir="ltr"
                                className="w-full truncate text-center text-xs font-semibold leading-4 tabular-nums tracking-tight text-text-primary"
                              >
                                {row.lines?.length ?? 0}
                              </span>
                            </div>
                            <div className="col-span-2 flex min-w-0 flex-col items-center gap-1.5 maher-card-rule-s px-2.5 py-0.5 text-center">
                              <span className="h-4 w-full truncate text-center text-[11px] leading-4 text-text-tertiary">
                                {tc('warehouseShort')}
                              </span>
                              <span className="w-full truncate text-center text-sm font-semibold leading-5 tracking-tight text-text-primary">
                                {warehouse
                                  ? localizedName(locale, warehouse) || warehouse.code
                                  : '—'}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="relative z-[1] mt-4 flex items-end justify-between gap-4">
                          <div>
                            <p className="text-[11px] text-text-tertiary">{tc('totalShort')}</p>
                            <Ltr className="mt-0.5 block text-sm font-medium text-text-primary">
                              {money(row.total, currency)}
                            </Ltr>
                          </div>
                          <Link
                            href={`/purchasing/${row.id}`}
                            className="maher-lift relative z-[1] text-sm font-medium text-brand transition hover:underline"
                          >
                            {tCommon('details')}
                          </Link>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </TabPanel>

          <TabPanel value="requests" className="maher-purchasing-panel">
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
                className={`maher-purchasing-results maher-stagger grid gap-4 sm:grid-cols-2 xl:grid-cols-3 ${
                  prQuery.isFetching ? 'opacity-70 transition-opacity' : ''
                }`}
              >
                {requests.length === 0 ? (
                  <div className="col-span-full">
                    <EmptyState title={tc('noPurchaseRequests')} />
                  </div>
                ) : (
                  requests.map((row) => (
                    <div
                      key={row.id}
                      className="maher-list-card maher-purchasing-card group relative flex flex-col rounded-2xl border border-border bg-surface p-6 transition duration-200 hover:-translate-y-0.5 hover:border-brand/30 hover:shadow-[var(--maher-shadow-md)]"
                    >
                      <Link
                        href={`/purchasing/requests/${row.id}`}
                        className="absolute inset-0 z-0 rounded-2xl"
                        aria-label={row.number}
                      />
                      <div className="relative z-[1] flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <Ltr className="block truncate text-xl font-semibold tracking-tight text-text-primary transition-colors group-hover:text-brand">
                            {row.number}
                          </Ltr>
                          <p className="mt-1 truncate text-sm text-text-secondary">
                            {prSupplierLabel(row)}
                          </p>
                        </div>
                        <StatusBadge status={row.status} />
                      </div>
                      <div className="relative z-[1] mt-6 maher-card-rule-y py-3">
                        <div className="grid grid-cols-3">
                          <div className="flex min-w-0 flex-col items-center gap-1.5 px-2.5 py-0.5 text-center">
                            <span className="h-4 w-full truncate text-center text-[11px] leading-4 text-text-tertiary">
                              {tc('reasonShort')}
                            </span>
                            <span className="w-full truncate text-center text-xs font-semibold leading-4 tracking-tight text-text-primary">
                              {row.reason?.trim() || '—'}
                            </span>
                          </div>
                          <div className="flex min-w-0 flex-col items-center gap-1.5 maher-card-rule-s px-2.5 py-0.5 text-center">
                            <span className="h-4 w-full truncate text-center text-[11px] leading-4 text-text-tertiary">
                              {tc('poShort')}
                            </span>
                            <span
                              dir="ltr"
                              className="w-full truncate text-center text-xs font-semibold leading-4 tabular-nums tracking-tight text-text-primary"
                            >
                              {row.purchaseOrder?.number ?? '—'}
                            </span>
                          </div>
                          <div className="flex min-w-0 flex-col items-center gap-1.5 maher-card-rule-s px-2.5 py-0.5 text-center">
                            <span className="h-4 w-full truncate text-center text-[11px] leading-4 text-text-tertiary">
                              {tc('offersShort')}
                            </span>
                            <span
                              dir="ltr"
                              className="w-full truncate text-center text-xs font-semibold leading-4 tabular-nums tracking-tight text-text-primary"
                            >
                              {row.offers?.length ?? 0}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="relative z-[1] mt-4 flex items-end justify-between gap-4">
                        <div className="min-w-0">
                          <p className="text-[11px] text-text-tertiary">{tc('warehouseShort')}</p>
                          <p className="mt-0.5 truncate text-sm font-medium text-text-primary">
                            {row.warehouse
                              ? localizedName(locale, row.warehouse) || row.warehouse.code
                              : '—'}
                          </p>
                        </div>
                        <Link
                          href={`/purchasing/requests/${row.id}`}
                          className="maher-lift shrink-0 text-sm font-medium text-brand transition hover:underline"
                        >
                          {tCommon('details')}
                        </Link>
                      </div>
                    </div>
                  ))
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
                className={`maher-purchasing-results maher-stagger grid gap-4 sm:grid-cols-2 xl:grid-cols-3 ${
                  siQuery.isFetching ? 'opacity-70 transition-opacity' : ''
                }`}
              >
                {supplierInvoices.length === 0 ? (
                  <div className="col-span-full">
                    <EmptyState title={tc('noSupplierInvoices')} />
                  </div>
                ) : (
                  supplierInvoices.map((row) => (
                    <div
                      key={row.id}
                      className="maher-list-card maher-purchasing-card group relative flex flex-col rounded-2xl border border-border bg-surface p-6 transition duration-200 hover:-translate-y-0.5 hover:border-brand/30 hover:shadow-[var(--maher-shadow-md)]"
                    >
                      <Link
                        href={`/purchasing/supplier-invoices/${row.id}`}
                        className="absolute inset-0 z-0 rounded-2xl"
                        aria-label={row.number}
                      />
                      <div className="relative z-[1] flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <Ltr className="block truncate text-xl font-semibold tracking-tight text-text-primary transition-colors group-hover:text-brand">
                            {row.number}
                          </Ltr>
                          <p className="mt-1 truncate text-sm text-text-secondary">
                            {displaySupplierName(row.supplier)}
                          </p>
                        </div>
                        <StatusBadge status={row.status} />
                      </div>
                      <div className="relative z-[1] mt-6 maher-card-rule-y py-3">
                        <div className="grid grid-cols-3">
                          <div className="flex min-w-0 flex-col items-center gap-1.5 px-2.5 py-0.5 text-center">
                            <span className="h-4 w-full truncate text-center text-[11px] leading-4 text-text-tertiary">
                              {tc('poShort')}
                            </span>
                            {row.purchaseOrder ? (
                              <Link
                                href={`/purchasing/${row.purchaseOrder.id}`}
                                className="relative z-[1] w-full truncate text-center text-xs font-semibold leading-4 tabular-nums tracking-tight text-brand hover:underline"
                                dir="ltr"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {row.purchaseOrder.number}
                              </Link>
                            ) : (
                              <span
                                dir="ltr"
                                className="w-full truncate text-center text-xs font-semibold leading-4 tabular-nums tracking-tight text-text-primary"
                              >
                                —
                              </span>
                            )}
                          </div>
                          <div className="flex min-w-0 flex-col items-center gap-1.5 maher-card-rule-s px-2.5 py-0.5 text-center">
                            <span className="h-4 w-full truncate text-center text-[11px] leading-4 text-text-tertiary">
                              {tc('totalShort')}
                            </span>
                            <span
                              dir="ltr"
                              className="w-full truncate text-center text-xs font-semibold leading-4 tabular-nums tracking-tight text-text-primary"
                            >
                              {money(row.total, currency)}
                            </span>
                          </div>
                          <div className="flex min-w-0 flex-col items-center gap-1.5 maher-card-rule-s px-2.5 py-0.5 text-center">
                            <span className="h-4 w-full truncate text-center text-[11px] leading-4 text-text-tertiary">
                              {tc('outstandingShort')}
                            </span>
                            <span
                              dir="ltr"
                              className="w-full truncate text-center text-xs font-semibold leading-4 tabular-nums tracking-tight text-text-primary"
                            >
                              {money(row.outstandingAmount, currency)}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="relative z-[1] mt-4 flex items-end justify-between gap-4">
                        <div>
                          <p className="text-[11px] text-text-tertiary">{tc('paid')}</p>
                          <Ltr className="mt-0.5 block text-sm font-medium text-text-primary">
                            {money(row.paidAmount, currency)}
                          </Ltr>
                        </div>
                        <Link
                          href={`/purchasing/supplier-invoices/${row.id}`}
                          className="maher-lift text-sm font-medium text-brand transition hover:underline"
                        >
                          {tCommon('details')}
                        </Link>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </TabPanel>
        </Tabs>
      </MotionSection>

      <Modal
        open={poOpen}
        onClose={() => !createPo.isPending && setPoOpen(false)}
        title={tc('newPurchaseOrder')}
        className="max-w-3xl"
        footer={
          <>
            <Button variant="ghost" disabled={createPo.isPending} onClick={() => setPoOpen(false)}>
              {tCommon('cancel')}
            </Button>
            <Button loading={createPo.isPending} onClick={() => createPo.mutate()}>
              {tCommon('save')}
            </Button>
          </>
        }
      >
        <div className="maher-form-section grid gap-3">
          {formError ? <Alert variant="error">{formError}</Alert> : null}
          <div className="flex flex-wrap items-end gap-2">
            <SupplierSearchPicker
              label={tc('supplier')}
              required
              value={supplierId}
              onChange={(id) => setSupplierId(id)}
              className="min-w-[220px] flex-1"
            />
            <Button type="button" variant="secondary" onClick={openNewSupplier}>
              <Plus className="size-4" aria-hidden />
              {tc('newSupplier')}
            </Button>
          </div>
          <Select
            label={tc('warehouses')}
            value={warehouseId}
            onChange={(e) => setWarehouseId(e.target.value)}
          >
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.code} — {localizedName(locale, w)}
              </option>
            ))}
          </Select>
          <MaterialsListEditor rows={poMaterials} onChange={setPoMaterials} />
        </div>
      </Modal>

      <Modal
        open={prOpen}
        onClose={() => !createPr.isPending && setPrOpen(false)}
        title={tc('newPurchaseRequest')}
        className="max-w-3xl"
        footer={
          <>
            <Button variant="ghost" disabled={createPr.isPending} onClick={() => setPrOpen(false)}>
              {tCommon('cancel')}
            </Button>
            <Button loading={createPr.isPending} onClick={() => createPr.mutate()}>
              {tCommon('submit')}
            </Button>
          </>
        }
      >
        <div className="maher-form-section grid gap-3">
          {formError ? <Alert variant="error">{formError}</Alert> : null}
          <Input
            label={tc('reason')}
            value={prReason}
            onChange={(e) => setPrReason(e.target.value)}
          />
          <SupplierSearchPicker
            label={tc('supplier')}
            required
            value={prPreferredSupplierId}
            onChange={(id) => setPrPreferredSupplierId(id)}
          />
          <Select
            label={tc('warehouses')}
            value={warehouseId}
            onChange={(e) => setWarehouseId(e.target.value)}
          >
            <option value="">{tc('noneOption')}</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.code} — {localizedName(locale, w)}
              </option>
            ))}
          </Select>
          <MaterialsListEditor
            rows={prMaterials}
            onChange={setPrMaterials}
            variant="request"
          />
        </div>
      </Modal>

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
          <label className="flex items-center gap-2 self-end pb-2 text-sm text-[var(--maher-text-primary)]">
            <input
              type="checkbox"
              className="size-4 rounded border-[var(--maher-border)]"
              checked={supplierForm.isCertified}
              onChange={(e) => setSupplierForm((f) => ({ ...f, isCertified: e.target.checked }))}
            />
            {tc('isCertified')}
          </label>
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
