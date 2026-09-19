'use client';

import { MasterCrudPage } from '@/components/admin/master-crud-page';
import { PageHeader } from '@/components/admin/page-header';
import { apiFetch, API_URL, ApiClientError } from '@/lib/api-client';
import { mutationErrorMessage } from '@/hooks/use-api-mutation';
import { useAuthMe } from '@/hooks/use-auth-me';
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
} from '@maher/ui';
import { localizedName } from '@maher/i18n';
import { can } from '@maher/permissions';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';

interface WarehouseLocation {
  id: string;
  code: string;
  name?: string | null;
  qrCode?: string | null;
  isDefault?: boolean;
  isActive?: boolean;
}

interface Warehouse {
  id: string;
  code: string;
  nameAr: string;
  nameEn: string;
  type: string;
  isActive: boolean;
  isDefault?: boolean;
  locations?: WarehouseLocation[];
}

const WAREHOUSE_TYPES = [
  { value: 'RAW_MATERIALS', labelKey: 'warehouseTypeRaw' as const },
  { value: 'SEMI_FINISHED', labelKey: 'warehouseTypeSemi' as const },
  { value: 'FINISHED_GOODS', labelKey: 'warehouseTypeFinished' as const },
];

export default function WarehousesPage() {
  const t = useTranslations('catalog');
  const ti = useTranslations('inventory');
  const tNav = useTranslations('navigation');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const me = useAuthMe();
  const canManageWarehouses = can(me.data, 'warehouse.manage');
  const canManageBins = canManageWarehouses || can(me.data, 'inventory.receive');
  const canViewWarehouses = canManageWarehouses || can(me.data, 'warehouse.read');
  const [tab, setTab] = useState<'warehouses' | 'bins'>('warehouses');

  const typeLabel = (type: string) => {
    const found = WAREHOUSE_TYPES.find((row) => row.value === type);
    return found ? ti(found.labelKey) : type;
  };

  if (me.isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!canViewWarehouses) {
    return <ErrorState title={tNav('warehouses')} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant={tab === 'warehouses' ? 'primary' : 'subtle'}
          onClick={() => setTab('warehouses')}
        >
          {tNav('warehouses')}
        </Button>
        <Button
          size="sm"
          variant={tab === 'bins' ? 'primary' : 'subtle'}
          onClick={() => setTab('bins')}
        >
          {ti('binsTab')}
        </Button>
      </div>

      {tab === 'warehouses' ? (
        <MasterCrudPage<Warehouse>
          title={tNav('warehouses')}
          queryKey="warehouses"
          listPath="/api/v1/warehouses"
          createPath={canManageWarehouses ? '/api/v1/warehouses' : undefined}
          patchPath={canManageWarehouses ? (id) => `/api/v1/warehouses/${id}` : undefined}
          activatePath={canManageWarehouses ? (id) => `/api/v1/warehouses/${id}/activate` : undefined}
          deactivatePath={canManageWarehouses ? (id) => `/api/v1/warehouses/${id}/deactivate` : undefined}
          emptyTitle={ti('noWarehouses')}
          activeField="isActive"
          columns={[
            { key: 'code', header: t('code'), render: (r) => <span dir="ltr">{r.code}</span> },
            {
              key: 'name',
              header: t('name'),
              render: (r) => localizedName(locale, r),
            },
            {
              key: 'type',
              header: ti('warehouseType'),
              render: (r) => typeLabel(r.type),
            },
            {
              key: 'isDefault',
              header: ti('isDefault'),
              render: (r) => (r.isDefault ? tCommon('yes') : tCommon('no')),
            },
            {
              key: 'status',
              header: tCommon('status'),
              render: (r) => <StatusBadge status={r.isActive ? 'ACTIVE' : 'INACTIVE'} />,
            },
          ]}
          fields={[
            { name: 'code', label: t('code'), required: true },
            { name: 'nameEn', label: t('nameEn'), required: true },
            { name: 'nameAr', label: t('nameAr'), required: true },
            {
              name: 'type',
              label: ti('warehouseType'),
              type: 'select',
              required: true,
              options: WAREHOUSE_TYPES.map((wt) => ({
                value: wt.value,
                label: ti(wt.labelKey),
              })),
            },
            {
              name: 'isDefault',
              label: ti('isDefault'),
              type: 'checkbox',
            },
          ]}
          mapRowToForm={(r) => ({
            code: r.code,
            nameEn: r.nameEn,
            nameAr: r.nameAr,
            type: r.type || 'RAW_MATERIALS',
            isDefault: Boolean(r.isDefault),
          })}
          buildPayload={(form) => ({
            code: String(form.code).trim(),
            nameEn: String(form.nameEn).trim(),
            nameAr: String(form.nameAr).trim(),
            type: String(form.type || 'RAW_MATERIALS'),
            isDefault: Boolean(form.isDefault),
          })}
        />
      ) : (
        <WarehouseBinsPanel canManage={canManageBins} />
      )}
    </div>
  );
}

function WarehouseBinsPanel({ canManage }: { canManage: boolean }) {
  const ti = useTranslations('inventory');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const qc = useQueryClient();
  const [warehouseId, setWarehouseId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<WarehouseLocation | null>(null);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');

  const warehousesQuery = useQuery({
    queryKey: ['warehouses', 'bins-tab'],
    queryFn: () => apiFetch<{ data: Warehouse[] }>('/api/v1/warehouses?pageSize=100'),
  });
  const warehouses = warehousesQuery.data?.data ?? [];
  const selected = warehouses.find((w) => w.id === warehouseId) ?? warehouses[0];
  const effectiveId = selected?.id ?? '';
  useEffect(() => {
    if (!warehouseId && warehouses.length) {
      const preferred =
        warehouses.find((w) => w.code === 'RAW') ??
        warehouses.find((w) => w.type === 'RAW_MATERIALS') ??
        warehouses[0];
      if (preferred?.id) setWarehouseId(preferred.id);
    }
  }, [warehouseId, warehouses]);
  const locations = useMemo(
    () => [...(selected?.locations ?? [])].sort((a, b) => a.code.localeCompare(b.code)),
    [selected?.locations],
  );

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!effectiveId) throw new ApiClientError(ti('noWarehouses'), 400);
      if (editing) {
        return apiFetch(`/api/v1/warehouses/${effectiveId}/locations/${editing.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            code: code.trim() || undefined,
            name: name.trim() || null,
          }),
        });
      }
      return apiFetch(`/api/v1/warehouses/${effectiveId}/locations`, {
        method: 'POST',
        body: JSON.stringify({
          code: code.trim() || undefined,
          name: name.trim() || code.trim(),
        }),
      });
    },
    onSuccess: async () => {
      setFormOpen(false);
      setEditing(null);
      setError(null);
      await qc.invalidateQueries({ queryKey: ['warehouses'] });
    },
    onError: (err) => setError(mutationErrorMessage(err)),
  });

  const toggleMutation = useMutation({
    mutationFn: (loc: WarehouseLocation) =>
      apiFetch(`/api/v1/warehouses/${effectiveId}/locations/${loc.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !loc.isActive }),
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['warehouses'] });
    },
    onError: (err) => setError(mutationErrorMessage(err)),
  });

  function openCreate() {
    setEditing(null);
    setCode('');
    setName('');
    setFormOpen(true);
  }

  function openEdit(loc: WarehouseLocation) {
    setEditing(loc);
    setCode(loc.code);
    setName(loc.name ?? '');
    setFormOpen(true);
  }

  function printLabel(loc: WarehouseLocation) {
    window.open(
      `${API_URL}/api/v1/warehouses/${effectiveId}/locations/${loc.id}/qr-label?lang=${locale}`,
      '_blank',
    );
  }

  function printSheet() {
    if (!effectiveId) return;
    window.open(
      `${API_URL}/api/v1/warehouses/${effectiveId}/locations/label-sheet?lang=${locale}`,
      '_blank',
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={ti('binsTab')}
        actions={
          <>
            {canManage && effectiveId ? (
              <Button size="sm" variant="secondary" onClick={printSheet}>
                {ti('printBinSheet')}
              </Button>
            ) : null}
            {canManage ? (
              <Button size="sm" onClick={openCreate} disabled={!effectiveId}>
                {ti('addBin')}
              </Button>
            ) : null}
          </>
        }
      />
      {error ? <Alert variant="error">{error}</Alert> : null}
      {warehousesQuery.isLoading && !warehousesQuery.data ? (
        <div className="space-y-3">
          <Skeleton className="h-10 w-full max-w-md" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : warehousesQuery.isError && !warehousesQuery.data ? (
        <ErrorState
          title={ti('binsTab')}
          onRetry={() => warehousesQuery.refetch()}
          retryLabel={tCommon('retry')}
        />
      ) : (
        <>
      <Select
        label={ti('warehouse')}
        value={effectiveId}
        onChange={(e) => setWarehouseId(e.target.value)}
      >
        {warehouses.map((w) => (
          <option key={w.id} value={w.id}>
            {w.code} — {localizedName(locale, w)}
          </option>
        ))}
      </Select>
      {locations.length === 0 ? (
        <EmptyState title={ti('noBins')} />
      ) : (
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>{ti('binCode')}</TableHeaderCell>
              <TableHeaderCell>{ti('binName')}</TableHeaderCell>
              <TableHeaderCell>{tCommon('status')}</TableHeaderCell>
              <TableHeaderCell>{tCommon('actions')}</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {locations.map((loc) => (
              <TableRow key={loc.id}>
                <TableCell>
                  <span dir="ltr">{loc.code}</span>
                  {loc.isDefault ? (
                    <span className="ms-2 text-xs text-text-secondary">{ti('defaultBin')}</span>
                  ) : null}
                </TableCell>
                <TableCell>{loc.name || '—'}</TableCell>
                <TableCell>
                  <StatusBadge status={loc.isActive === false ? 'INACTIVE' : 'ACTIVE'} />
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="ghost" onClick={() => printLabel(loc)}>
                      {ti('printBinLabel')}
                    </Button>
                    {canManage && !loc.isDefault ? (
                      <Button size="sm" variant="ghost" onClick={() => openEdit(loc)}>
                        {ti('editBin')}
                      </Button>
                    ) : null}
                    {canManage && !loc.isDefault ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        loading={toggleMutation.isPending && toggleMutation.variables?.id === loc.id}
                        onClick={() => toggleMutation.mutate(loc)}
                      >
                        {loc.isActive === false ? ti('activateBin') : ti('deactivateBin')}
                      </Button>
                    ) : null}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Modal
        open={formOpen}
        onClose={() => !saveMutation.isPending && setFormOpen(false)}
        title={editing ? ti('editBin') : ti('addBin')}
        footer={
          <>
            <Button variant="ghost" disabled={saveMutation.isPending} onClick={() => setFormOpen(false)}>
              {tCommon('cancel')}
            </Button>
            <Button loading={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
              {tCommon('save')}
            </Button>
          </>
        }
      >
        <div className="grid gap-3">
          <Input label={ti('binCode')} value={code} onChange={(e) => setCode(e.target.value)} dir="ltr" />
          <Input label={ti('binName')} value={name} onChange={(e) => setName(e.target.value)} />
        </div>
      </Modal>
        </>
      )}
    </div>
  );
}
