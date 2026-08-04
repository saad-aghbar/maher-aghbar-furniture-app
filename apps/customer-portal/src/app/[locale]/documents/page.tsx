'use client';

import { apiFetch, apiUpload, apiUploadFromUrl, API_URL } from '@/lib/api-client';
import {
  Alert,
  Button,
  EmptyState,
  ErrorState,
  MotionSection,
  PageHero,
  PhotoAttachField,
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
import { useState } from 'react';

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
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['customer-documents'],
    queryFn: () => apiFetch<Doc[]>('/api/v1/uploads'),
  });

  const upload = useMutation({
    mutationFn: async (args: { file?: File; url?: string }) => {
      if (args.url) {
        return apiUploadFromUrl('/api/v1/uploads/from-url?category=CUSTOMER_ATTACHMENT', {
          url: args.url,
        });
      }
      if (!args.file) throw new Error(tCommon('required'));
      const form = new FormData();
      form.append('file', args.file);
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
        <Skeleton className="h-28 w-full rounded-[var(--maher-radius-xl)]" />
        <TableSkeleton columns={4} />
      </div>
    );
  }
  if (isError) return <ErrorState title={t('documents')} onRetry={() => refetch()} />;

  const rows = data ?? [];

  return (
    <div className="space-y-6">
      <PageHero
        tone="soft"
        title={t('documents')}
        description={tCommon('documentsSubtitle')}
        actions={
          <PhotoAttachField
            accept="image/*,application/pdf,.docx,.xlsx"
            uploadLabel={tCommon('upload')}
            uploadingLabel={tCommon('uploading')}
            attachUrlLabel={tCommon('attachFromUrl')}
            disabled={upload.isPending}
            onUploadFile={async (file) => {
              await upload.mutateAsync({ file });
            }}
            onAttachUrl={async (url) => {
              await upload.mutateAsync({ url });
            }}
          />
        }
      />
      {error ? <Alert variant="error">{error}</Alert> : null}
      {rows.length === 0 ? (
        <MotionSection>
          <EmptyState
            title={tCommon('noDocuments')}
            description={tCommon('noDocumentsHint')}
          />
        </MotionSection>
      ) : (
        <MotionSection delayMs={60}>
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
        </MotionSection>
      )}
    </div>
  );
}
