'use client';

import { apiFetch, apiUpload, API_URL } from '@/lib/api-client';
import {
  Alert,
  Button,
  EmptyState,
  ErrorState,
  PageHeader,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
  TableSkeleton,
} from '@maher/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useRef, useState } from 'react';

interface Doc {
  id: string;
  fileName: string;
  mimeType: string;
  category?: string | null;
  createdAt: string;
}

export default function DocumentsPage() {
  const t = useTranslations('navigation');
  const tCommon = useTranslations('common');
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['customer-documents'],
    queryFn: () => apiFetch<Doc[]>('/api/v1/uploads'),
  });

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append('file', file);
      return apiUpload('/api/v1/uploads?category=CUSTOMER_ATTACHMENT', form);
    },
    onSuccess: async () => {
      setError(null);
      await qc.invalidateQueries({ queryKey: ['customer-documents'] });
    },
    onError: () => setError(tCommon('uploadFailed')),
  });

  const openLink = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiFetch<{ downloadPath: string }>(`/api/v1/uploads/documents/${id}/link`);
      window.open(`${API_URL}${res.downloadPath}`, '_blank');
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <TableSkeleton columns={4} />
      </div>
    );
  }
  if (isError) return <ErrorState title={t('documents')} onRetry={() => refetch()} />;

  const rows = data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('documents')}
        description={tCommon('documentsSubtitle')}
        actions={
          <div>
            <input
              ref={inputRef}
              type="file"
              className="hidden"
              accept="image/*,application/pdf,.docx,.xlsx"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) upload.mutate(f);
                e.target.value = '';
              }}
            />
            <Button loading={upload.isPending} onClick={() => inputRef.current?.click()}>
              {tCommon('upload')}
            </Button>
          </div>
        }
      />
      {error ? <Alert variant="error">{error}</Alert> : null}
      {rows.length === 0 ? (
        <EmptyState
          title={tCommon('noDocuments')}
          description={tCommon('noDocumentsHint')}
        />
      ) : (
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>{tCommon('file')}</TableHeaderCell>
              <TableHeaderCell>{tCommon('category')}</TableHeaderCell>
              <TableHeaderCell>{tCommon('date')}</TableHeaderCell>
              <TableHeaderCell>{tCommon('actions')}</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium">{row.fileName}</TableCell>
                <TableCell>{row.category ?? '—'}</TableCell>
                <TableCell>{new Date(row.createdAt).toLocaleDateString()}</TableCell>
                <TableCell>
                  <Button
                    size="sm"
                    variant="secondary"
                    loading={openLink.isPending}
                    onClick={() => openLink.mutate(row.id)}
                  >
                    {tCommon('download')}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
