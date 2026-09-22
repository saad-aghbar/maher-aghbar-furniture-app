'use client';

import { apiFetch, apiUpload, apiUploadFromUrl, API_URL } from '@/lib/api-client';
import { useKitCopy } from '@/lib/kit-copy';
import { Alert, Attachments, Board, BoardSkeleton, ErrorBoard, Figure, Ribbon, StatusChips, type AttachmentItem } from '@maher/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';

interface Doc {
  id: string;
  fileName: string;
  mimeType: string;
  category?: string | null;
  createdAt: string;
  size?: number | null;
}

export default function DocumentsPage() {
  const t = useTranslations('navigation');
  const tCommon = useTranslations('common');
  const tAcc = useTranslations('accounting');
  const locale = useLocale();
  const kit = useKitCopy();
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [kind, setKind] = useState<'all' | 'images' | 'pdf' | 'other'>('all');
  const [pendingCount, setPendingCount] = useState(0);

  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ['customer-documents'], queryFn: () => apiFetch<Doc[]>('/api/v1/uploads') });
  const upload = useMutation({
    mutationFn: async (args: { file?: File; url?: string }) => {
      if (args.url) return apiUploadFromUrl('/api/v1/uploads/from-url?category=CUSTOMER_ATTACHMENT', { url: args.url });
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
  const thumbs = useQuery({
    queryKey: ['customer-documents', 'thumbs', (data ?? []).filter((d) => d.mimeType.startsWith('image/')).map((d) => d.id).join(',')],
    enabled: Boolean(data?.some((d) => d.mimeType.startsWith('image/'))),
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const entries = await Promise.all(
        (data ?? [])
          .filter((d) => d.mimeType.startsWith('image/'))
          .slice(0, 48)
          .map(async (d) => {
            try {
              const res = await apiFetch<{ downloadPath: string }>(`/api/v1/uploads/documents/${d.id}/link`);
              return [d.id, `${API_URL}${res.downloadPath}`] as const;
            } catch {
              return [d.id, null] as const;
            }
          }),
      );
      return Object.fromEntries(entries) as Record<string, string | null>;
    },
  });

  const rows = useMemo(() => data ?? [], [data]);
  const kindOf = (d: Doc) => (d.mimeType.startsWith('image/') ? 'images' : d.mimeType === 'application/pdf' ? 'pdf' : 'other');
  const counts = { images: rows.filter((d) => kindOf(d) === 'images').length, pdf: rows.filter((d) => kindOf(d) === 'pdf').length, other: rows.filter((d) => kindOf(d) === 'other').length };
  const visible = kind === 'all' ? rows : rows.filter((d) => kindOf(d) === kind);
  const dateFmt = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' });
  const items: AttachmentItem[] = [
    ...Array.from({ length: pendingCount }, (_, i) => ({ id: `pending-${i}`, name: tCommon('uploading'), progress: 50 })),
    ...visible.map((d) => ({ id: d.id, name: d.fileName, mime: d.mimeType, size: d.size ?? undefined, thumbUrl: thumbs.data?.[d.id] ?? undefined, url: undefined })),
  ];

  if (isLoading && !data) {
    return (
      <div className="space-y-5">
        <BoardSkeleton rows={2} />
        <BoardSkeleton rows={6} />
      </div>
    );
  }
  if (isError) return <ErrorBoard title={t('documents')} description={tCommon('loadFailed')} onRetry={() => refetch()} retryLabel={tCommon('retry')} />;

  return (
    <div className="maher-stagger space-y-5">
      <Board tone="neutral" wash="top" as="section">
        <div className="grid gap-5 px-5 py-5 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-center">
          <div className="min-w-0">
            <h1 className="text-[24px] font-semibold leading-8 tracking-[-0.02em] text-[var(--maher-text-primary)] sm:text-[28px] sm:leading-9 rtl:tracking-normal">{t('documents')}</h1>
            <p className="mt-1 max-w-[56ch] text-[14px] leading-5 text-[var(--maher-text-secondary)]">{tAcc('documentsHint')}</p>
          </div>
          <div className="min-w-0">
            <Ribbon size="sm" segments={[{ key: 'images', label: 'Images', value: counts.images, tone: 'brand' }, { key: 'pdf', label: 'PDF', value: counts.pdf, tone: 'info' }, { key: 'other', label: tCommon('file'), value: counts.other, tone: 'neutral' }]} />
            <div className="mt-3 grid grid-cols-3 gap-4">
              <Figure size="sm" value={rows.length} label={t('documents')} />
              <Figure size="sm" value={counts.images} label="Images" tone="brand" />
              <Figure size="sm" value={counts.pdf} label="PDF" tone="info" />
            </div>
          </div>
        </div>
      </Board>

      {error ? <Alert variant="error">{error}</Alert> : null}

      <StatusChips
        aria-label={t('documents')}
        value={kind}
        onChange={(id) => setKind(id as typeof kind)}
        items={[
          { id: 'all', label: tCommon('all'), count: rows.length },
          { id: 'images', label: 'Images', count: counts.images, tone: 'brand' },
          { id: 'pdf', label: 'PDF', count: counts.pdf, tone: 'info' },
          { id: 'other', label: tCommon('file'), count: counts.other },
        ]}
      />

      <Board tone="neutral">
        <Board.Header title={tCommon('file')} description={tCommon('documentsSubtitle')} />
        <Board.Body>
          <Attachments
            items={items}
            accept="image/*,application/pdf,.docx,.xlsx"
            copy={kit.attachments}
            disabled={upload.isPending}
            onOpen={(item) => {
              if (!item.id.startsWith('pending-')) openLink.mutate(item.id);
            }}
            onAdd={async (files) => {
              setPendingCount(files.length);
              try {
                for (const file of files) await upload.mutateAsync({ file });
              } finally {
                setPendingCount(0);
              }
            }}
          />
          {visible.length ? (
            <ul className="mt-4 divide-y divide-[var(--maher-border)] text-[13px]">
              {visible.slice(0, 12).map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-3 py-2">
                  <button type="button" className="truncate text-start font-medium text-[var(--maher-text-primary)] hover:text-[var(--maher-brand)]" onClick={() => openLink.mutate(d.id)}>
                    {d.fileName}
                  </button>
                  <span className="shrink-0 text-[12px] text-[var(--maher-text-tertiary)]" dir="ltr">
                    {dateFmt.format(new Date(d.createdAt))}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-[13px] text-[var(--maher-text-tertiary)]">{tCommon('noDocumentsHint')}</p>
          )}
        </Board.Body>
      </Board>
    </div>
  );
}
