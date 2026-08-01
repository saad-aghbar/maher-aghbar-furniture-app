'use client';

import {
  LineItemsEditor,
  emptyLineItem,
  serializeLineItems,
  type LineItemDraft,
} from '@/components/admin/line-items-editor';
import { PageHeader } from '@/components/admin/page-header';
import { Link, useRouter } from '@/i18n/navigation';
import { apiFetch, ApiClientError } from '@/lib/api-client';
import {
  PURCHASE_ORDER_STATUSES,
  PURCHASE_REQUEST_STATUSES,
  statusOptions,
} from '@/lib/status-options';
import { mutationErrorMessage } from '@/hooks/use-api-mutation';
import {
  Alert,
  Button,
  EmptyState,
  ErrorState,
  Input,
  Modal,
  Select,
  Skeleton,
  StatusBadge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
  Tabs,
  TabList,
  Tab,
  TabPanel,
} from '@maher/ui';
import { localizedName } from '@maher/i18n';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';

interface Supplier {
  id: string;
  name: string;
  code: string;
  nameAr?: string | null;
  nameEn?: string | null;
}
interface Warehouse {
  id: string;
  code: string;
  nameEn: string;
  nameAr?: string;
}
interface InventoryItem {
  id: string;
  sku: string;
  nameEn: string;
  nameAr: string;
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
  supplier?: { name: string; nameAr?: string | null; nameEn?: string | null };
  total?: string | number;
  lines?: POLine[];
}
interface PRRow {
  id: string;
  number: string;
  status: string;
  reason?: string | null;
}

export default function PurchasingPage() {
  const locale = useLocale();
  const tNav = useTranslations('navigation');
  const tc = useTranslations('catalog');
  const tCommon = useTranslations('common');
  const tStatus = useTranslations('statuses');
  const queryClient = useQueryClient();
  const router = useRouter();

  const [banner, setBanner] = useState<string | null>(null);
  const [poOpen, setPoOpen] = useState(false);
  const [prOpen, setPrOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [supplierId, setSupplierId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [inventoryItemId, setInventoryItemId] = useState('');
  const [poLines, setPoLines] = useState<LineItemDraft[]>([emptyLineItem()]);
  const [prLines, setPrLines] = useState<LineItemDraft[]>([emptyLineItem()]);
  const [prReason, setPrReason] = useState('');
  const [poSearch, setPoSearch] = useState('');
  const [prSearch, setPrSearch] = useState('');
  const [poStatus, setPoStatus] = useState('');
  const [prStatus, setPrStatus] = useState('');

  const poParams = useMemo(() => {
    const params = new URLSearchParams({ pageSize: '100' });
    if (poSearch.trim()) params.set('q', poSearch.trim());
    if (poStatus) params.set('status', poStatus);
    return params.toString();
  }, [poSearch, poStatus]);

  const prParams = useMemo(() => {
    const params = new URLSearchParams({ pageSize: '100' });
    if (prSearch.trim()) params.set('q', prSearch.trim());
    if (prStatus) params.set('status', prStatus);
    return params.toString();
  }, [prSearch, prStatus]);

  const poQuery = useQuery({
    queryKey: ['purchase-orders', poParams],
    queryFn: () =>
      apiFetch<{ data: PORow[] }>(`/api/v1/purchase-orders?${poParams}`).then((r) => r.data),
  });
  const prQuery = useQuery({
    queryKey: ['purchase-requests', prParams],
    queryFn: () =>
      apiFetch<{ data: PRRow[] }>(`/api/v1/purchase-requests?${prParams}`).then((r) => r.data),
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
  const itemsQuery = useQuery({
    queryKey: ['inventory-items-pick'],
    queryFn: () =>
      apiFetch<{ data: InventoryItem[] }>('/api/v1/inventory/items?pageSize=100').then((r) => r.data),
  });

  const poStatusOpts = statusOptions(tStatus, PURCHASE_ORDER_STATUSES, {
    label: tCommon('all'),
  });
  const prStatusOpts = statusOptions(tStatus, PURCHASE_REQUEST_STATUSES, {
    label: tCommon('all'),
  });

  const createPo = useMutation({
    mutationFn: async () => {
      const lines = serializeLineItems(poLines).map((line) => ({
        description: line.description,
        quantity: line.quantity,
        unitPrice: line.unitPrice ?? 0,
        inventoryItemId: inventoryItemId || undefined,
      }));
      if (!supplierId || lines.length === 0) {
        throw new ApiClientError(tc('selectSupplierRequired'), 400);
      }
      if (!inventoryItemId) {
        throw new ApiClientError(tc('selectInventoryItemRequired'), 400);
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
      const lines = serializeLineItems(prLines, { includePrice: false }).map((line) => ({
        description: line.description,
        quantity: line.quantity,
        unitPrice: 0,
        inventoryItemId: inventoryItemId || undefined,
      }));
      if (lines.length === 0) throw new ApiClientError(tc('lineDescriptionRequired'), 400);
      return apiFetch('/api/v1/purchase-requests', {
        method: 'POST',
        body: JSON.stringify({
          reason: prReason.trim() || undefined,
          warehouseId: warehouseId || undefined,
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

  if (poQuery.isLoading || prQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
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
  const suppliers = suppliersQuery.data ?? [];
  const warehouses = warehousesQuery.data ?? [];
  const items = itemsQuery.data ?? [];

  function itemLabel(item: InventoryItem) {
    return `${item.sku} — ${localizedName(locale, item)}`;
  }

  function supplierLabel(s: Supplier) {
    const localized =
      s.nameAr || s.nameEn ? localizedName(locale, s, s.name) : s.name;
    return `${s.code} — ${localized}`;
  }

  function resetPoForm() {
    setSupplierId(suppliers[0]?.id ?? '');
    setWarehouseId(warehouses[0]?.id ?? '');
    setInventoryItemId(items[0]?.id ?? '');
    setPoLines([
      emptyLineItem({
        description: items[0] ? itemLabel(items[0]) : '',
        quantity: '1',
        unitPrice: '0',
      }),
    ]);
    setFormError(null);
  }

  function resetPrForm() {
    setWarehouseId(warehouses[0]?.id ?? '');
    setInventoryItemId(items[0]?.id ?? '');
    setPrReason('');
    setPrLines([emptyLineItem({ quantity: '1', unitPrice: '0' })]);
    setFormError(null);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={tNav('purchasing')}
        actions={
          <>
            <Button
              variant="ghost"
              loading={fromLowStock.isPending}
              onClick={() => fromLowStock.mutate()}
            >
              {tc('fromLowStock')}
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                resetPrForm();
                setPrOpen(true);
              }}
            >
              {tc('newPurchaseRequest')}
            </Button>
            <Button
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
      {banner ? <Alert variant="success">{banner}</Alert> : null}

      <Tabs defaultValue="orders">
        <TabList>
          <Tab value="orders">{tc('purchaseOrders')}</Tab>
          <Tab value="requests">{tc('purchaseRequests')}</Tab>
        </TabList>
        <TabPanel value="orders">
          <div className="mb-4 flex flex-wrap gap-3">
            <Input
              value={poSearch}
              onChange={(e) => setPoSearch(e.target.value)}
              placeholder={tCommon('search')}
              leadingIcon={<Search className="h-4 w-4" />}
              className="max-w-xs"
            />
            <Select
              label={tCommon('status')}
              value={poStatus}
              onChange={(e) => setPoStatus(e.target.value)}
              options={poStatusOpts}
              className="max-w-xs"
            />
          </div>
          {orders.length === 0 ? (
            <EmptyState title={tc('noPurchaseOrders')} />
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>{tCommon('number')}</TableHeaderCell>
                  <TableHeaderCell>{tc('supplier')}</TableHeaderCell>
                  <TableHeaderCell>{tCommon('status')}</TableHeaderCell>
                  <TableHeaderCell>{tCommon('total')}</TableHeaderCell>
                  <TableHeaderCell>{tCommon('actions')}</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {orders.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <Link
                        href={`/purchasing/${row.id}`}
                        className="font-medium text-brand hover:underline"
                      >
                        <span dir="ltr">{row.number}</span>
                      </Link>
                    </TableCell>
                    <TableCell>
                      {row.supplier
                        ? row.supplier.nameAr || row.supplier.nameEn
                          ? localizedName(locale, row.supplier, row.supplier.name)
                          : row.supplier.name
                        : '—'}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={row.status} />
                    </TableCell>
                    <TableCell>
                      <span dir="ltr">{String(row.total ?? '—')}</span>
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/purchasing/${row.id}`}
                        className="text-sm text-brand hover:underline"
                      >
                        {tCommon('details')}
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TabPanel>
        <TabPanel value="requests">
          <div className="mb-4 flex flex-wrap gap-3">
            <Input
              value={prSearch}
              onChange={(e) => setPrSearch(e.target.value)}
              placeholder={tCommon('search')}
              leadingIcon={<Search className="h-4 w-4" />}
              className="max-w-xs"
            />
            <Select
              label={tCommon('status')}
              value={prStatus}
              onChange={(e) => setPrStatus(e.target.value)}
              options={prStatusOpts}
              className="max-w-xs"
            />
          </div>
          {requests.length === 0 ? (
            <EmptyState title={tc('noPurchaseRequests')} />
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>{tCommon('number')}</TableHeaderCell>
                  <TableHeaderCell>{tc('reason')}</TableHeaderCell>
                  <TableHeaderCell>{tCommon('status')}</TableHeaderCell>
                  <TableHeaderCell>{tCommon('actions')}</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {requests.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <Link
                        href={`/purchasing/requests/${row.id}`}
                        className="font-medium text-brand hover:underline"
                      >
                        <span dir="ltr">{row.number}</span>
                      </Link>
                    </TableCell>
                    <TableCell>{row.reason ?? '—'}</TableCell>
                    <TableCell>
                      <StatusBadge status={row.status} />
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/purchasing/requests/${row.id}`}
                        className="text-sm text-brand hover:underline"
                      >
                        {tCommon('details')}
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TabPanel>
      </Tabs>

      <Modal
        open={poOpen}
        onClose={() => !createPo.isPending && setPoOpen(false)}
        title={tc('newPurchaseOrder')}
        className="max-w-2xl"
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
        <div className="grid gap-3">
          {formError ? <Alert variant="error">{formError}</Alert> : null}
          <Select
            label={tc('supplier')}
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
          >
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {supplierLabel(s)}
              </option>
            ))}
          </Select>
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
          <Select
            label={tc('inventoryItem')}
            value={inventoryItemId}
            onChange={(e) => {
              setInventoryItemId(e.target.value);
              const item = items.find((i) => i.id === e.target.value);
              if (item && poLines.length === 1 && !poLines[0]?.description.trim()) {
                setPoLines([emptyLineItem({ description: itemLabel(item) })]);
              }
            }}
          >
            {items.map((i) => (
              <option key={i.id} value={i.id}>
                {itemLabel(i)}
              </option>
            ))}
          </Select>
          <LineItemsEditor lines={poLines} onChange={setPoLines} showUnitPrice />
        </div>
      </Modal>

      <Modal
        open={prOpen}
        onClose={() => !createPr.isPending && setPrOpen(false)}
        title={tc('newPurchaseRequest')}
        className="max-w-2xl"
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
        <div className="grid gap-3">
          {formError ? <Alert variant="error">{formError}</Alert> : null}
          <Input
            label={tc('reason')}
            value={prReason}
            onChange={(e) => setPrReason(e.target.value)}
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
          <LineItemsEditor lines={prLines} onChange={setPrLines} showUnitPrice={false} />
        </div>
      </Modal>
    </div>
  );
}
