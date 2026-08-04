'use client';

import { ConfirmDialog } from '@/components/admin/confirm-dialog';
import { PageHeader } from '@/components/admin/page-header';
import { apiFetch, ApiClientError } from '@/lib/api-client';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
  TableSkeleton,
} from '@maher/ui';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useState, type ReactNode } from 'react';

export interface CrudColumn<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
}

export interface CrudField {
  name: string;
  label: string;
  type?: 'text' | 'number' | 'checkbox' | 'select' | 'textarea';
  required?: boolean;
  options?: Array<{ value: string; label: string }>;
  hint?: string;
}

interface MasterCrudPageProps<T extends { id: string }> {
  title: string;
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
  mapRowToForm?: (row: T) => Record<string, string | boolean | number>;
  buildPayload?: (form: Record<string, string | boolean | number>) => Record<string, unknown>;
  activeField?: keyof T;
  extraActions?: (row: T, refresh: () => void) => ReactNode;
}

export function MasterCrudPage<T extends { id: string }>({
  title,
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
  mapRowToForm,
  buildPayload,
  activeField,
  extraActions,
}: MasterCrudPageProps<T>) {
  const tCommon = useTranslations('common');
  const tVal = useTranslations('validation');
  const queryClient = useQueryClient();
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<T | null>(null);
  const [form, setForm] = useState<Record<string, string | boolean | number>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ type: 'activate' | 'deactivate' | 'delete'; row: T } | null>(
    null,
  );
  const [confirmError, setConfirmError] = useState<string | null>(null);

  useEffect(() => {
    if (!banner) return;
    const timer = setTimeout(() => setBanner(null), 4000);
    return () => clearTimeout(timer);
  }, [banner]);

  const listParams = useMemo(() => {
    const params = new URLSearchParams({ page: String(page), pageSize: '20' });
    if (q.trim()) params.set('q', q.trim());
    return params.toString();
  }, [q, page]);

  const listQuery = useQuery({
    queryKey: [queryKey, listParams],
    queryFn: async () => {
      const json = await apiFetch<{ data: T[]; meta?: { page: number; totalPages: number } } | T[]>(
        `${listPath}${listPath.includes('?') ? '&' : '?'}${listParams}`,
      );
      if (Array.isArray(json)) return { data: json, meta: undefined };
      return json;
    },
    placeholderData: keepPreviousData,
  });

  const defaults = () =>
    Object.fromEntries(
      fields.map((f) => [
        f.name,
        f.type === 'checkbox' ? true : f.type === 'number' ? 0 : f.options?.[0]?.value ?? '',
      ]),
    );

  const saveMutation = useMutation({
    mutationFn: async () => {
      for (const field of fields) {
        if (field.required && !String(form[field.name] ?? '').trim() && field.type !== 'checkbox') {
          throw new ApiClientError(tVal('fieldRequired', { field: field.label }), 400);
        }
      }
      const payload = buildPayload
        ? buildPayload(form)
        : Object.fromEntries(
            fields.map((f) => {
              const v = form[f.name];
              if (f.type === 'number') return [f.name, Number(v)];
              if (f.type === 'checkbox') return [f.name, Boolean(v)];
              return [f.name, typeof v === 'string' ? v.trim() || undefined : v];
            }),
          );
      if (editing && patchPath) {
        return apiFetch(patchPath(editing.id), { method: 'PATCH', body: JSON.stringify(payload) });
      }
      if (!createPath) throw new ApiClientError(tVal('createNotSupported'), 400);
      return apiFetch(createPath, { method: 'POST', body: JSON.stringify(payload) });
    },
    onSuccess: async () => {
      setFormError(null);
      await queryClient.invalidateQueries({ queryKey: [queryKey] });
      setFormOpen(false);
      setEditing(null);
      setBanner(tCommon('saved'));
    },
    onError: (err) => setFormError(mutationErrorMessage(err)),
  });

  const actionMutation = useMutation({
    mutationFn: async () => {
      if (!confirm) return;
      if (confirm.type === 'delete' && deletePath) {
        return apiFetch(deletePath(confirm.row.id), { method: 'DELETE' });
      }
      if (confirm.type === 'activate' && activatePath) {
        return apiFetch(activatePath(confirm.row.id), { method: 'POST' });
      }
      if (confirm.type === 'deactivate' && deactivatePath) {
        return apiFetch(deactivatePath(confirm.row.id), { method: 'POST' });
      }
    },
    onSuccess: async () => {
      setConfirmError(null);
      await queryClient.invalidateQueries({ queryKey: [queryKey] });
      setBanner(tCommon('saved'));
      setConfirm(null);
    },
    onError: (err) => setConfirmError(mutationErrorMessage(err)),
  });

  if (listQuery.isLoading && !listQuery.data) {
    return (
      <div className="space-y-6">
        <div className="space-y-2 border-b border-border pb-5">
          <Skeleton className="h-8 w-52" />
        </div>
        <Skeleton className="h-10 w-full max-w-md" />
        <TableSkeleton columns={columns.length + 1} />
      </div>
    );
  }

  if (listQuery.isError && !listQuery.data) {
    return (
      <ErrorState
        title={title}
        onRetry={() => listQuery.refetch()}
        retryLabel={tCommon('retry')}
      />
    );
  }

  const rows = listQuery.data?.data ?? [];
  const meta = listQuery.data?.meta;

  return (
    <div className="space-y-6">
      <PageHeader
        title={title}
        actions={
          createPath ? (
            <Button
              leadingIcon={<Plus className="h-4 w-4" />}
              onClick={() => {
                setEditing(null);
                setForm(defaults());
                setFormError(null);
                setFormOpen(true);
              }}
            >
              {tCommon('add')}
            </Button>
          ) : null
        }
      />
      {banner ? (
        <Alert variant="success" className="maher-animate-fade">
          {banner}
        </Alert>
      ) : null}
      <div className="maher-stagger space-y-6">
      <Input
        value={q}
        onChange={(e) => {
          setPage(1);
          setQ(e.target.value);
        }}
        placeholder={tCommon('search')}
        withSearchIcon
        className="max-w-md"
      />
      {rows.length === 0 ? (
        <EmptyState
          title={emptyTitle}
          description={q ? tCommon('noResults') : undefined}
          action={
            createPath && !q ? (
              <Button
                leadingIcon={<Plus className="h-4 w-4" />}
                onClick={() => {
                  setEditing(null);
                  setForm(defaults());
                  setFormError(null);
                  setFormOpen(true);
                }}
              >
                {tCommon('add')}
              </Button>
            ) : null
          }
        />
      ) : (
        <Table>
          <TableHead>
            <TableRow>
              {columns.map((c) => (
                <TableHeaderCell key={c.key}>{c.header}</TableHeaderCell>
              ))}
              <TableHeaderCell>{tCommon('actions')}</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => {
              const rawActive = activeField ? row[activeField] : undefined;
              const isActive =
                rawActive === undefined
                  ? undefined
                  : typeof rawActive === 'string'
                    ? rawActive === 'ACTIVE' || rawActive.toLowerCase() === 'true'
                    : Boolean(rawActive);
              return (
                <TableRow key={row.id}>
                  {columns.map((c) => (
                    <TableCell key={c.key}>{c.render(row)}</TableCell>
                  ))}
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {patchPath ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          leadingIcon={<Pencil className="h-3.5 w-3.5" />}
                          onClick={() => {
                            setEditing(row);
                            setForm(mapRowToForm ? mapRowToForm(row) : defaults());
                            setFormError(null);
                            setFormOpen(true);
                          }}
                        >
                          {tCommon('edit')}
                        </Button>
                      ) : null}
                      {isActive === true && deactivatePath ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setConfirmError(null);
                            setConfirm({ type: 'deactivate', row });
                          }}
                        >
                          {tCommon('deactivate')}
                        </Button>
                      ) : null}
                      {isActive === false && activatePath ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setConfirmError(null);
                            setConfirm({ type: 'activate', row });
                          }}
                        >
                          {tCommon('activate')}
                        </Button>
                      ) : null}
                      {deletePath ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          leadingIcon={<Trash2 className="h-3.5 w-3.5" />}
                          className="text-[var(--maher-error)] hover:bg-[var(--maher-error-soft)] hover:text-[var(--maher-error)]"
                          onClick={() => {
                            setConfirmError(null);
                            setConfirm({ type: 'delete', row });
                          }}
                        >
                          {tCommon('delete')}
                        </Button>
                      ) : null}
                      {extraActions?.(row, () =>
                        queryClient.invalidateQueries({ queryKey: [queryKey] }),
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
      {meta && meta.totalPages > 1 ? (
        <div className="flex items-center justify-end gap-3">
          <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            {tCommon('previous')}
          </Button>
          <span className="text-sm tabular-nums text-text-secondary">
            {meta.page} / {meta.totalPages}
          </span>
          <Button
            size="sm"
            variant="secondary"
            disabled={page >= meta.totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            {tCommon('next')}
          </Button>
        </div>
      ) : null}
      </div>

      <Modal
        open={formOpen}
        onClose={() => !saveMutation.isPending && setFormOpen(false)}
        title={editing ? tCommon('edit') : tCommon('add')}
        className="max-w-xl"
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
        <div className="maher-form-section grid gap-4">
          {formError ? <Alert variant="error">{formError}</Alert> : null}
          {fields.map((field) => {
            if (field.type === 'checkbox') {
              return (
                <label
                  key={field.name}
                  className="flex cursor-pointer items-center gap-2.5 rounded-[var(--maher-radius-md)] border border-border bg-surface-muted px-3 py-2.5 text-sm font-medium text-text-primary"
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-[var(--maher-brand)]"
                    checked={Boolean(form[field.name])}
                    onChange={(e) => setForm((f) => ({ ...f, [field.name]: e.target.checked }))}
                  />
                  {field.label}
                </label>
              );
            }
            if (field.type === 'select') {
              return (
                <Select
                  key={field.name}
                  label={`${field.label}${field.required ? ' *' : ''}`}
                  hint={field.hint}
                  options={field.options ?? []}
                  value={String(form[field.name] ?? '')}
                  onChange={(e) => setForm((f) => ({ ...f, [field.name]: e.target.value }))}
                />
              );
            }
            return (
              <Input
                key={field.name}
                label={`${field.label}${field.required ? ' *' : ''}`}
                type={field.type === 'number' ? 'number' : 'text'}
                value={String(form[field.name] ?? '')}
                hint={field.hint}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    [field.name]: field.type === 'number' ? e.target.value : e.target.value,
                  }))
                }
              />
            );
          })}
        </div>
      </Modal>

      <ConfirmDialog
        open={!!confirm}
        title={
          confirm?.type === 'delete'
            ? tCommon('delete')
            : confirm?.type === 'activate'
              ? tCommon('activate')
              : tCommon('deactivate')
        }
        description={tCommon('confirm')}
        danger={confirm?.type === 'delete' || confirm?.type === 'deactivate'}
        loading={actionMutation.isPending}
        error={confirmError}
        onClose={() => !actionMutation.isPending && setConfirm(null)}
        onConfirm={() => actionMutation.mutate()}
      />
    </div>
  );
}
