'use client';

import { PageHeader } from '@/components/admin/page-header';
import { Link } from '@/i18n/navigation';
import { apiFetch, API_URL } from '@/lib/api-client';
import { mutationErrorMessage } from '@/hooks/use-api-mutation';
import {
  Alert,
  Button,
  EmptyState,
  ErrorState,
  Select,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from '@maher/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useMemo, useRef, useState } from 'react';

interface DocRow {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  category: string;
  createdAt: string;
  customerId?: string | null;
  requestId?: string | null;
  quotationId?: string | null;
  salesOrderId?: string | null;
  productionOrderId?: string | null;
  uploadedBy?: { firstName?: string; lastName?: string; email?: string } | null;
}

const KNOWN_CATEGORIES = ['GENERAL', 'CUSTOMER_ATTACHMENT'] as const;

function entityLink(row: DocRow): { href: string; label: string } | null {
  if (row.customerId) return { href: `/customers/${row.customerId}`, label: 'customer' };
  if (row.salesOrderId) return { href: `/sales-orders/${row.salesOrderId}`, label: 'salesOrder' };
  if (row.quotationId) return { href: `/quotations/${row.quotationId}`, label: 'quotations' };
  if (row.requestId) return { href: `/requests/${row.requestId}`, label: 'rfq' };
  if (row.productionOrderId) {
    return { href: `/production/${row.productionOrderId}`, label: 'productionOrder' };
  }
  return null;
}

export default function DocumentsPage() {
  const t = useTranslations('navigation');
  const tc = useTranslations('catalog');
  const tCommon = useTranslations('common');
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [uploadCategory, setUploadCategory] = useState<string>('GENERAL');

  const listQuery = useQuery({
    queryKey: ['documents'],
    queryFn: () => apiFetch<DocRow[]>('/api/v1/uploads'),
  });

  const categoryOptions = useMemo(() => {
    const fromData = new Set<string>(KNOWN_CATEGORIES);
    for (const row of listQuery.data ?? []) {
      if (row.category) fromData.add(row.category.split(':')[0] || row.category);
    }
    return Array.from(fromData).sort();
  }, [listQuery.data]);

  const rows = useMemo(() => {
    const all = listQuery.data ?? [];
    if (!categoryFilter) return all;
    return all.filter(
      (r) => r.category === categoryFilter || r.category?.startsWith(`${categoryFilter}:`),
    );
  }, [listQuery.data, categoryFilter]);

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(`${API_URL}/api/v1/uploads?category=${uploadCategory}`, {
        method: 'POST',
        credentials: 'include',
        body: form,
      });
      if (!res.ok) throw new Error(tCommon('uploadFailed'));
      return res.json();
    },
    onSuccess: async () => {
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ['documents'] });
      setBanner(tc('documentUploaded'));
      if (fileRef.current) fileRef.current.value = '';
    },
    onError: (err) => setError(mutationErrorMessage(err)),
  });

  const openLink = useMutation({
    mutationFn: async (id: string) => {
      const link = await apiFetch<{ downloadPath: string }>(`/api/v1/uploads/documents/${id}/link`);
      window.open(`${API_URL}${link.downloadPath}`, '_blank');
    },
    onError: (err) => setError(mutationErrorMessage(err)),
  });

  function categoryLabel(cat: string) {
    const base = cat.split(':')[0] || cat;
    try {
      return tc(`docCategory.${base}` as 'docCategory.GENERAL');
    } catch {
      return cat;
    }
  }

  function entityLabel(key: string) {
    try {
      return tc(`linkedEntity.${key}` as 'linkedEntity.customer');
    } catch {
      return key;
    }
  }

  function uploaderName(row: DocRow) {
    const u = row.uploadedBy;
    if (!u) return '—';
    const name = [u.firstName, u.lastName].filter(Boolean).join(' ').trim();
    return name || u.email || '—';
  }

  if (listQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (listQuery.isError) {
    return (
      <ErrorState
        title={t('documents')}
        description={tCommon('loadFailed')}
        onRetry={() => listQuery.refetch()}
        retryLabel={tCommon('retry')}
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('documents')}
        actions={
          <>
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) upload.mutate(file);
              }}
            />
            <Button loading={upload.isPending} onClick={() => fileRef.current?.click()}>
              {tCommon('upload')}
            </Button>
          </>
        }
      />
      {banner ? <Alert variant="success">{banner}</Alert> : null}
      {error ? <Alert variant="error">{error}</Alert> : null}

      <div className="flex flex-wrap items-end gap-3">
        <Select
          className="max-w-xs"
          label={tCommon('category')}
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
        >
          <option value="">{tCommon('all')}</option>
          {categoryOptions.map((c) => (
            <option key={c} value={c}>
              {categoryLabel(c)}
            </option>
          ))}
        </Select>
        <Select
          className="max-w-xs"
          label={tc('uploadCategory')}
          value={uploadCategory}
          onChange={(e) => setUploadCategory(e.target.value)}
        >
          {categoryOptions.map((c) => (
            <option key={c} value={c}>
              {categoryLabel(c)}
            </option>
          ))}
        </Select>
      </div>

      {rows.length === 0 ? (
        <EmptyState title={tCommon('noDocuments')} />
      ) : (
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>{tCommon('file')}</TableHeaderCell>
              <TableHeaderCell>{tCommon('category')}</TableHeaderCell>
              <TableHeaderCell>{tc('linkedTo')}</TableHeaderCell>
              <TableHeaderCell>{tc('uploader')}</TableHeaderCell>
              <TableHeaderCell>{tc('size')}</TableHeaderCell>
              <TableHeaderCell>{tCommon('date')}</TableHeaderCell>
              <TableHeaderCell>{tCommon('actions')}</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => {
              const linked = entityLink(row);
              return (
                <TableRow key={row.id}>
                  <TableCell>{row.fileName}</TableCell>
                  <TableCell>{categoryLabel(row.category)}</TableCell>
                  <TableCell>
                    {linked ? (
                      <Link href={linked.href} className="text-brand hover:underline">
                        {entityLabel(linked.label)}
                      </Link>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell>{uploaderName(row)}</TableCell>
                  <TableCell>
                    <span dir="ltr">{Math.round(row.sizeBytes / 1024)} KB</span>
                  </TableCell>
                  <TableCell>
                    <span dir="ltr">{new Date(row.createdAt).toLocaleString()}</span>
                  </TableCell>
                  <TableCell>
                    <Button size="sm" variant="secondary" onClick={() => openLink.mutate(row.id)}>
                      {tCommon('download')}
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
