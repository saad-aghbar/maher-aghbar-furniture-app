'use client';

import { DealerListDesk } from '@/components/dealer/dealer-list-desk';
import { approvalTone, lifecycleTone, mediaSrc, useReturnCopy } from '@/components/returns/return-shared';
import { apiFetch, apiUpload, ApiClientError } from '@/lib/api-client';
import { mutationErrorMessage } from '@/hooks/use-api-mutation';
import { Alert, Button, CameraCapture, Combobox, Input, Ltr, NumberField, RowThumb, Sheet, Stamp, TextArea } from '@maher/ui';
import { Armchair } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

interface ReturnRow {
  id: string;
  number: string;
  productDesc: string;
  quantity: string | number;
  reason: string;
  approvalStatus?: string;
  lifecycleState?: string | null;
  physicalStatus?: string | null;
  createdAt?: string;
  reasonPhotoUrl?: string | null;
  issuePhotoUrl?: string | null;
  productImageUrl?: string | null;
  salesOrder?: { number: string } | null;
}

interface SalesOrderOption {
  id: string;
  number: string;
  status: string;
  lines?: Array<{
    description: string;
    quantity: string | number;
    product?: { nameEn?: string | null; nameAr?: string | null; imageUrl?: string | null } | null;
  }>;
}

interface UploadResult {
  document: { storageKey: string };
}

const RETURN_REASONS = [
  'MANUFACTURING_DEFECT',
  'INCORRECT_MEASUREMENT',
  'INCORRECT_MATERIAL',
  'INCORRECT_COLOR',
  'DELIVERY_DAMAGE',
  'CUSTOMER_REQUEST',
  'OTHER',
] as const;

export default function ReturnsPage() {
  const t = useTranslations('navigation');
  const tc = useTranslations('catalog');
  const tCommon = useTranslations('common');
  const queryClient = useQueryClient();
  const copy = useReturnCopy();

  const [formOpen, setFormOpen] = useState(false);
  const [salesOrderId, setSalesOrderId] = useState('');
  const [productDesc, setProductDesc] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [reason, setReason] = useState<string>(RETURN_REASONS[0]);
  const [description, setDescription] = useState('');
  const [reasonPhoto, setReasonPhoto] = useState('');
  const [issuePhoto, setIssuePhoto] = useState('');
  const [lineIndex, setLineIndex] = useState(0);
  const [formError, setFormError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);

  const ordersQuery = useQuery({
    queryKey: ['customer-sales-orders-for-returns'],
    queryFn: () =>
      apiFetch<{ data: SalesOrderOption[] }>('/api/v1/sales-orders?pageSize=100').then(
        (r) => r.data,
      ),
    enabled: formOpen,
  });

  const orders = ordersQuery.data ?? [];
  const selectedOrderLines = orders.find((o) => o.id === salesOrderId)?.lines ?? [];

  function resetForm() {
    setSalesOrderId('');
    setProductDesc('');
    setQuantity('1');
    setReason(RETURN_REASONS[0]);
    setDescription('');
    setReasonPhoto('');
    setIssuePhoto('');
    setLineIndex(0);
    setFormError(null);
  }

  function onSelectOrder(id: string) {
    setSalesOrderId(id);
    const order = orders.find((o) => o.id === id);
    setLineIndex(0);
    const line = order?.lines?.[0];
    if (line) {
      setProductDesc(line.description || line.product?.nameEn || line.product?.nameAr || '');
      setQuantity(String(Number(line.quantity) || 1));
    }
  }

  function onSelectLine(index: number) {
    setLineIndex(index);
    const order = orders.find((o) => o.id === salesOrderId);
    const line = order?.lines?.[index];
    if (line) {
      setProductDesc(line.description || line.product?.nameEn || line.product?.nameAr || '');
      setQuantity(String(Number(line.quantity) || 1));
    }
  }

  async function uploadPhoto(file: File, category: string): Promise<string> {
    const form = new FormData();
    form.append('file', file);
    const res = await apiUpload<UploadResult>(
      `/api/v1/uploads?category=${encodeURIComponent(category)}`,
      form,
    );
    return res.document.storageKey;
  }

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!salesOrderId) throw new ApiClientError(tc('returnOrderRequired'), 400);
      if (!productDesc.trim()) throw new ApiClientError(tCommon('required'), 400);
      const reasonKey = reasonPhoto.trim();
      const issueKey = issuePhoto.trim();
      if (!reasonKey || !issueKey) throw new ApiClientError(tc('returnPhotosRequired'), 400);

      return apiFetch('/api/v1/returns', {
        method: 'POST',
        body: JSON.stringify({
          salesOrderId,
          productDesc: productDesc.trim(),
          quantity: Number(quantity) || 1,
          reason,
          description: description.trim() || undefined,
          reasonPhotoKey: reasonKey,
          issuePhotoKey: issueKey,
        }),
      });
    },
    onSuccess: async () => {
      setFormOpen(false);
      resetForm();
      setBanner(tc('returnSubmitted'));
      await queryClient.invalidateQueries({ queryKey: ['customer-returns'] });
    },
    onError: (err) => setFormError(mutationErrorMessage(err)),
  });

  const isOpen = (r: ReturnRow) => !['COMPLETED', 'REJECTED', 'SCRAPPED', 'RETURNED_TO_STOCK'].includes((r.lifecycleState ?? '').toUpperCase()) && (r.approvalStatus ?? 'PENDING').toUpperCase() !== 'REJECTED';
  const stateLabel = (r: ReturnRow) => (r.lifecycleState ? copy.status(r.lifecycleState) : copy.status(r.approvalStatus ?? 'PENDING'));
  const stateTone = (r: ReturnRow) => (r.lifecycleState ? lifecycleTone(r.lifecycleState) : approvalTone(r.approvalStatus));

  return (
    <>
      <DealerListDesk<ReturnRow>
        title={t('returns')}
        description={tc('returnsDescription')}
        tone="warning"
        queryKey={['customer-returns']}
        fetchPath="/api/v1/returns?pageSize=50"
        emptyTitle={tc('noReturns')}
        emptyDescription={tc('returnsDescription')}
        rowHref={(row) => `/dealer/returns/${row.id}`}
        actions={
          <Button leadingIcon={<Plus className="h-4 w-4" />} onClick={() => setFormOpen(true)}>
            {tc('submitReturn')}
          </Button>
        }
        chips={[
          { id: 'all', label: tCommon('all'), match: () => true },
          { id: 'review', label: copy.status('PENDING'), tone: 'warning', match: (r) => ['PENDING', 'NEED_INFO'].includes((r.approvalStatus ?? 'PENDING').toUpperCase()) },
          { id: 'open', label: copy.status('APPROVED'), tone: 'brand', match: (r) => (r.approvalStatus ?? '').toUpperCase() === 'APPROVED' && isOpen(r) },
          { id: 'closed', label: copy.status('COMPLETED'), tone: 'neutral', match: (r) => !isOpen(r) },
        ]}
        figures={(rows) => [
          { label: t('returns'), value: rows.length },
          { label: copy.status('PENDING'), value: rows.filter((r) => ['PENDING', 'NEED_INFO'].includes((r.approvalStatus ?? 'PENDING').toUpperCase())).length, tone: 'warning' },
          { label: copy.status('APPROVED'), value: rows.filter((r) => (r.approvalStatus ?? '').toUpperCase() === 'APPROVED' && isOpen(r)).length, tone: 'brand' },
        ]}
        search={{ placeholder: tc('searchProducts'), match: (r, q) => `${r.number} ${r.productDesc} ${r.salesOrder?.number ?? ''}`.toLowerCase().includes(q) }}
        columns={[
          {
            key: 'product',
            header: tc('product'),
            cell: (row) => (
              <span className="flex items-center gap-3">
                <RowThumb src={mediaSrc(row.productImageUrl)} icon={<Armchair className="h-4 w-4" />} />
                <span className="min-w-0">
                  <span className="block truncate font-semibold text-[var(--maher-text-primary)]">{row.productDesc}</span>
                  <Ltr className="block text-[12px] text-[var(--maher-text-tertiary)]">{row.number}{row.salesOrder?.number ? ` · ${row.salesOrder.number}` : ''}</Ltr>
                </span>
              </span>
            ),
          },
          { key: 'quantity', header: tc('quantity'), hideBelow: 'md', numeric: true, cell: (row) => <Ltr>{String(row.quantity)}</Ltr> },
          { key: 'reason', header: tc('reason'), hideBelow: 'lg', cell: (row) => <span className="text-[var(--maher-text-secondary)]">{copy.reason(row.reason)}</span> },
          { key: 'status', header: tCommon('status'), cell: (row) => <Stamp tone={stateTone(row)} size="sm">{stateLabel(row)}</Stamp> },
        ]}
        mobileRow={(row) => ({ title: row.productDesc, meta: `${row.number} · ${copy.reason(row.reason)}`, trailing: <Stamp tone={stateTone(row)} size="sm">{stateLabel(row)}</Stamp> })}
      >
        {banner ? <Alert variant="success">{banner}</Alert> : null}
      </DealerListDesk>

      <Sheet
        open={formOpen}
        onClose={() => !submitMutation.isPending && setFormOpen(false)}
        title={tc('submitReturn')}
        description={tc('returnsDescription')}
        tone="warning"
        closeLabel={tCommon('close')}
        footer={
          <>
            <Button
              variant="ghost"
              disabled={submitMutation.isPending}
              onClick={() => {
                setFormOpen(false);
                resetForm();
              }}
            >
              {tCommon('cancel')}
            </Button>
            <Button loading={submitMutation.isPending} onClick={() => submitMutation.mutate()}>
              {tCommon('submit')}
            </Button>
          </>
        }
      >
        <div className="grid gap-4">
          {formError ? <Alert variant="error">{formError}</Alert> : null}

          <Combobox<string>
            label={tc('selectSalesOrder')}
            value={salesOrderId || null}
            placeholder={tc('selectSalesOrderPlaceholder')}
            disabled={submitMutation.isPending || ordersQuery.isLoading}
            options={orders.map((o) => ({ value: o.id, label: o.number, description: o.lines?.[0]?.description ?? undefined }))}
            onChange={(value) => onSelectOrder(value ?? '')}
          />
          {selectedOrderLines.length > 1 ? (
            <div>
              <span className="mb-1.5 block text-[13px] font-medium text-[var(--maher-text-primary)]">{tc('selectOrderLine')}</span>
              <ul className="grid gap-1.5" role="radiogroup" aria-label={tc('selectOrderLine')}>
                {selectedOrderLines.map((line, i) => {
                  const active = lineIndex === i;
                  const img = mediaSrc(line.product?.imageUrl);
                  return (
                    <li key={`${line.description}-${i}`}>
                      <button
                        type="button"
                        role="radio"
                        aria-checked={active}
                        disabled={submitMutation.isPending}
                        onClick={() => onSelectLine(i)}
                        className={`flex w-full items-center gap-3 rounded-[12px] border px-3 py-2 text-start transition ${active ? 'border-[var(--maher-text-primary)] bg-[var(--maher-surface-muted)]' : 'border-[var(--maher-border)] hover:border-[var(--maher-brand)]'}`}
                      >
                        <RowThumb src={img} icon={<Armchair className="h-4 w-4" />} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-medium text-[var(--maher-text-primary)]">{line.description || line.product?.nameEn || line.product?.nameAr || `#${i + 1}`}</span>
                          <Ltr className="block text-[12px] text-[var(--maher-text-tertiary)]">× {String(line.quantity)}</Ltr>
                        </span>
                        {active ? <Stamp tone="brand" size="sm">✓</Stamp> : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_8rem]">
            <Input label={tc('product')} value={productDesc} onChange={(e) => setProductDesc(e.target.value)} disabled={submitMutation.isPending} />
            <NumberField label={tc('quantity')} value={quantity === '' ? null : Number(quantity)} onChange={(v) => setQuantity(v == null ? '' : String(v))} min={1} step={1} decimals={0} disabled={submitMutation.isPending} />
          </div>
          <div>
            <span className="mb-1.5 block text-[13px] font-medium text-[var(--maher-text-primary)]">{tc('reason')}</span>
            <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={tc('reason')}>
              {RETURN_REASONS.map((r) => {
                const active = reason === r;
                return (
                  <button
                    key={r}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    disabled={submitMutation.isPending}
                    onClick={() => setReason(r)}
                    className={`rounded-full border px-3 py-1.5 text-[13px] font-medium transition ${active ? 'border-[var(--maher-text-primary)] bg-[var(--maher-text-primary)] text-[var(--maher-surface)]' : 'border-[var(--maher-border)] text-[var(--maher-text-secondary)] hover:border-[var(--maher-brand)]'}`}
                  >
                    {tc(`returnReason.${r}` as 'returnReason.OTHER')}
                  </button>
                );
              })}
            </div>
          </div>
          <TextArea autoGrow
            label={tc('description')}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            disabled={submitMutation.isPending}
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <CameraCapture
                label={tc('uploadReasonPhoto')}
                disabled={submitMutation.isPending}
                onUploadFile={async (file) => {
                  setReasonPhoto(await uploadPhoto(file, 'RETURN_REASON'));
                }}
              />
              {reasonPhoto ? <Stamp tone="success" size="sm">{tCommon('takePhoto')}</Stamp> : null}
            </div>
            <div className="space-y-1">
              <CameraCapture
                label={tc('uploadIssuePhoto')}
                disabled={submitMutation.isPending}
                onUploadFile={async (file) => {
                  setIssuePhoto(await uploadPhoto(file, 'RETURN_ISSUE'));
                }}
              />
              {issuePhoto ? <Stamp tone="success" size="sm">{tCommon('takePhoto')}</Stamp> : null}
            </div>
          </div>
        </div>
      </Sheet>
    </>
  );
}
