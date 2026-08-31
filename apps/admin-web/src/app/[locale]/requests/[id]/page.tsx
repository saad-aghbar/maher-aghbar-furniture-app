'use client';

import {
  LineItemsEditor,
  emptyLineItem,
  type LineItemDraft,
} from '@/components/admin/line-items-editor';
import { ConfirmDialog } from '@/components/admin/confirm-dialog';
import { PageHeader } from '@/components/admin/page-header';
import { Link, useRouter } from '@/i18n/navigation';
import { apiFetch, apiUpload, apiUploadFromUrl, API_URL } from '@/lib/api-client';
import { mutationErrorMessage } from '@/hooks/use-api-mutation';
import {
  Alert,
  Badge,
  Button,
  Card,
  ErrorState,
  Input,
  PhotoAttachField,
  Skeleton,
  StatusBadge,
  Table,
  TableBody,
  TableCell,
  TableNumericCell,
  TableHead,
  TableHeaderCell,
  TableRow,
  TextArea,
  MotionSection,
} from '@maher/ui';
import { localizedName } from '@maher/i18n';
import { manufacturingComplexityDisplayKey } from '@maher/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';

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
  manufacturingComplexity?: 'STANDARD' | 'MODIFIED' | 'CUSTOM' | string | null;
  width?: number | string | null;
  height?: number | string | null;
  depth?: number | string | null;
}

interface RequestDetail {
  id: string;
  number: string;
  status: string;
  source?: string;
  projectName?: string | null;
  externalOrderNumber?: string | null;
  contactName?: string | null;
  deliveryAddress?: string | null;
  requiredDeliveryDate?: string | null;
  offeredDeliveryDate?: string | null;
  notes?: string | null;
  internalNotes?: string | null;
  priority?: string;
  presentationKey?: string;
  informationRequestReason?: string | null;
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

function localDealerMinimumRequestYmd(now = new Date()): string {
  const dt = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 4);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

export default function AdminRfqDetailPage({ params }: { params: { id: string } }) {
  const locale = useLocale();
  const tc = useTranslations('catalog');
  const tq = useTranslations('quotations');
  const tSales = useTranslations('sales');
  const tNav = useTranslations('navigation');
  const tStatus = useTranslations('statuses');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const qc = useQueryClient();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [internalNotes, setInternalNotes] = useState('');
  const [projectName, setProjectName] = useState('');
  const [externalOrderNumber, setExternalOrderNumber] = useState('');
  const [draftLines, setDraftLines] = useState<LineItemDraft[]>([]);
  const [needsInfoOpen, setNeedsInfoOpen] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [deliveryChangeDate, setDeliveryChangeDate] = useState('');
  const [deliveryChangeReason, setDeliveryChangeReason] = useState('');

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
      setExternalOrderNumber(r.externalOrderNumber ?? '');
      setDeliveryChangeDate(
        (r.offeredDeliveryDate ?? r.requiredDeliveryDate ?? '').toString().slice(0, 10),
      );
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
          externalOrderNumber: externalOrderNumber.trim() || undefined,
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

  const deliveryMutation = useMutation({
    mutationFn: async (args: { kind: 'confirm' | 'change'; date: string; reason?: string }) => {
      if (args.kind === 'confirm') {
        return apiFetch(`/api/v1/requests/${params.id}/confirm-delivery`, {
          method: 'POST',
          body: JSON.stringify({ date: args.date }),
        });
      }
      return apiFetch(`/api/v1/requests/${params.id}/change-delivery`, {
        method: 'POST',
        body: JSON.stringify({ date: args.date, reason: args.reason }),
      });
    },
    onSuccess: async () => {
      setMessage(tCommon('saved'));
      setDeliveryChangeReason('');
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
          offeredDeliveryDate: data.offeredDeliveryDate ?? undefined,
          customerNotes: data.notes ?? undefined,
          lines: data.items.map((item) => {
            const complexity =
              item.manufacturingComplexity === 'MODIFIED' ||
              item.manufacturingComplexity === 'CUSTOM'
                ? item.manufacturingComplexity
                : item.manufacturingComplexity === 'STANDARD'
                  ? 'STANDARD'
                  : undefined;
            const width = Number(item.width);
            const height = Number(item.height);
            const depth = Number(item.depth);
            return {
              description: item.productName,
              quantity: Number(item.quantity) > 0 ? Number(item.quantity) : 1,
              unitPrice: 0,
              unit: 'pcs',
              ...(item.material ? { material: item.material } : {}),
              ...(item.fabric ? { fabric: item.fabric } : {}),
              ...(item.color ? { color: item.color } : {}),
              ...(complexity ? { manufacturingComplexity: complexity } : {}),
              ...(Number.isFinite(width) && width > 0 ? { width } : {}),
              ...(Number.isFinite(height) && height > 0 ? { height } : {}),
              ...(Number.isFinite(depth) && depth > 0 ? { depth } : {}),
              taxRate: 0.16,
            };
          }),
        }),
      });
    },
    onSuccess: (quote) => router.push(`/quotations/${quote.id}`),
    onError: (err) => setError(mutationErrorMessage(err)),
  });

  const uploadMutation = useMutation({
    mutationFn: async (args: { file?: File; url?: string }) => {
      const qs = `category=RFQ_ATTACHMENT&requestId=${params.id}`;
      if (args.url) {
        return apiUploadFromUrl(`/api/v1/uploads/from-url?${qs}`, { url: args.url });
      }
      if (!args.file) throw new Error(tCommon('required'));
      const form = new FormData();
      form.append('file', args.file);
      return apiUpload(`/api/v1/uploads?${qs}`, form);
    },
    onSuccess: async () => {
      setError(null);
      setMessage(tc('documentUploaded'));
      await qc.invalidateQueries({ queryKey: ['admin-rfq', params.id] });
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
  const isFactoryReview = ['SUBMITTED', 'UNDER_REVIEW', 'NEEDS_INFORMATION'].includes(data.status);
  const dealerMinRequestYmd = localDealerMinimumRequestYmd();
  const requestedYmd = data.requiredDeliveryDate
    ? String(data.requiredDeliveryDate).slice(0, 10)
    : '';
  const confirmWouldOverrideLead = Boolean(requestedYmd && requestedYmd < dealerMinRequestYmd);
  const changeWouldOverrideLead = Boolean(
    deliveryChangeDate.trim() && deliveryChangeDate.trim() < dealerMinRequestYmd,
  );
  const presentationKey = data.presentationKey;

  function lineComplexityLabel(code?: string | null) {
    if (!code) return null;
    const key = manufacturingComplexityDisplayKey(code);
    if (key === 'standard') return tc('lineKindStandard');
    if (key === 'customized') return tc('lineKindCustomized');
    return tc('lineKindCustom');
  }

  function statusPresentationLabel() {
    switch (presentationKey) {
      case 'waitingForReview':
        return tc('waitingForReview');
      case 'needsInformation':
        return tc('needsInformation');
      case 'draft':
        return tStatus('DRAFT');
      default:
        return undefined;
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        backHref="/orders"
        title={data.number}
        description={
          [
            isFactoryReview ? tc('factoryReview') : null,
            data.customer
              ? localizedName(locale, data.customer)
              : (data.contactName ?? undefined),
          ]
            .filter(Boolean)
            .join(' · ') || undefined
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <StatusBadge status={data.status} label={statusPresentationLabel()} />
          </div>
        }
      />
      {message ? <Alert variant="success">{message}</Alert> : null}
      {error ? <Alert variant="error">{error}</Alert> : null}

      {data.informationRequestReason ? (
        <Alert variant="warning">
          <p className="font-medium">{tc('informationRequestReason')}</p>
          <p className="mt-1 text-sm">{data.informationRequestReason}</p>
        </Alert>
      ) : null}

      <div className="maher-stagger space-y-6">
      <MotionSection className="maher-form-section" as="div">
      <Card title={tCommon('details')}>
        <dl className="grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-sm text-[var(--maher-text-secondary)]">{tSales('systemOrderNumber')}</dt>
            <dd className="font-medium" dir="ltr">
              {data.number}
            </dd>
          </div>
          <div>
            <Input
              label={tSales('dealerOrderNumber')}
              value={externalOrderNumber}
              onChange={(e) => setExternalOrderNumber(e.target.value)}
              dir="ltr"
            />
          </div>
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
          <div>
            <dt className="text-sm text-[var(--maher-text-secondary)]">{tc('requestedDelivery')}</dt>
            <dd className="font-medium" dir="ltr">
              {data.requiredDeliveryDate ? String(data.requiredDeliveryDate).slice(0, 10) : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-[var(--maher-text-secondary)]">{tc('offeredDelivery')}</dt>
            <dd className="font-medium" dir="ltr">
              {data.offeredDeliveryDate ? String(data.offeredDeliveryDate).slice(0, 10) : '—'}
            </dd>
          </div>
          <div className="sm:col-span-2">
            {confirmWouldOverrideLead || changeWouldOverrideLead ? (
              <Alert variant="warning">{tc('leadTimeOverrideWarning')}</Alert>
            ) : null}
          </div>
          <div>
            <Input
              label={tc('changeDate')}
              type="date"
              value={deliveryChangeDate}
              onChange={(e) => setDeliveryChangeDate(e.target.value)}
            />
          </div>
          <div>
            <Input
              label={tc('changeDateReason')}
              value={deliveryChangeReason}
              onChange={(e) => setDeliveryChangeReason(e.target.value)}
            />
          </div>
        </dl>
        <div className="maher-detail-sticky-actions mt-4 flex flex-wrap gap-2">
          {data.requiredDeliveryDate && !confirmWouldOverrideLead ? (
            <Button
              variant="secondary"
              loading={deliveryMutation.isPending}
              onClick={() =>
                deliveryMutation.mutate({
                  kind: 'confirm',
                  date: String(data.requiredDeliveryDate).slice(0, 10),
                })
              }
            >
              {tc('confirmDate')}
            </Button>
          ) : null}
          <Button
            variant="secondary"
            loading={deliveryMutation.isPending}
            disabled={!deliveryChangeDate.trim() || !deliveryChangeReason.trim()}
            onClick={() =>
              deliveryMutation.mutate({
                kind: 'change',
                date: deliveryChangeDate.trim(),
                reason: deliveryChangeReason.trim(),
              })
            }
          >
            {tc('changeDate')}
          </Button>
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
      </MotionSection>

      <MotionSection className="maher-form-section" as="div">
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
              {data.items.map((item) => {
                const complexity = lineComplexityLabel(item.manufacturingComplexity);
                return (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-2">
                        <span>{item.productName}</span>
                        {complexity ? (
                          <Badge
                            variant={
                              item.manufacturingComplexity === 'CUSTOM'
                                ? 'warning'
                                : item.manufacturingComplexity === 'MODIFIED'
                                  ? 'info'
                                  : 'default'
                            }
                          >
                            {complexity}
                          </Badge>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableNumericCell>{String(item.quantity)}</TableNumericCell>
                    <TableCell>{item.notes || item.description || '—'}</TableCell>
                    <TableCell>
                      {[item.material, item.fabric, item.color].filter(Boolean).join(' / ') || '—'}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>
      </MotionSection>

      <MotionSection className="maher-form-section" as="div">
      <Card title={tc('attachments')}>
        <div className="space-y-3">
          <PhotoAttachField
            hint={tCommon('photoUrlHint')}
            accept="application/pdf,image/*,.doc,.docx,.xlsx"
            uploadLabel={tCommon('upload')}
            uploadingLabel={tCommon('uploading')}
            attachUrlLabel={tCommon('attachFromUrl')}
            disabled={uploadMutation.isPending}
            onUploadFile={async (file) => {
              await uploadMutation.mutateAsync({ file });
            }}
            onAttachUrl={async (url) => {
              await uploadMutation.mutateAsync({ url });
            }}
          />
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
      </MotionSection>

      {(data.quotations?.length ?? 0) > 0 ? (
        <MotionSection className="maher-form-section" as="div">
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
        </MotionSection>
      ) : null}
      </div>

      <ConfirmDialog
        open={needsInfoOpen}
        title={tc('needsInformation')}
        description={tc('informationRequestReasonHint')}
        confirmLabel={tc('needsInformation')}
        withReason
        reasonRequired
        reasonLabel={tc('informationRequestReason')}
        loading={workflowMutation.isPending}
        error={error}
        onConfirm={(reason) => {
          if (!reason?.trim()) {
            setError(tc('informationRequestReasonRequired'));
            return;
          }
          setError(null);
          workflowMutation.mutate({
            path: 'needs-information',
            body: { reason: reason.trim() },
          });
        }}
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
