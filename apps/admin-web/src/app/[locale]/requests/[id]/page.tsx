'use client';

import {
  LineItemsEditor,
  emptyLineItem,
  type LineItemDraft,
} from '@/components/admin/line-items-editor';
import { ConfirmDialog } from '@/components/admin/confirm-dialog';
import { PageHeader } from '@/components/admin/page-header';
import { Link, useRouter } from '@/i18n/navigation';
import { apiFetch, API_URL } from '@/lib/api-client';
import { mutationErrorMessage } from '@/hooks/use-api-mutation';
import {
  Alert,
  Button,
  Card,
  ErrorState,
  Input,
  Skeleton,
  StatusBadge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
  TextArea,
} from '@maher/ui';
import { localizedName } from '@maher/i18n';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useRef, useState } from 'react';

interface RequestItem {
  id: string;
  productName: string;
  description?: string | null;
  quantity: number | string;
  unit?: string | null;
  material?: string | null;
  fabric?: string | null;
  color?: string | null;
  notes?: string | null;
}

interface RequestDetail {
  id: string;
  number: string;
  status: string;
  source?: string;
  projectName?: string | null;
  contactName?: string | null;
  deliveryAddress?: string | null;
  notes?: string | null;
  internalNotes?: string | null;
  priority?: string;
  customer?: {
    id: string;
    name: string;
    nameAr?: string | null;
    nameEn?: string | null;
    nameHe?: string | null;
  } | null;
  items: RequestItem[];
  documents?: Array<{ id: string; fileName: string }>;
  quotations?: Array<{ id: string; number: string; status: string }>;
}

export default function AdminRfqDetailPage({ params }: { params: { id: string } }) {
  const locale = useLocale();
  const tc = useTranslations('catalog');
  const tq = useTranslations('quotations');
  const tNav = useTranslations('navigation');
  const tStatus = useTranslations('statuses');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [internalNotes, setInternalNotes] = useState('');
  const [projectName, setProjectName] = useState('');
  const [draftLines, setDraftLines] = useState<LineItemDraft[]>([]);
  const [needsInfoOpen, setNeedsInfoOpen] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);

  function sourceLabel(value: string) {
    const map: Record<string, string> = {
      PORTAL: tq('channelPortal'),
      SALES: tc('sourceSales'),
      WHATSAPP: tq('channelWhatsapp'),
      EMAIL: tq('channelEmail'),
      PDF: tq('channelPdf'),
      PHONE: tq('channelPhone'),
    };
    return map[value] ?? value;
  }

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-rfq', params.id],
    queryFn: async () => {
      const r = await apiFetch<RequestDetail>(`/api/v1/requests/${params.id}`);
      setInternalNotes(r.internalNotes ?? '');
      setProjectName(r.projectName ?? '');
      setDraftLines(
        (r.items ?? []).map((item) =>
          emptyLineItem({
            key: item.id,
            description: item.productName,
            quantity: String(item.quantity),
            unitPrice: '0',
            notes: item.description ?? '',
          }),
        ),
      );
      return r;
    },
  });

  const submitMutation = useMutation({
    mutationFn: () =>
      apiFetch(`/api/v1/requests/${params.id}/submit`, { method: 'POST' }),
    onSuccess: async () => {
      setMessage(tc('rfqSubmitted'));
      await qc.invalidateQueries({ queryKey: ['admin-rfq', params.id] });
    },
    onError: (err) => setError(mutationErrorMessage(err)),
  });

  const workflowMutation = useMutation({
    mutationFn: async (args: { path: string; body?: Record<string, unknown> }) => {
      return apiFetch(`/api/v1/requests/${params.id}/${args.path}`, {
        method: 'POST',
        body: args.body ? JSON.stringify(args.body) : undefined,
      });
    },
    onSuccess: async () => {
      setError(null);
      setNeedsInfoOpen(false);
      setCloseOpen(false);
      setMessage(tc('rfqStatusUpdated'));
      await qc.invalidateQueries({ queryKey: ['admin-rfq', params.id] });
      await qc.invalidateQueries({ queryKey: ['admin-rfqs'] });
    },
    onError: (err) => setError(mutationErrorMessage(err)),
  });

  const saveMutation = useMutation({
    mutationFn: () => {
      const isDraft = data?.status === 'DRAFT';
      const items = isDraft
        ? draftLines
            .filter((line) => line.description.trim())
            .map((line) => ({
              productName: line.description.trim(),
              quantity: Number(line.quantity) || 0,
              notes: line.notes?.trim() || undefined,
            }))
        : undefined;
      return apiFetch(`/api/v1/requests/${params.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          internalNotes: internalNotes.trim() || undefined,
          projectName: projectName.trim() || undefined,
          ...(items ? { items } : {}),
        }),
      });
    },
    onSuccess: async () => {
      setMessage(tCommon('saved'));
      await qc.invalidateQueries({ queryKey: ['admin-rfq', params.id] });
    },
    onError: (err) => setError(mutationErrorMessage(err)),
  });

  const quoteMutation = useMutation({
    mutationFn: async () => {
      if (!data?.customer?.id || !data.items.length) {
        throw new Error(tc('customerItemsRequired'));
      }
      return apiFetch<{ id: string }>('/api/v1/quotations', {
        method: 'POST',
        body: JSON.stringify({
          customerId: data.customer.id,
          requestId: data.id,
          deliveryTerms: data.deliveryAddress ?? undefined,
          customerNotes: data.notes ?? undefined,
          lines: data.items.map((item) => ({
            description: item.productName,
            quantity: Number(item.quantity),
            unitPrice: 0,
            unit: item.unit ?? 'pcs',
            material: item.material ?? undefined,
            fabric: item.fabric ?? undefined,
            color: item.color ?? undefined,
            notes: item.notes ?? item.description ?? undefined,
            taxRate: 0.16,
          })),
        }),
      });
    },
    onSuccess: (quote) => router.push(`/quotations/${quote.id}`),
    onError: (err) => setError(mutationErrorMessage(err)),
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(
        `${API_URL}/api/v1/uploads?category=RFQ_ATTACHMENT&requestId=${params.id}`,
        { method: 'POST', credentials: 'include', body: form },
      );
      if (!res.ok) throw new Error(tCommon('uploadFailed'));
      return res.json();
    },
    onSuccess: async () => {
      setError(null);
      setMessage(tc('documentUploaded'));
      await qc.invalidateQueries({ queryKey: ['admin-rfq', params.id] });
      if (fileRef.current) fileRef.current.value = '';
    },
    onError: (err) => setError(mutationErrorMessage(err)),
  });

  async function openDocument(id: string) {
    try {
      const link = await apiFetch<{ downloadPath: string }>(`/api/v1/uploads/documents/${id}/link`);
      window.open(`${API_URL}${link.downloadPath}`, '_blank');
    } catch (err) {
      setError(mutationErrorMessage(err));
    }
  }

  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (isError || !data) {
    return (
      <ErrorState
        title={tNav('rfqRequests')}
        onRetry={() => refetch()}
        retryLabel={tCommon('retry')}
      />
    );
  }

  const canUnderReview = ['SUBMITTED', 'NEEDS_INFORMATION'].includes(data.status);
  const canReady = ['UNDER_REVIEW', 'NEEDS_INFORMATION', 'SUBMITTED'].includes(data.status);
  const canNeedsInfo = ['SUBMITTED', 'UNDER_REVIEW'].includes(data.status);
  const canClose = !['CLOSED', 'CANCELLED', 'QUOTED'].includes(data.status);
  const canQuote = ['READY_FOR_QUOTATION', 'UNDER_REVIEW', 'SUBMITTED'].includes(data.status);

  return (
    <div className="space-y-6">
      <PageHeader
        title={data.number}
        description={
          data.customer
            ? localizedName(locale, data.customer)
            : (data.contactName ?? undefined)
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/requests">
              <Button variant="ghost" size="sm">
                {tCommon('back')}
              </Button>
            </Link>
            <StatusBadge status={data.status} />
          </div>
        }
      />
      {message ? <Alert variant="success">{message}</Alert> : null}
      {error ? <Alert variant="error">{error}</Alert> : null}

      <Card title={tCommon('details')}>
        <dl className="grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-sm text-[var(--maher-text-secondary)]">{tc('source')}</dt>
            <dd className="font-medium">{data.source ? sourceLabel(data.source) : '—'}</dd>
          </div>
          <div>
            <dt className="text-sm text-[var(--maher-text-secondary)]">{tc('priority')}</dt>
            <dd className="font-medium">
              {data.priority ? tStatus(data.priority as never) : '—'}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <Input
              label={tc('project')}
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <TextArea
              label={tc('internalNotes')}
              value={internalNotes}
              onChange={(e) => setInternalNotes(e.target.value)}
              rows={3}
            />
          </div>
        </dl>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => saveMutation.mutate()} loading={saveMutation.isPending}>
            {tCommon('save')}
          </Button>
          {data.status === 'DRAFT' ? (
            <Button onClick={() => submitMutation.mutate()} loading={submitMutation.isPending}>
              {tCommon('submit')}
            </Button>
          ) : null}
          {canUnderReview ? (
            <Button
              variant="secondary"
              loading={workflowMutation.isPending}
              onClick={() => workflowMutation.mutate({ path: 'under-review' })}
            >
              {tc('markUnderReview')}
            </Button>
          ) : null}
          {canReady ? (
            <Button
              variant="secondary"
              loading={workflowMutation.isPending}
              onClick={() => workflowMutation.mutate({ path: 'ready-for-quotation' })}
            >
              {tc('markReadyForQuote')}
            </Button>
          ) : null}
          {canNeedsInfo ? (
            <Button variant="ghost" onClick={() => setNeedsInfoOpen(true)}>
              {tc('needsInformation')}
            </Button>
          ) : null}
          {canClose ? (
            <Button variant="ghost" onClick={() => setCloseOpen(true)}>
              {tc('closeRfq')}
            </Button>
          ) : null}
          {data.customer?.id && canQuote ? (
            <Button onClick={() => quoteMutation.mutate()} loading={quoteMutation.isPending}>
              {tc('createQuotation')}
            </Button>
          ) : null}
        </div>
      </Card>

      <Card title={tc('lineItems')} padded={data.status === 'DRAFT'}>
        {data.status === 'DRAFT' ? (
          <LineItemsEditor
            lines={draftLines}
            onChange={setDraftLines}
            showUnitPrice={false}
            showNotes
          />
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>{tc('product')}</TableHeaderCell>
                <TableHeaderCell>{tc('qty')}</TableHeaderCell>
                <TableHeaderCell>{tc('notes')}</TableHeaderCell>
                <TableHeaderCell>{tc('specs')}</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.productName}</TableCell>
                  <TableCell dir="ltr">{String(item.quantity)}</TableCell>
                  <TableCell>{item.notes || item.description || '—'}</TableCell>
                  <TableCell>
                    {[item.material, item.fabric, item.color].filter(Boolean).join(' / ') || '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <Card title={tc('attachments')}>
        <div className="space-y-3">
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf,image/*,.doc,.docx,.xlsx"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) uploadMutation.mutate(file);
            }}
          />
          <Button
            variant="secondary"
            size="sm"
            loading={uploadMutation.isPending}
            onClick={() => fileRef.current?.click()}
          >
            {tCommon('upload')}
          </Button>
          {(data.documents?.length ?? 0) > 0 ? (
            <ul className="space-y-1 text-sm">
              {data.documents!.map((d) => (
                <li key={d.id}>
                  <button
                    type="button"
                    className="font-medium text-brand hover:underline"
                    onClick={() => void openDocument(d.id)}
                  >
                    {d.fileName}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-text-secondary">{tc('noAttachments')}</p>
          )}
        </div>
      </Card>

      {(data.quotations?.length ?? 0) > 0 ? (
        <Card title={tc('quotations')}>
          <ul className="space-y-2">
            {data.quotations!.map((q) => (
              <li key={q.id}>
                <Link href={`/quotations/${q.id}`} className="font-medium text-brand hover:underline">
                  {q.number}
                </Link>{' '}
                <StatusBadge status={q.status} />
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <ConfirmDialog
        open={needsInfoOpen}
        title={tc('needsInformation')}
        description={tc('needsInformationConfirm')}
        confirmLabel={tc('needsInformation')}
        withReason
        reasonLabel={tc('notes')}
        loading={workflowMutation.isPending}
        error={error}
        onConfirm={(notes) =>
          workflowMutation.mutate({ path: 'needs-information', body: { notes } })
        }
        onClose={() => setNeedsInfoOpen(false)}
      />

      <ConfirmDialog
        open={closeOpen}
        title={tc('closeRfq')}
        description={tc('closeRfqConfirm')}
        confirmLabel={tc('closeRfq')}
        danger
        loading={workflowMutation.isPending}
        error={error}
        onConfirm={() => workflowMutation.mutate({ path: 'close' })}
        onClose={() => setCloseOpen(false)}
      />
    </div>
  );
}
