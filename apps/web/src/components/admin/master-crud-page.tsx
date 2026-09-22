'use client';

import { mutationErrorMessage } from '@/hooks/use-api-mutation';
import { ApiClientError, apiFetch } from '@/lib/api-client';
import { useKitCopy } from '@/lib/kit-copy';
import { useListParams } from '@/lib/use-list-params';
import {
  Alert,
  Board,
  BoardSkeleton,
  Button,
  Checkbox,
  Combobox,
  ConfirmDialog,
  DataBoard,
  ErrorBoard,
  Figure,
  Input,
  ListToolbar,
  Menu,
  NumberField,
  Pagination,
  SegmentedControl,
  Sheet,
  Stamp,
  StatusChips,
  Switch,
  TextArea,
  useToast,
  type DataColumn,
} from '@maher/ui';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LayoutGrid, List, MoreHorizontal, Pencil, Plus, Power, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Suspense, useMemo, useState, type ReactNode } from 'react';

export interface CrudColumn<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  numeric?: boolean;
  hideBelow?: 'md' | 'lg' | 'xl';
  width?: string;
}

export interface CrudField {
  name: string;
  label: string;
  type?: 'text' | 'number' | 'checkbox' | 'select' | 'textarea' | 'multiselect';
  required?: boolean;
  options?: Array<{ value: string; label: string; description?: string }>;
  hint?: string;
  /** `ltr` for codes/SKUs, `rtl` for Arabic/Hebrew names. */
  dir?: 'ltr' | 'rtl';
  /** Put two fields on one row. */
  half?: boolean;
}

export type CrudFormValue = string | boolean | number | string[];
export type CrudForm = Record<string, CrudFormValue>;

export interface CrudChip {
  id: string;
  label: string;
  count?: number | null;
  /** Query params applied to the list when the chip is active. */
  params: Record<string, string>;
}

interface MasterCrudPageProps<T extends { id: string }> {
  title: string;
  description?: string;
  queryKey: string;
  listPath: string;
  createPath?: string;
  patchPath?: (id: string) => string;
  activatePath?: (id: string) => string;
  deactivatePath?: (id: string) => string;
  deletePath?: (id: string) => string;
  columns: CrudColumn<T>[];
  fields: CrudField[];
  emptyTitle: string;
  emptyDescription?: string;
  mapRowToForm?: (row: T) => CrudForm;
  buildPayload?: (form: CrudForm) => Record<string, unknown>;
  activeField?: keyof T;
  /** Server supports `isActive=true|false` — shows the All / Active / Inactive control. */
  activeFilter?: boolean;
  /** Category chips above the list (single-select). */
  chips?: CrudChip[];
  /** Optional tile renderer; enables the grid/list toggle (fabric swatches, colors). */
  tile?: (row: T, open: () => void) => ReactNode;
  /** Hero figures: computed from the current page's rows unless `stats` is passed. */
  stats?: Array<{ label: string; value: ReactNode; tone?: 'brand' | 'success' | 'warning' | 'error' | 'info' | 'neutral' }>;
  extraActions?: (row: T, refresh: () => void) => ReactNode;
  /** Extra row menu items. */
  rowMenu?: (row: T, refresh: () => void) => Array<{ id: string; label: string; icon?: ReactNode; onSelect?: () => void; href?: string; tone?: 'default' | 'error'; disabled?: boolean }>;
  /** Mobile row summary. */
  mobileRow?: (row: T) => { title: ReactNode; meta?: ReactNode; trailing?: ReactNode; leading?: ReactNode };
  primaryLabel?: string;
  pageSize?: number;
  tone?: 'brand' | 'success' | 'warning' | 'error' | 'info' | 'neutral';
}

const readActive = (v: unknown): boolean | undefined => (v === undefined || v === null ? undefined : typeof v === 'string' ? v === 'ACTIVE' || v.toLowerCase() === 'true' : Boolean(v));

/**
 * MasterBoard — every master-data page (materials, fabrics, spec options, suppliers,
 * warehouses…) on one recipe: hero figures, toolbar, DataBoard or tile grid,
 * create/edit Sheet, activate/deactivate stamps, confirm dialogs, URL-synced filters.
 */
export function MasterCrudPage<T extends { id: string }>(props: MasterCrudPageProps<T>) {
  return (
    <Suspense fallback={<BoardSkeleton rows={6} />}>
      <MasterBoardInner {...props} />
    </Suspense>
  );
}

export const MasterBoard = MasterCrudPage;

function MasterBoardInner<T extends { id: string }>({
  title,
  description,
  queryKey,
  listPath,
  createPath,
  patchPath,
  activatePath,
  deactivatePath,
  deletePath,
  columns,
  fields,
  emptyTitle,
  emptyDescription,
  mapRowToForm,
  buildPayload,
  activeField,
  activeFilter,
  chips,
  tile,
  stats,
  extraActions,
  rowMenu,
  mobileRow,
  primaryLabel,
  pageSize = 24,
  tone = 'brand',
}: MasterCrudPageProps<T>) {
  const tCommon = useTranslations('common');
  const tVal = useTranslations('validation');
  const kit = useKitCopy();
  const toast = useToast();
  const qc = useQueryClient();
  const { params, set, reset, activeCount } = useListParams({ defaults: { q: '', active: '' as '' | 'true' | 'false', chip: '', view: (tile ? 'grid' : 'list') as 'grid' | 'list', page: 1, pageSize } });

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<T | null>(null);
  const [form, setForm] = useState<CrudForm>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ type: 'activate' | 'deactivate' | 'delete'; row: T } | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  const chip = chips?.find((c) => c.id === params.chip);
  const listParams = useMemo(() => {
    const sp = new URLSearchParams({ page: String(params.page), pageSize: String(params.pageSize) });
    if (params.q.trim()) sp.set('q', params.q.trim());
    if (activeFilter && params.active) sp.set('isActive', params.active);
    for (const [k, v] of Object.entries(chip?.params ?? {})) if (v) sp.set(k, v);
    return sp.toString();
  }, [params, activeFilter, chip]);

  const list = useQuery({
    queryKey: [queryKey, listParams],
    queryFn: async () => {
      const json = await apiFetch<{ data: T[]; meta?: { page: number; totalPages: number; totalItems?: number } } | T[]>(`${listPath}${listPath.includes('?') ? '&' : '?'}${listParams}`);
      return Array.isArray(json) ? { data: json, meta: undefined } : json;
    },
    placeholderData: keepPreviousData,
  });

  const refresh = () => qc.invalidateQueries({ queryKey: [queryKey] });
  const defaults = (): CrudForm => Object.fromEntries(fields.map((f) => [f.name, f.type === 'checkbox' ? true : f.type === 'multiselect' ? [] : f.type === 'number' ? 0 : (f.options?.[0]?.value ?? '')]));
  const openCreate = () => (setEditing(null), setForm(defaults()), setFormError(null), setFormOpen(true));
  const openEdit = (row: T) => (setEditing(row), setForm(mapRowToForm ? mapRowToForm(row) : defaults()), setFormError(null), setFormOpen(true));

  const save = useMutation({
    mutationFn: async () => {
      for (const field of fields) {
        if (field.required && field.type !== 'checkbox' && field.type !== 'multiselect' && !String(form[field.name] ?? '').trim()) throw new ApiClientError(tVal('fieldRequired', { field: field.label }), 400);
      }
      const payload = buildPayload
        ? buildPayload(form)
        : Object.fromEntries(
            fields.map((f) => {
              const v = form[f.name];
              if (f.type === 'number') return [f.name, Number(v)];
              if (f.type === 'checkbox') return [f.name, Boolean(v)];
              if (f.type === 'multiselect') return [f.name, Array.isArray(v) ? v : []];
              return [f.name, typeof v === 'string' ? v.trim() || undefined : v];
            }),
          );
      if (editing && patchPath) return apiFetch(patchPath(editing.id), { method: 'PATCH', body: JSON.stringify(payload) });
      if (!createPath) throw new ApiClientError(tVal('createNotSupported'), 400);
      return apiFetch(createPath, { method: 'POST', body: JSON.stringify(payload) });
    },
    onSuccess: async () => {
      setFormError(null);
      await refresh();
      setFormOpen(false);
      setEditing(null);
      toast.success(tCommon('saved'));
    },
    onError: (err) => setFormError(mutationErrorMessage(err)),
  });

  const action = useMutation({
    mutationFn: async () => {
      if (!confirm) return;
      if (confirm.type === 'delete' && deletePath) return apiFetch(deletePath(confirm.row.id), { method: 'DELETE' });
      if (confirm.type === 'activate' && activatePath) return apiFetch(activatePath(confirm.row.id), { method: 'POST' });
      if (confirm.type === 'deactivate' && deactivatePath) return apiFetch(deactivatePath(confirm.row.id), { method: 'POST' });
    },
    onSuccess: async () => {
      setConfirmError(null);
      await refresh();
      toast.success(tCommon('saved'));
      setConfirm(null);
    },
    onError: (err) => setConfirmError(mutationErrorMessage(err)),
  });

  const rows = list.data?.data ?? [];
  const meta = list.data?.meta;
  const pageActive = activeField ? rows.filter((r) => readActive(r[activeField]) === true).length : null;
  const figures = stats ?? [
    { label: title, value: meta?.totalItems ?? rows.length },
    ...(activeField ? [{ label: tCommon('active'), value: pageActive ?? 0, tone: 'success' as const }, { label: tCommon('inactive'), value: rows.length - (pageActive ?? 0), tone: rows.length - (pageActive ?? 0) > 0 ? ('neutral' as const) : ('success' as const) }] : []),
  ];

  const menuFor = (row: T) => {
    const isActive = activeField ? readActive(row[activeField]) : undefined;
    const items: Array<{ id: string; label: string; icon?: ReactNode; onSelect?: () => void; href?: string; tone?: 'default' | 'error'; disabled?: boolean; separator?: boolean }> = [];
    if (patchPath) items.push({ id: 'edit', label: tCommon('edit'), icon: <Pencil className="h-4 w-4" />, onSelect: () => openEdit(row) });
    for (const extra of rowMenu?.(row, refresh) ?? []) items.push(extra);
    if (isActive === true && deactivatePath) items.push({ id: 'off', label: tCommon('deactivate'), icon: <Power className="h-4 w-4" />, onSelect: () => (setConfirmError(null), setConfirm({ type: 'deactivate', row })) });
    if (isActive === false && activatePath) items.push({ id: 'on', label: tCommon('activate'), icon: <Power className="h-4 w-4" />, onSelect: () => (setConfirmError(null), setConfirm({ type: 'activate', row })) });
    if (deletePath) items.push({ id: 'del', label: tCommon('delete'), icon: <Trash2 className="h-4 w-4" />, tone: 'error', separator: items.length > 0, onSelect: () => (setConfirmError(null), setConfirm({ type: 'delete', row })) });
    return items;
  };

  const dataColumns: DataColumn<T>[] = [
    ...columns.map<DataColumn<T>>((c) => ({ key: c.key, header: c.header, cell: c.render, numeric: c.numeric, hideBelow: c.hideBelow, width: c.width })),
    ...(activeField
      ? [
          {
            key: '__active',
            header: tCommon('status'),
            hideBelow: 'md' as const,
            cell: (row: T) => {
              const a = readActive(row[activeField]);
              return a === undefined ? null : (
                <Stamp tone={a ? 'success' : 'neutral'} size="sm">
                  {a ? tCommon('active') : tCommon('inactive')}
                </Stamp>
              );
            },
          },
        ]
      : []),
    {
      key: '__actions',
      header: '',
      numeric: true,
      width: '56px',
      cell: (row: T) => (
        <span className="flex items-center justify-end gap-1">
          {extraActions?.(row, refresh)}
          {menuFor(row).length ? <Menu aria-label={tCommon('actions')} trigger={<Button size="sm" variant="ghost" aria-label={tCommon('actions')}><MoreHorizontal className="h-4 w-4" /></Button>} items={menuFor(row)} /> : null}
        </span>
      ),
    },
  ];

  if (list.isError && !list.data) return <ErrorBoard title={title} description={mutationErrorMessage(list.error)} onRetry={() => list.refetch()} />;

  const empty = (
    <Board.Empty
      title={params.q || activeCount ? tCommon('noResults') : emptyTitle}
      description={params.q || activeCount ? undefined : emptyDescription}
      action={
        params.q || activeCount ? (
          <Button size="sm" variant="secondary" onClick={reset}>
            {tCommon('clearFilters')}
          </Button>
        ) : createPath ? (
          <Button size="sm" leadingIcon={<Plus className="h-4 w-4" />} onClick={openCreate}>
            {primaryLabel ?? tCommon('add')}
          </Button>
        ) : undefined
      }
    />
  );

  return (
    <div className="maher-stagger space-y-5">
      <Board tone={tone} wash="top">
        <div className="grid gap-5 px-5 py-5 sm:px-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:items-center">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-[24px] font-semibold leading-8 tracking-[-0.02em] text-[var(--maher-text-primary)] sm:text-[28px] sm:leading-9 rtl:tracking-normal">{title}</h1>
              {description ? <p className="mt-1 max-w-[56ch] text-[14px] leading-5 text-[var(--maher-text-secondary)]">{description}</p> : null}
            </div>
            {createPath ? (
              <Button leadingIcon={<Plus className="h-4 w-4" />} onClick={openCreate}>
                {primaryLabel ?? tCommon('add')}
              </Button>
            ) : null}
          </div>
          <div className="grid grid-cols-3 gap-4">
            {figures.map((f, i) => (
              <Figure key={i} size="sm" value={f.value} label={f.label} tone={f.tone} locale={kit.locale} />
            ))}
          </div>
        </div>
      </Board>

      <ListToolbar
        copy={kit.toolbar}
        search={{ value: params.q, onChange: (q) => set({ q, page: 1 }, { replace: true }), placeholder: tCommon('search') }}
        actions={
          <>
            {activeFilter ? (
              <SegmentedControl
                size="sm"
                aria-label={tCommon('status')}
                value={params.active || 'all'}
                onChange={(v) => set({ active: v === 'all' ? '' : (v as 'true' | 'false'), page: 1 })}
                options={[
                  { value: 'all', label: tCommon('all') },
                  { value: 'true', label: tCommon('active') },
                  { value: 'false', label: tCommon('inactive') },
                ]}
              />
            ) : null}
            {tile ? (
              <SegmentedControl
                size="sm"
                aria-label={tCommon('view')}
                value={params.view}
                onChange={(view) => set({ view }, { replace: true })}
                options={[
                  { value: 'grid', label: <LayoutGrid className="h-4 w-4" /> },
                  { value: 'list', label: <List className="h-4 w-4" /> },
                ]}
              />
            ) : null}
          </>
        }
      >
        {chips?.length ? <StatusChips aria-label={title} value={params.chip || 'all'} onChange={(id) => set({ chip: id === 'all' ? '' : id, page: 1 })} items={[{ id: 'all', label: tCommon('all') }, ...chips.map((c) => ({ id: c.id, label: c.label, count: c.count }))]} /> : null}
      </ListToolbar>

      {tile && params.view === 'grid' ? (
        list.isLoading && !list.data ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {Array.from({ length: 12 }).map((_, i) => (
              <BoardSkeleton key={i} header={false} rows={1} bodyClassName="pt-20" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <Board tone="neutral">{empty}</Board>
        ) : (
          <>
            <div className={`maher-stagger grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 ${list.isFetching ? 'opacity-80 transition-opacity' : ''}`}>
              {rows.map((row) => (
                <Board key={row.id} as="article" tone={activeField && readActive(row[activeField]) === false ? 'neutral' : tone} className="group/tile relative">
                  {tile(row, () => openEdit(row))}
                  {menuFor(row).length ? (
                    <span className="absolute end-2 top-2 z-[2]">
                      <Menu aria-label={tCommon('actions')} trigger={<Button size="sm" variant="secondary" aria-label={tCommon('actions')} className="h-8 w-8 px-0"><MoreHorizontal className="h-4 w-4" /></Button>} items={menuFor(row)} />
                    </span>
                  ) : null}
                </Board>
              ))}
            </div>
            {meta && meta.totalPages > 1 ? <Pagination page={params.page} pageSize={params.pageSize} total={meta.totalItems ?? meta.totalPages * params.pageSize} onPageChange={(page) => set({ page })} copy={kit.pagination} /> : null}
          </>
        )
      ) : (
        <DataBoard<T>
          aria-label={title}
          columns={dataColumns}
          rows={rows}
          rowKey={(r) => r.id}
          onRowClick={patchPath ? openEdit : undefined}
          loading={list.isLoading && !list.data}
          mobileRow={mobileRow ?? ((row) => ({ title: columns[1]?.render(row) ?? columns[0]?.render(row), meta: columns[0]?.render(row), trailing: activeField ? <Stamp tone={readActive(row[activeField]) ? 'success' : 'neutral'} size="sm">{readActive(row[activeField]) ? tCommon('active') : tCommon('inactive')}</Stamp> : undefined }))}
          empty={empty}
          footer={meta && meta.totalPages > 1 ? <Pagination className="w-full" page={params.page} pageSize={params.pageSize} total={meta.totalItems ?? meta.totalPages * params.pageSize} onPageChange={(page) => set({ page })} copy={kit.pagination} /> : null}
        />
      )}

      <Sheet
        open={formOpen}
        onClose={() => !save.isPending && setFormOpen(false)}
        title={editing ? tCommon('edit') : (primaryLabel ?? tCommon('add'))}
        description={editing ? undefined : description}
        tone={tone}
        footer={
          <>
            <Button variant="ghost" disabled={save.isPending} onClick={() => setFormOpen(false)}>
              {tCommon('cancel')}
            </Button>
            <Button loading={save.isPending} onClick={() => save.mutate()}>
              {tCommon('save')}
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          {formError ? (
            <div className="sm:col-span-2">
              <Alert variant="error">{formError}</Alert>
            </div>
          ) : null}
          {fields.map((field) => {
            const span = field.half ? '' : 'sm:col-span-2';
            const label = `${field.label}${field.required ? ' *' : ''}`;
            if (field.type === 'checkbox') {
              return (
                <div key={field.name} className={span}>
                  <Switch checked={Boolean(form[field.name])} onChange={(v) => setForm((f) => ({ ...f, [field.name]: v }))} label={field.label} description={field.hint} />
                </div>
              );
            }
            if (field.type === 'select') {
              return (
                <div key={field.name} className={span}>
                  <Combobox label={label} hint={field.hint} value={String(form[field.name] ?? '') || null} onChange={(v) => setForm((f) => ({ ...f, [field.name]: v ?? '' }))} options={(field.options ?? []).filter((o) => o.value !== '')} placeholder={field.options?.find((o) => o.value === '')?.label ?? tCommon('select')} emptyText={kit.combobox.empty} clearLabel={kit.combobox.clear} />
                </div>
              );
            }
            if (field.type === 'multiselect') {
              const selected = Array.isArray(form[field.name]) ? (form[field.name] as string[]) : [];
              return (
                <div key={field.name} className={`${span} space-y-2`}>
                  <span className="block text-[13px] font-medium text-[var(--maher-text-primary)]">{label}</span>
                  {field.hint ? <p className="text-[12px] text-[var(--maher-text-secondary)]">{field.hint}</p> : null}
                  {(field.options ?? []).length === 0 ? (
                    <p className="text-[12px] text-[var(--maher-text-tertiary)]">—</p>
                  ) : (
                    <div className="grid gap-2 rounded-[12px] border border-[var(--maher-border)] p-3 sm:grid-cols-2">
                      {(field.options ?? []).map((opt) => (
                        <Checkbox
                          key={opt.value}
                          checked={selected.includes(opt.value)}
                          onChange={(checked) =>
                            setForm((f) => {
                              const current = Array.isArray(f[field.name]) ? (f[field.name] as string[]) : [];
                              return { ...f, [field.name]: checked ? [...current, opt.value] : current.filter((v) => v !== opt.value) };
                            })
                          }
                          label={opt.label}
                          description={opt.description}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            }
            if (field.type === 'textarea') {
              return (
                <div key={field.name} className={span}>
                  <TextArea label={label} value={String(form[field.name] ?? '')} onChange={(e) => setForm((f) => ({ ...f, [field.name]: e.target.value }))} rows={3} dir={field.dir} />
                </div>
              );
            }
            if (field.type === 'number') {
              return (
                <div key={field.name} className={span}>
                  <NumberField label={label} hint={field.hint} value={form[field.name] === '' || form[field.name] == null ? null : Number(form[field.name])} onChange={(v) => setForm((f) => ({ ...f, [field.name]: v == null ? '' : v }))} decimals={3} />
                </div>
              );
            }
            return (
              <div key={field.name} className={span}>
                <Input label={label} value={String(form[field.name] ?? '')} hint={field.hint} dir={field.dir} onChange={(e) => setForm((f) => ({ ...f, [field.name]: e.target.value }))} />
              </div>
            );
          })}
        </div>
      </Sheet>

      <ConfirmDialog
        open={Boolean(confirm)}
        title={confirm?.type === 'delete' ? tCommon('delete') : confirm?.type === 'activate' ? tCommon('activate') : tCommon('deactivate')}
        description={tCommon('confirm')}
        danger={confirm?.type === 'delete' || confirm?.type === 'deactivate'}
        confirmLabel={confirm?.type === 'delete' ? tCommon('delete') : confirm?.type === 'activate' ? tCommon('activate') : tCommon('deactivate')}
        cancelLabel={tCommon('cancel')}
        loading={action.isPending}
        error={confirmError}
        onClose={() => !action.isPending && setConfirm(null)}
        onConfirm={() => action.mutate()}
      />
    </div>
  );
}
