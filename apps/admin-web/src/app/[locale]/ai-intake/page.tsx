'use client';

import { PageHeader } from '@/components/admin/page-header';
import { Link } from '@/i18n/navigation';
import { apiFetch, ApiClientError, API_URL } from '@/lib/api-client';
import { mutationErrorMessage } from '@/hooks/use-api-mutation';
import {
  Alert,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  Select,
  StatusBadge,
  TextArea,
} from '@maher/ui';
import { localizedName } from '@maher/i18n';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useMemo, useRef, useState } from 'react';

interface Customer {
  id: string;
  name: string;
  code: string;
  nameAr?: string | null;
  nameEn?: string | null;
  nameHe?: string | null;
}

interface AiField {
  fieldName: string;
  fieldValue?: string | null;
  confidence?: number | string | null;
  isMissing?: boolean;
}

interface AiJob {
  id: string;
  number: string;
  status: string;
  provider?: string | null;
  originalText?: string | null;
  translatedText?: string | null;
  fields?: AiField[];
  request?: { id: string; number: string } | null;
}

const SHOW_DEMO_PREFILL =
  process.env.NODE_ENV === 'development' ||
  process.env.NEXT_PUBLIC_AI_DEMO_PREFILL === 'true';

const DEMO_TEXT =
  'Sofa 3 seats grey velvet W220 H90 D95 qty 4 delivery 2026-09-15 hotel lobby';

function confidenceLabel(value: number | string | null | undefined) {
  if (value == null || value === '') return null;
  const pct = Math.round(Number(value) * 100);
  if (!Number.isFinite(pct)) return null;
  return `${pct}%`;
}

export default function AiIntakePage() {
  const locale = useLocale();
  const t = useTranslations('navigation');
  const tc = useTranslations('catalog');
  const tCommon = useTranslations('common');
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [rawText, setRawText] = useState(SHOW_DEMO_PREFILL ? DEMO_TEXT : '');
  const [customerId, setCustomerId] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [rejectReason, setRejectReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const customersQuery = useQuery({
    queryKey: ['customers-pick-ai'],
    queryFn: () =>
      apiFetch<{ data: Customer[] }>('/api/v1/customers?pageSize=100').then((r) => r.data),
  });

  const jobsQuery = useQuery({
    queryKey: ['ai-jobs', page],
    queryFn: () =>
      apiFetch<{ data: AiJob[]; meta: { page: number; totalPages: number } }>(
        `/api/v1/ai-intake/jobs?page=${page}&pageSize=20`,
      ),
  });

  const selected = useMemo(
    () => (jobsQuery.data?.data ?? []).find((j) => j.id === selectedId) ?? null,
    [jobsQuery.data?.data, selectedId],
  );

  const createJob = useMutation({
    mutationFn: async (payload: {
      sourceType: string;
      rawText?: string;
      storageKey?: string;
    }) =>
      apiFetch<AiJob>('/api/v1/ai-intake/jobs', {
        method: 'POST',
        body: JSON.stringify({
          ...payload,
          customerId: customerId || undefined,
        }),
      }),
    onSuccess: async (job) => {
      setError(null);
      setSelectedId(job.id);
      const map: Record<string, string> = {};
      for (const f of job.fields ?? []) map[f.fieldName] = f.fieldValue ?? '';
      setOverrides(map);
      await queryClient.invalidateQueries({ queryKey: ['ai-jobs'] });
      setBanner(
        tc('aiJobReady', {
          number: job.number,
          provider: job.provider ?? 'mock',
        }),
      );
    },
    onError: (err) => setError(mutationErrorMessage(err)),
  });

  const uploadAndExtract = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(`${API_URL}/api/v1/uploads?category=AI_INTAKE`, {
        method: 'POST',
        credentials: 'include',
        body: form,
      });
      if (!res.ok) throw new ApiClientError(tCommon('uploadFailed'), res.status);
      const json = (await res.json()) as { document: { storageKey: string } };
      const sourceType = file.type.startsWith('image/') ? 'IMAGE' : 'PDF';
      return createJob.mutateAsync({
        sourceType,
        storageKey: json.document.storageKey,
      });
    },
    onError: (err) => setError(mutationErrorMessage(err)),
  });

  const approve = useMutation({
    mutationFn: () => {
      if (!selectedId || !customerId) throw new Error(tc('aiSelectJobCustomer'));
      return apiFetch(`/api/v1/ai-intake/jobs/${selectedId}/approve`, {
        method: 'POST',
        body: JSON.stringify({ customerId, fieldOverrides: overrides }),
      });
    },
    onSuccess: async () => {
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ['ai-jobs'] });
      setBanner(tc('aiApproved'));
    },
    onError: (err) => setError(mutationErrorMessage(err)),
  });

  const reject = useMutation({
    mutationFn: () => {
      if (!selectedId) throw new Error(tc('aiSelectJob'));
      return apiFetch(`/api/v1/ai-intake/jobs/${selectedId}/reject`, {
        method: 'POST',
        body: JSON.stringify({
          reason: rejectReason.trim() || tc('aiRejectReason'),
        }),
      });
    },
    onSuccess: async () => {
      setRejectReason('');
      await queryClient.invalidateQueries({ queryKey: ['ai-jobs'] });
      setBanner(tc('aiRejected'));
    },
    onError: (err) => setError(mutationErrorMessage(err)),
  });

  if (jobsQuery.isError) {
    return (
      <ErrorState
        title={t('aiIntake')}
        description={tCommon('loadFailed')}
        onRetry={() => jobsQuery.refetch()}
        retryLabel={tCommon('retry')}
      />
    );
  }

  const jobs = jobsQuery.data?.data ?? [];
  const meta = jobsQuery.data?.meta;

  return (
    <div className="space-y-6">
      <PageHeader title={t('aiIntake')} description={tc('aiIntakeDescription')} />
      {banner ? <Alert variant="success">{banner}</Alert> : null}
      {error ? <Alert variant="error">{error}</Alert> : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title={tc('aiNewExtraction')}>
          <div className="space-y-3">
            <Select
              label={tc('customer')}
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
            >
              <option value="">{tc('select')}</option>
              {(customersQuery.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} — {localizedName(locale, c, c.name)}
                </option>
              ))}
            </Select>
            <TextArea
              label={tc('aiRawText')}
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              rows={6}
              placeholder={tc('aiRawTextPlaceholder')}
            />
            <div className="flex flex-wrap gap-2">
              <Button
                loading={createJob.isPending}
                onClick={() =>
                  createJob.mutate({ sourceType: 'TEXT', rawText: rawText || undefined })
                }
              >
                {tc('aiExtract')}
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept="application/pdf,image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) uploadAndExtract.mutate(file);
                  if (fileRef.current) fileRef.current.value = '';
                }}
              />
              <Button
                variant="secondary"
                loading={uploadAndExtract.isPending}
                onClick={() => fileRef.current?.click()}
              >
                {tc('aiUploadFile')}
              </Button>
            </div>
          </div>
        </Card>

        <Card title={tc('aiJobsReview')}>
          {jobs.length === 0 ? (
            <EmptyState title={tc('aiNoJobs')} description={tc('aiNoJobsHint')} />
          ) : (
            <>
              <ul className="space-y-2">
                {jobs.map((job) => (
                  <li key={job.id}>
                    <button
                      type="button"
                      className={`w-full rounded border px-3 py-2 text-left text-sm ${
                        selectedId === job.id
                          ? 'border-[var(--maher-brand)] bg-[var(--maher-surface)]'
                          : 'border-[var(--maher-border)]'
                      }`}
                      onClick={() => {
                        setSelectedId(job.id);
                        const map: Record<string, string> = {};
                        for (const f of job.fields ?? []) map[f.fieldName] = f.fieldValue ?? '';
                        setOverrides(map);
                      }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium" dir="ltr">
                          {job.number}
                        </span>
                        <StatusBadge status={job.status} />
                      </div>
                      <p className="mt-1 truncate text-[var(--maher-text-secondary)]">
                        {job.translatedText ?? job.originalText}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
              {meta && meta.totalPages > 1 ? (
                <div className="mt-4 flex items-center justify-end gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    {tCommon('previous')}
                  </Button>
                  <span className="text-sm text-text-secondary" dir="ltr">
                    {page} / {meta.totalPages}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={page >= meta.totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    {tCommon('next')}
                  </Button>
                </div>
              ) : null}
            </>
          )}
        </Card>
      </div>

      {selected ? (
        <Card title={tc('aiReviewTitle', { number: selected.number })}>
          <div className="space-y-3">
            <p className="text-sm text-[var(--maher-text-secondary)]">
              {tc('aiProviderStatus', {
                provider: selected.provider ?? 'mock',
                status: selected.status,
                rfq: selected.request?.number ?? '—',
              })}
              {selected.request ? (
                <>
                  {' '}
                  <Link
                    href={`/requests/${selected.request.id}`}
                    className="font-medium text-brand hover:underline"
                  >
                    {selected.request.number}
                  </Link>
                </>
              ) : null}
            </p>
            {selected.originalText ? (
              <div>
                <p className="mb-1 text-xs font-medium text-text-secondary">{tc('aiOcrText')}</p>
                <p className="rounded border border-[var(--maher-border)] p-3 text-sm whitespace-pre-wrap">
                  {selected.originalText}
                </p>
              </div>
            ) : null}
            {selected.translatedText && selected.translatedText !== selected.originalText ? (
              <div>
                <p className="mb-1 text-xs font-medium text-text-secondary">{tc('aiTranslation')}</p>
                <p className="rounded border border-[var(--maher-border)] p-3 text-sm whitespace-pre-wrap">
                  {selected.translatedText}
                </p>
              </div>
            ) : null}
            {(selected.fields ?? []).length === 0 ? (
              <EmptyState title={tc('aiNoFields')} />
            ) : (
              (selected.fields ?? []).map((f) => {
                const conf = confidenceLabel(f.confidence);
                return (
                  <Input
                    key={f.fieldName}
                    label={`${f.fieldName}${f.isMissing ? ` (${tc('aiMissing')})` : ''}${conf ? ` · ${tc('aiConfidence')} ${conf}` : ''}`}
                    value={overrides[f.fieldName] ?? ''}
                    onChange={(e) =>
                      setOverrides((prev) => ({ ...prev, [f.fieldName]: e.target.value }))
                    }
                  />
                );
              })
            )}
            <TextArea
              label={tc('aiRejectReasonLabel')}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={2}
              placeholder={tc('aiRejectReasonPlaceholder')}
            />
            <div className="flex flex-wrap gap-2">
              <Button loading={approve.isPending} onClick={() => approve.mutate()}>
                {tc('aiApprove')}
              </Button>
              <Button
                variant="secondary"
                loading={reject.isPending}
                onClick={() => reject.mutate()}
              >
                {tc('aiReject')}
              </Button>
            </div>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
