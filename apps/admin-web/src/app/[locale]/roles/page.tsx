'use client';

import { PageHeader } from '@/components/admin/page-header';
import { ConfirmDialog } from '@/components/admin/confirm-dialog';
import { apiFetch, ApiClientError } from '@/lib/api-client';
import { mutationErrorMessage } from '@/hooks/use-api-mutation';
import {
  Alert,
  Button,
  EmptyState,
  ErrorState,
  Input,
  Modal,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from '@maher/ui';
import { localizedName } from '@maher/i18n';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';

interface RoleRow {
  id: string;
  code: string;
  nameEn: string;
  nameAr: string;
  description?: string | null;
  permissions: Array<{ permission: { code: string } }>;
  _count: { users: number };
}

interface Permission {
  id: string;
  code: string;
}

const MODULE_KEYS = [
  'customer',
  'contact',
  'address',
  'quotation',
  'sales',
  'request',
  'production',
  'task',
  'quality',
  'inventory',
  'warehouse',
  'purchase',
  'supplier',
  'delivery',
  'invoice',
  'payment',
  'document',
  'notification',
  'report',
  'audit',
  'user',
  'role',
  'settings',
  'catalog',
  'ai',
  'contract',
] as const;

export default function RolesPage() {
  const locale = useLocale();
  const tc = useTranslations('catalog');
  const tCommon = useTranslations('common');
  const queryClient = useQueryClient();
  const [banner, setBanner] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<RoleRow | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [description, setDescription] = useState('');
  const [permissionCodes, setPermissionCodes] = useState<string[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<RoleRow | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const rolesQuery = useQuery({
    queryKey: ['roles-manage'],
    queryFn: () => apiFetch<RoleRow[]>('/api/v1/roles'),
  });
  const permsQuery = useQuery({
    queryKey: ['permissions'],
    queryFn: () => apiFetch<Permission[]>('/api/v1/roles/permissions'),
  });

  const permissionGroups = useMemo(() => {
    const permissions = permsQuery.data ?? [];
    const map = new Map<string, Permission[]>();
    for (const p of permissions) {
      const prefix = p.code.split('.')[0] || 'other';
      const list = map.get(prefix) ?? [];
      list.push(p);
      map.set(prefix, list);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [permsQuery.data]);

  function moduleLabel(prefix: string) {
    if ((MODULE_KEYS as readonly string[]).includes(prefix)) {
      try {
        return tc(`permModule.${prefix}` as 'permModule.customer');
      } catch {
        return prefix;
      }
    }
    return prefix;
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!nameEn.trim() || !nameAr.trim()) {
        throw new ApiClientError(tc('namesRequired'), 400);
      }
      if (editing) {
        return apiFetch(`/api/v1/roles/${editing.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            nameEn: nameEn.trim(),
            nameAr: nameAr.trim(),
            description: description.trim() || undefined,
            permissionCodes,
          }),
        });
      }
      if (!code.trim()) throw new ApiClientError(tc('codeRequired'), 400);
      return apiFetch('/api/v1/roles', {
        method: 'POST',
        body: JSON.stringify({
          code: code.trim(),
          nameEn: nameEn.trim(),
          nameAr: nameAr.trim(),
          description: description.trim() || undefined,
          permissionCodes,
        }),
      });
    },
    onSuccess: async () => {
      setFormError(null);
      await queryClient.invalidateQueries({ queryKey: ['roles-manage'] });
      setFormOpen(false);
      setBanner(tc('roleSaved'));
    },
    onError: (err) => setFormError(mutationErrorMessage(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiFetch(`/api/v1/roles/${deleteTarget!.id}`, { method: 'DELETE' }),
    onSuccess: async () => {
      setDeleteError(null);
      await queryClient.invalidateQueries({ queryKey: ['roles-manage'] });
      setDeleteTarget(null);
      setBanner(tc('roleDeleted'));
    },
    onError: (err) => setDeleteError(mutationErrorMessage(err)),
  });

  const duplicateMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/v1/roles/${id}/duplicate`, { method: 'POST' }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['roles-manage'] });
      setBanner(tc('roleDuplicated'));
    },
  });

  if (rolesQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (rolesQuery.isError) {
    return (
      <ErrorState
        title={tc('rolesTitle')}
        description={tCommon('loadFailed')}
        onRetry={() => rolesQuery.refetch()}
        retryLabel={tCommon('retry')}
      />
    );
  }

  const rows = rolesQuery.data ?? [];

  function openCreate() {
    setEditing(null);
    setCode('');
    setNameEn('');
    setNameAr('');
    setDescription('');
    setPermissionCodes([]);
    setFormError(null);
    setFormOpen(true);
  }

  function openEdit(role: RoleRow) {
    setEditing(role);
    setCode(role.code);
    setNameEn(role.nameEn);
    setNameAr(role.nameAr);
    setDescription(role.description ?? '');
    setPermissionCodes(role.permissions.map((p) => p.permission.code));
    setFormError(null);
    setFormOpen(true);
  }

  function togglePerm(codeValue: string) {
    setPermissionCodes((prev) =>
      prev.includes(codeValue) ? prev.filter((c) => c !== codeValue) : [...prev, codeValue],
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={tc('rolesTitle')}
        actions={<Button onClick={openCreate}>{tc('addRole')}</Button>}
      />
      {banner ? <Alert variant="success">{banner}</Alert> : null}
      {rows.length === 0 ? (
        <EmptyState title={tc('noRoles')} />
      ) : (
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>{tc('code')}</TableHeaderCell>
              <TableHeaderCell>{tc('name')}</TableHeaderCell>
              <TableHeaderCell>{tc('permissions')}</TableHeaderCell>
              <TableHeaderCell>{tc('users')}</TableHeaderCell>
              <TableHeaderCell>{tCommon('actions')}</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>
                  <span dir="ltr">{row.code}</span>
                </TableCell>
                <TableCell>{localizedName(locale, row)}</TableCell>
                <TableCell>
                  <span dir="ltr">{row.permissions.length}</span>
                </TableCell>
                <TableCell>
                  <span dir="ltr">{row._count.users}</span>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    <Button size="sm" variant="secondary" onClick={() => openEdit(row)}>
                      {tCommon('edit')}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      loading={duplicateMutation.isPending}
                      onClick={() => duplicateMutation.mutate(row.id)}
                    >
                      {tc('duplicate')}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setDeleteError(null);
                        setDeleteTarget(row);
                      }}
                    >
                      {tCommon('delete')}
                    </Button>
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
        title={editing ? tc('editRole') : tc('addRole')}
        className="max-w-2xl"
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
        <div className="grid max-h-[65vh] gap-3 overflow-y-auto">
          {formError ? <Alert variant="error">{formError}</Alert> : null}
          {!editing ? (
            <Input label={`${tc('code')} *`} value={code} onChange={(e) => setCode(e.target.value)} />
          ) : (
            <p className="text-sm text-[var(--maher-text-secondary)]">
              {tc('code')}: <span dir="ltr">{code}</span>
            </p>
          )}
          <Input label={`${tc('nameEn')} *`} value={nameEn} onChange={(e) => setNameEn(e.target.value)} />
          <Input label={`${tc('nameAr')} *`} value={nameAr} onChange={(e) => setNameAr(e.target.value)} />
          <Input
            label={tc('description')}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <fieldset>
            <legend className="mb-2 text-sm font-medium">{tc('permissions')}</legend>
            <div className="max-h-56 space-y-3 overflow-y-auto rounded border border-[var(--maher-border)] p-2">
              {permissionGroups.map(([prefix, perms]) => (
                <div key={prefix}>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--maher-text-secondary)]">
                    {moduleLabel(prefix)}
                  </p>
                  <div className="grid gap-1 sm:grid-cols-2">
                    {perms.map((p) => (
                      <label key={p.id} className="flex items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          checked={permissionCodes.includes(p.code)}
                          onChange={() => togglePerm(p.code)}
                        />
                        <span dir="ltr">{p.code}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </fieldset>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        title={tCommon('delete')}
        description={tc('confirmDeleteRole')}
        danger
        loading={deleteMutation.isPending}
        error={deleteError}
        onClose={() => !deleteMutation.isPending && setDeleteTarget(null)}
        onConfirm={() => deleteMutation.mutate()}
      />
    </div>
  );
}
