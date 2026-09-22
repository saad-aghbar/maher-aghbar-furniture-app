'use client';

import { MasterCrudPage } from '@/components/admin/master-crud-page';
import { usePdfDownload } from '@/hooks/use-pdf-download';
import { useKitCopy } from '@/lib/kit-copy';
import { apiFetch, ApiClientError } from '@/lib/api-client';
import { mutationErrorMessage } from '@/hooks/use-api-mutation';
import { useAuthMe } from '@/hooks/use-auth-me';
import { Alert, Board, BoardSkeleton, Button, Combobox, ErrorBoard, Input, Ltr, Menu, QrDisplay, SectionTabs, Sheet, Stamp, useToast } from '@maher/ui';
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

  if (me.isLoading) return <BoardSkeleton rows={6} />;
  if (!canViewWarehouses) return <ErrorBoard title={tNav('warehouses')} />;

  return (
    <div className="space-y-5">
      <SectionTabs
        size="sm"
        aria-label={tNav('warehouses')}
        value={tab}
        onChange={(id) => setTab(id as 'warehouses' | 'bins')}
        items={[
          { id: 'warehouses', label: tNav('warehouses') },
          { id: 'bins', label: ti('binsTab') },
        ]}
      />

      {tab === 'warehouses' ? (
        <MasterCrudPage<Warehouse>
          title={tNav('warehouses')}
          queryKey="warehouses"
          listPath="/api/v1/warehouses"
          createPath={canManageWarehouses ? '/api/v1/warehouses' : undefined}
          patchPath={canManageWarehouses ? (id) => `/api/v1/warehouses/${id}` : undefined}
          activatePath={canManageWarehouses ? (id) => `/api/v1/warehouses/${id}/activate` : undefined}
          deactivatePath={canManageWarehouses ? (id) => `/api/v1/warehouses/${id}/deactivate` : undefined}
          description={ti('warehousesHint')}
          emptyTitle={ti('noWarehouses')}
          activeField="isActive"
          activeFilter={false}
          chips={WAREHOUSE_TYPES.map((wt) => ({ id: wt.value, label: ti(wt.labelKey), params: { type: wt.value } }))}
          columns={[
            { key: 'code', header: t('code'), width: '120px', render: (r) => <Ltr className="text-[var(--maher-text-tertiary)]">{r.code}</Ltr> },
            { key: 'name', header: t('name'), render: (r) => <span className="font-semibold text-[var(--maher-text-primary)]">{localizedName(locale, r)}</span> },
            { key: 'type', header: ti('warehouseType'), hideBelow: 'md', render: (r) => <Stamp tone={r.type === 'FINISHED_GOODS' ? 'success' : r.type === 'SEMI_FINISHED' ? 'info' : 'brand'} size="sm">{typeLabel(r.type)}</Stamp> },
            { key: 'bins', header: ti('bins'), numeric: true, hideBelow: 'lg', render: (r) => String(r.locations?.length ?? 0) },
            { key: 'isDefault', header: ti('isDefault'), hideBelow: 'lg', render: (r) => (r.isDefault ? <Stamp tone="warning" size="sm">{ti('defaultBin')}</Stamp> : '—') },
          ]}
          mobileRow={(r) => ({ title: localizedName(locale, r), meta: `${r.code} · ${typeLabel(r.type)}` })}
          fields={[
            { name: 'code', label: t('code'), required: true, dir: 'ltr', half: true },
            { name: 'type', label: ti('warehouseType'), type: 'select', required: true, half: true, options: WAREHOUSE_TYPES.map((wt) => ({ value: wt.value, label: ti(wt.labelKey) })) },
            { name: 'nameAr', label: t('nameAr'), required: true, dir: 'rtl', half: true },
            { name: 'nameEn', label: t('nameEn'), required: true, dir: 'ltr', half: true },
            { name: 'isDefault', label: ti('isDefault'), type: 'checkbox' },
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
  const kit = useKitCopy();
  const toast = useToast();
  const qc = useQueryClient();
  const { openPdf, pdfDialog } = usePdfDownload();
  const [warehouseId, setWarehouseId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<WarehouseLocation | null>(null);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [preview, setPreview] = useState<WarehouseLocation | null>(null);

  const warehousesQuery = useQuery({ queryKey: ['warehouses', 'bins-tab'], queryFn: () => apiFetch<{ data: Warehouse[] }>('/api/v1/warehouses?pageSize=100') });
  const warehouses = warehousesQuery.data?.data ?? [];
  const selected = warehouses.find((w) => w.id === warehouseId) ?? warehouses[0];
  const effectiveId = selected?.id ?? '';
  useEffect(() => {
    if (!warehouseId && warehouses.length) {
      const preferred = warehouses.find((w) => w.code === 'RAW') ?? warehouses.find((w) => w.type === 'RAW_MATERIALS') ?? warehouses[0];
      if (preferred?.id) setWarehouseId(preferred.id);
    }
  }, [warehouseId, warehouses]);
  const locations = useMemo(() => [...(selected?.locations ?? [])].sort((a, b) => a.code.localeCompare(b.code)), [selected?.locations]);
  const active = locations.filter((l) => l.isActive !== false).length;

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!effectiveId) throw new ApiClientError(ti('noWarehouses'), 400);
      if (editing) return apiFetch(`/api/v1/warehouses/${effectiveId}/locations/${editing.id}`, { method: 'PATCH', body: JSON.stringify({ code: code.trim() || undefined, name: name.trim() || null }) });
      return apiFetch(`/api/v1/warehouses/${effectiveId}/locations`, { method: 'POST', body: JSON.stringify({ code: code.trim() || undefined, name: name.trim() || code.trim() }) });
    },
    onSuccess: async () => {
      setFormOpen(false);
      setEditing(null);
      setError(null);
      toast.success(tCommon('saved'));
      await qc.invalidateQueries({ queryKey: ['warehouses'] });
    },
    onError: (err) => setError(mutationErrorMessage(err)),
  });
  const toggleMutation = useMutation({
    mutationFn: (loc: WarehouseLocation) => apiFetch(`/api/v1/warehouses/${effectiveId}/locations/${loc.id}`, { method: 'PATCH', body: JSON.stringify({ isActive: !loc.isActive }) }),
    onSuccess: async () => qc.invalidateQueries({ queryKey: ['warehouses'] }),
    onError: (err) => toast.error(mutationErrorMessage(err)),
  });

  const openCreate = () => (setEditing(null), setCode(''), setName(''), setFormOpen(true));
  const openEdit = (loc: WarehouseLocation) => (setEditing(loc), setCode(loc.code), setName(loc.name ?? ''), setFormOpen(true));
  const printLabel = (loc: WarehouseLocation) => openPdf({ path: `/api/v1/warehouses/${effectiveId}/locations/${loc.id}/qr-label`, documentName: `${ti('printBinLabel')} · ${loc.code}`, filename: `${selected?.code ?? 'bin'}-${loc.code}.pdf` });
  const printSheet = () => effectiveId && openPdf({ path: `/api/v1/warehouses/${effectiveId}/locations/label-sheet`, documentName: `${ti('printBinSheet')} · ${selected?.code ?? ''}`, filename: `${selected?.code ?? 'bins'}-labels.pdf` });

  return (
    <div className="maher-stagger space-y-5">
      <Board tone="brand" wash="top">
        <div className="grid gap-5 px-5 py-5 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-end">
          <div className="min-w-0">
            <h1 className="text-[24px] font-semibold leading-8 tracking-[-0.02em] text-[var(--maher-text-primary)] sm:text-[28px] sm:leading-9 rtl:tracking-normal">{ti('binsTab')}</h1>
            <p className="mt-1 max-w-[56ch] text-[14px] leading-5 text-[var(--maher-text-secondary)]">{ti('binsHint')}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {canManage && effectiveId ? (
                <Button variant="secondary" onClick={printSheet}>
                  {ti('printBinSheet')}
                </Button>
              ) : null}
              {canManage ? (
                <Button onClick={openCreate} disabled={!effectiveId}>
                  {ti('addBin')}
                </Button>
              ) : null}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
            <Combobox label={ti('warehouse')} value={effectiveId || null} onChange={(v) => v && setWarehouseId(v)} options={warehouses.map((w) => ({ value: w.id, label: localizedName(locale, w), description: w.code }))} clearable={false} emptyText={kit.combobox.empty} />
            <div className="flex gap-4">
              <span className="text-center">
                <span className="block text-[20px] font-semibold leading-6 text-[var(--maher-text-primary)]" dir="ltr">{locations.length}</span>
                <span className="block text-[12px] text-[var(--maher-text-tertiary)]">{ti('bins')}</span>
              </span>
              <span className="text-center">
                <span className="block text-[20px] font-semibold leading-6 text-[var(--maher-success)]" dir="ltr">{active}</span>
                <span className="block text-[12px] text-[var(--maher-text-tertiary)]">{tCommon('active')}</span>
              </span>
            </div>
          </div>
        </div>
      </Board>
      {error ? <Alert variant="error">{error}</Alert> : null}
      {warehousesQuery.isLoading && !warehousesQuery.data ? (
        <BoardSkeleton rows={4} />
      ) : warehousesQuery.isError && !warehousesQuery.data ? (
        <ErrorBoard title={ti('binsTab')} onRetry={() => warehousesQuery.refetch()} />
      ) : locations.length === 0 ? (
        <Board tone="neutral">
          <Board.Empty title={ti('noBins')} action={canManage ? <Button size="sm" onClick={openCreate}>{ti('addBin')}</Button> : undefined} />
        </Board>
      ) : (
        <div className="maher-stagger grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {locations.map((loc) => {
            const off = loc.isActive === false;
            return (
              <Board key={loc.id} as="article" tone={off ? 'neutral' : loc.isDefault ? 'warning' : 'brand'} interactive onClick={() => setPreview(loc)} className="h-full cursor-pointer">
                <Board.Body className="flex flex-col items-center gap-2 pt-5 text-center">
                  <QrDisplay value={loc.qrCode ?? loc.code} size={88} />
                  <Ltr className="text-[15px] font-semibold text-[var(--maher-text-primary)]">{loc.code}</Ltr>
                  {loc.name && loc.name !== loc.code ? <span className="truncate text-[12px] text-[var(--maher-text-secondary)]">{loc.name}</span> : null}
                  <span className="flex flex-wrap justify-center gap-1">
                    {loc.isDefault ? <Stamp tone="warning" size="sm">{ti('defaultBin')}</Stamp> : null}
                    {off ? <Stamp tone="neutral" size="sm">{tCommon('inactive')}</Stamp> : null}
                  </span>
                </Board.Body>
                <Board.Footer>
                  <Button size="sm" variant="ghost" onClick={(e) => (e.stopPropagation(), printLabel(loc))}>
                    {ti('printBinLabel')}
                  </Button>
                  {canManage && !loc.isDefault ? (
                    <span onClick={(e) => e.stopPropagation()}>
                      <Menu
                        aria-label={tCommon('actions')}
                        trigger={<Button size="sm" variant="ghost" aria-label={tCommon('actions')}>···</Button>}
                        items={[
                          { id: 'edit', label: ti('editBin'), onSelect: () => openEdit(loc) },
                          { id: 'toggle', label: off ? ti('activateBin') : ti('deactivateBin'), tone: off ? 'default' : 'error', onSelect: () => toggleMutation.mutate(loc) },
                        ]}
                      />
                    </span>
                  ) : null}
                </Board.Footer>
              </Board>
            );
          })}
        </div>
      )}

      <Sheet
        open={formOpen}
        onClose={() => !saveMutation.isPending && setFormOpen(false)}
        title={editing ? ti('editBin') : ti('addBin')}
        description={selected ? `${selected.code} · ${localizedName(locale, selected)}` : undefined}
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
        <div className="space-y-4">
          <Input label={ti('binCode')} value={code} onChange={(e) => setCode(e.target.value)} dir="ltr" />
          <Input label={ti('binName')} value={name} onChange={(e) => setName(e.target.value)} />
        </div>
      </Sheet>

      <Sheet open={Boolean(preview)} onClose={() => setPreview(null)} title={preview?.code ?? ''} description={preview?.name ?? undefined} footer={preview ? <Button onClick={() => printLabel(preview)}>{ti('printBinLabel')}</Button> : undefined}>
        {preview ? (
          <div className="flex flex-col items-center gap-3 py-2">
            <QrDisplay value={preview.qrCode ?? preview.code} size={220} label={preview.code} />
            <Ltr className="text-[12px] text-[var(--maher-text-tertiary)]">{preview.qrCode ?? preview.code}</Ltr>
          </div>
        ) : null}
      </Sheet>
      {pdfDialog}
    </div>
  );
}
