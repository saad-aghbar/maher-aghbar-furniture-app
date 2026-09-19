'use client';

import { PageHeader } from '@/components/admin/page-header';
import { ConfirmDialog } from '@/components/admin/confirm-dialog';
import { Link, useRouter } from '@/i18n/navigation';
import { apiFetch, ApiClientError } from '@/lib/api-client';
import { mutationErrorMessage } from '@/hooks/use-api-mutation';
import {
  buildLowStockBatch,
  moveLowStockRow,
  seedExcludedCovered,
  seedLowStockRows,
  type LowStockItem,
  type LowStockRow,
} from '@/lib/low-stock-review';
import {
  Alert,
  Button,
  Card,
  EmptyState,
  ErrorState,
  NumberStepper,
  Select,
  Skeleton,
  StatusBadge,
  TextArea,
} from '@maher/ui';
import { localizedName } from '@maher/i18n';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';

type DraftGroup = {
  supplierId: string | null;
  supplier?: { id?: string; name?: string; nameEn?: string | null; nameAr?: string | null } | null;
  items: LowStockItem[];
};

type DraftResponse = {
  groups: DraftGroup[];
  unassigned: DraftGroup;
};

type Supplier = {
  id: string;
  name: string;
  nameEn?: string | null;
  nameAr?: string | null;
  nameHe?: string | null;
};

type Warehouse = {
  id: string;
  code: string;
  nameEn: string;
  nameAr?: string;
  type?: string;
  locations?: Array<{
    id: string;
    code: string;
    name?: string | null;
    isDefault?: boolean;
    isActive?: boolean;
  }>;
};

type PreviewCard = {
  id: string;
  supplierName: string;
  to: string | null;
  body: string;
  templateBody: string;
  status?: 'sent' | 'failed';
  error?: string;
};

export default function LowStockReviewPage() {
  const locale = useLocale();
  const router = useRouter();
  const queryClient = useQueryClient();
  const tc = useTranslations('catalog');
  const tPurchasing = useTranslations('purchasing');
  const tCommon = useTranslations('common');

  const [rows, setRows] = useState<LowStockRow[] | null>(null);
  const [excluded, setExcluded] = useState<Set<string> | null>(null);
  const [step, setStep] = useState<'review' | 'preview' | 'results'>('review');
  const [previews, setPreviews] = useState<PreviewCard[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savingDefault, setSavingDefault] = useState<string | null>(null);

  const draftQuery = useQuery({
    queryKey: ['low-stock-draft'],
    queryFn: () => apiFetch<DraftResponse>('/api/v1/purchase-orders/low-stock-draft'),
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

  const seeded = useMemo(() => {
    if (!draftQuery.data) return [];
    return seedLowStockRows([
      ...(draftQuery.data.groups ?? []),
      draftQuery.data.unassigned,
    ]);
  }, [draftQuery.data]);
  const working = rows ?? seeded;
  const workingExcluded = excluded ?? seedExcludedCovered(working);
  const groups = useMemo(() => {
    const map = new Map<string, LowStockRow[]>();
    for (const row of working) {
      const key = row.supplierId ?? 'unassigned';
      const list = map.get(key) ?? [];
      list.push(row);
      map.set(key, list);
    }
    return [...map.entries()].map(([supplierId, items]) => ({
      supplierId: supplierId === 'unassigned' ? null : supplierId,
      items,
    }));
  }, [working]);

  const suppliers = suppliersQuery.data ?? [];
  const warehouses = (warehousesQuery.data ?? []).filter(
    (w) => !w.type || w.type === 'RAW_MATERIALS',
  );

  function binsFor(warehouseId: string) {
    return (warehouses.find((w) => w.id === warehouseId)?.locations ?? []).filter(
      (loc) => loc.isActive !== false,
    );
  }

  function defaultBin(warehouseId: string, current?: string) {
    const bins = binsFor(warehouseId);
    if (current && bins.some((b) => b.id === current)) return current;
    return bins.find((b) => b.isDefault)?.id ?? bins[0]?.id ?? '';
  }
  const unassignedOpen = groups.some(
    (group) =>
      !group.supplierId &&
      group.items.some((row) => !workingExcluded.has(row.itemId) && Number(row.orderQty) > 0),
  );

  const batch = useMutation({
    mutationFn: async () => {
      if (unassignedOpen) throw new ApiClientError(tPurchasing('unassignedHint'), 400);
      const orders = buildLowStockBatch(
        working.map((row) => ({
          ...row,
          locationId: defaultBin(row.warehouseId, row.locationId),
        })),
        workingExcluded,
      );
      if (orders.length === 0) throw new ApiClientError(tc('selectMaterialRequired'), 400);
      return apiFetch<{ orders: Array<{ id: string; supplier?: Supplier | null }> }>(
        '/api/v1/purchase-orders/batch',
        { method: 'POST', body: JSON.stringify({ orders }) },
      );
    },
    onSuccess: async (result) => {
      const cards: PreviewCard[] = [];
      for (const order of result.orders ?? []) {
        const draft = await apiFetch<{ to: string | null; body: string }>(
          `/api/v1/purchase-orders/${order.id}/whatsapp-draft`,
          { method: 'POST' },
        );
        cards.push({
          id: order.id,
          supplierName: order.supplier
            ? localizedName(locale, order.supplier, order.supplier.name)
            : tc('supplier'),
          to: draft.to,
          body: draft.body,
          templateBody: draft.body,
        });
      }
      setPreviews(cards);
      setStep('preview');
      setBannerSafe(tc('draftOrdersCreated'));
      await queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
    },
    onError: (err) => setError(mutationErrorMessage(err)),
  });

  const [banner, setBanner] = useState<string | null>(null);
  function setBannerSafe(message: string) {
    setError(null);
    setBanner(message);
  }

  const sendAll = useMutation({
    mutationFn: () =>
      apiFetch<{ results: Array<{ id: string; ok: boolean; to?: string | null; error?: string }> }>(
        '/api/v1/purchase-orders/send-batch',
        {
          method: 'POST',
          body: JSON.stringify({
            orders: previews.map((card) => ({ id: card.id, body: card.body })),
          }),
        },
      ),
    onSuccess: (result) => {
      const byId = new Map((result.results ?? []).map((row) => [row.id, row]));
      setPreviews((prev) =>
        prev.map((card) => {
          const row = byId.get(card.id);
          return {
            ...card,
            status: row?.ok ? 'sent' : 'failed',
            error: row?.error,
            to: row?.to ?? card.to,
          };
        }),
      );
      setStep('results');
    },
    onError: (err) => setError(mutationErrorMessage(err)),
  });

  async function saveDefault(row: LowStockRow) {
    setSavingDefault(row.itemId);
    try {
      await apiFetch(`/api/v1/inventory/items/${row.itemId}`, {
        method: 'PATCH',
        body: JSON.stringify({ reorderQty: Number(row.orderQty) || 1 }),
      });
      setBannerSafe(tCommon('saved'));
    } catch (err) {
      setError(mutationErrorMessage(err));
    } finally {
      setSavingDefault(null);
    }
  }

  if (draftQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }
  if (draftQuery.isError) {
    return (
      <ErrorState
        title={tPurchasing('lowStock')}
        onRetry={() => draftQuery.refetch()}
        retryLabel={tCommon('retry')}
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader backHref="/admin/purchasing" title={tPurchasing('lowStock')} />
      {banner ? <Alert variant="success">{banner}</Alert> : null}
      {error ? <Alert variant="error">{error}</Alert> : null}

      {step === 'review' ? (
        working.length === 0 ? (
          <EmptyState title={tc('noPurchaseOrders')} />
        ) : (
          <div className="space-y-4">
            {groups.map((group) => {
              const supplier = suppliers.find((s) => s.id === group.supplierId);
              const title = group.supplierId
                ? supplier
                  ? localizedName(locale, supplier, supplier.name)
                  : group.supplierId
                : tc('unassigned');
              return (
                <Card key={group.supplierId ?? 'unassigned'} className="space-y-3 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="font-semibold">{title}</h2>
                    <span className="rounded-md bg-[var(--maher-surface-muted)] px-2.5 py-1 text-xs" dir="ltr">
                      {group.items.length}
                    </span>
                  </div>
                  {!group.supplierId ? (
                    <p className="text-sm text-text-secondary">{tPurchasing('unassignedHint')}</p>
                  ) : null}
                  {group.items.map((row) => {
                    const out = workingExcluded.has(row.itemId);
                    return (
                      <div
                        key={row.itemId}
                        className={`grid gap-3 rounded-xl border border-border p-3 sm:grid-cols-2 ${
                          out ? 'opacity-40' : ''
                        }`}
                      >
                        <div>
                          <p className="font-medium">{row.description}</p>
                          <p className="text-xs text-text-secondary" dir="ltr">
                            {row.sku || row.itemId}
                          </p>
                        </div>
                        <NumberStepper
                          label={tc('qty')}
                          value={row.orderQty}
                          min={0}
                          disabled={out}
                          onChange={(orderQty) =>
                            setRows((prev) =>
                              (prev ?? working).map((item) =>
                                item.itemId === row.itemId ? { ...item, orderQty } : item,
                              ),
                            )
                          }
                        />
                        <Select
                          label={tPurchasing('destination')}
                          value={row.warehouseId}
                          disabled={out}
                          onChange={(e) =>
                            setRows((prev) =>
                              (prev ?? working).map((item) =>
                                item.itemId === row.itemId
                                  ? {
                                      ...item,
                                      warehouseId: e.target.value,
                                      locationId: defaultBin(e.target.value),
                                    }
                                  : item,
                              ),
                            )
                          }
                        >
                          {warehouses.map((w) => (
                            <option key={w.id} value={w.id}>
                              {w.code} — {localizedName(locale, w)}
                            </option>
                          ))}
                        </Select>
                        <Select
                          label={tPurchasing('bin')}
                          value={defaultBin(row.warehouseId, row.locationId)}
                          disabled={out}
                          onChange={(e) =>
                            setRows((prev) =>
                              (prev ?? working).map((item) =>
                                item.itemId === row.itemId
                                  ? { ...item, locationId: e.target.value }
                                  : item,
                              ),
                            )
                          }
                        >
                          {binsFor(row.warehouseId).map((loc) => (
                            <option key={loc.id} value={loc.id}>
                              {loc.code}
                              {loc.name ? ` — ${loc.name}` : ''}
                            </option>
                          ))}
                        </Select>
                        <Select
                          label={tc('supplier')}
                          value={row.supplierId ?? ''}
                          disabled={out}
                          onChange={(e) =>
                            setRows((prev) =>
                              moveLowStockRow(prev ?? working, row.itemId, e.target.value || null),
                            )
                          }
                        >
                          <option value="">{tc('unassigned')}</option>
                          {suppliers.map((s) => (
                            <option key={s.id} value={s.id}>
                              {localizedName(locale, s, s.name)}
                            </option>
                          ))}
                        </Select>
                        <div className="flex flex-wrap gap-2 sm:col-span-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() =>
                              setExcluded((prev) => {
                                const next = new Set(prev ?? workingExcluded);
                                if (next.has(row.itemId)) next.delete(row.itemId);
                                else next.add(row.itemId);
                                return next;
                              })
                            }
                          >
                            {out ? tPurchasing('include') : tPurchasing('exclude')}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            loading={savingDefault === row.itemId}
                            onClick={() => void saveDefault(row)}
                          >
                            {tPurchasing('saveAsDefault')}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </Card>
              );
            })}
            <Button
              disabled={unassignedOpen || batch.isPending}
              loading={batch.isPending}
              onClick={() => setConfirmOpen(true)}
            >
              {tPurchasing('createDraft')}
            </Button>
          </div>
        )
      ) : null}

      {step !== 'review' ? (
        <div className="space-y-4">
          {previews.map((card) => (
            <Card key={card.id} className="space-y-3 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold">{card.supplierName}</p>
                  {card.to ? (
                    <p className="text-sm text-text-secondary" dir="ltr">
                      {card.to}
                    </p>
                  ) : null}
                </div>
                {card.status ? <StatusBadge status={card.status.toUpperCase()} /> : null}
              </div>
              <TextArea
                label={tPurchasing('whatsappPreview')}
                value={card.body}
                disabled={step === 'results'}
                onChange={(e) =>
                  setPreviews((prev) =>
                    prev.map((row) => (row.id === card.id ? { ...row, body: e.target.value } : row)),
                  )
                }
              />
              {step === 'preview' ? (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    setPreviews((prev) =>
                      prev.map((row) =>
                        row.id === card.id ? { ...row, body: row.templateBody } : row,
                      ),
                    )
                  }
                >
                  {tPurchasing('resetTemplate')}
                </Button>
              ) : (
                <Link href={`/admin/purchasing/${card.id}`} className="text-sm font-medium text-brand">
                  {tCommon('details')}
                </Link>
              )}
              {card.error ? <p className="text-sm text-[var(--maher-error)]">{card.error}</p> : null}
            </Card>
          ))}
          {step === 'preview' ? (
            <Button loading={sendAll.isPending} onClick={() => sendAll.mutate()}>
              {tPurchasing('sendAll')}
            </Button>
          ) : (
            <Button variant="secondary" onClick={() => router.push('/admin/purchasing')}>
              {tCommon('back')}
            </Button>
          )}
        </div>
      ) : null}

      <ConfirmDialog
        open={confirmOpen}
        title={tPurchasing('createDraft')}
        description={tc('draftOrdersCreated')}
        confirmLabel={tPurchasing('createDraft')}
        loading={batch.isPending}
        error={error}
        onConfirm={() => {
          setConfirmOpen(false);
          batch.mutate();
        }}
        onClose={() => setConfirmOpen(false)}
      />
    </div>
  );
}
