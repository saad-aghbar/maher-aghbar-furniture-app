'use client';

import { ListPage } from '@/components/list-page';
import { apiFetch, apiUpload, ApiClientError } from '@/lib/api-client';
import { mutationErrorMessage } from '@/hooks/use-api-mutation';
import {
  Alert,
  Button,
  ImageSourceField,
  Input,
  Modal,
  Select,
  TextArea,
} from '@maher/ui';
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

  const [formOpen, setFormOpen] = useState(false);
  const [salesOrderId, setSalesOrderId] = useState('');
  const [productDesc, setProductDesc] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [reason, setReason] = useState<string>(RETURN_REASONS[0]);
  const [description, setDescription] = useState('');
  const [reasonPhoto, setReasonPhoto] = useState('');
  const [issuePhoto, setIssuePhoto] = useState('');
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

  function resetForm() {
    setSalesOrderId('');
    setProductDesc('');
    setQuantity('1');
    setReason(RETURN_REASONS[0]);
    setDescription('');
    setReasonPhoto('');
    setIssuePhoto('');
    setFormError(null);
  }

  function onSelectOrder(id: string) {
    setSalesOrderId(id);
    const order = orders.find((o) => o.id === id);
    const line = order?.lines?.[0];
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

  return (
    <div className="space-y-4">
      {banner ? <Alert variant="success">{banner}</Alert> : null}
      <ListPage<ReturnRow>
        title={t('returns')}
        description={tc('returnsDescription')}
        queryKey={['customer-returns']}
        fetchPath="/api/v1/returns?pageSize=50"
        emptyTitle={tc('noReturns')}
        actions={
          <Button leadingIcon={<Plus className="h-4 w-4" />} onClick={() => setFormOpen(true)}>
            {tc('submitReturn')}
          </Button>
        }
        columns={[
          {
            key: 'number',
            header: tCommon('number'),
            render: (row) => <span className="font-medium">{row.number}</span>,
          },
          {
            key: 'productDesc',
            header: tc('product'),
            render: (row) => row.productDesc,
          },
          {
            key: 'quantity',
            header: tc('quantity'),
            render: (row) => String(row.quantity),
          },
          {
            key: 'reason',
            header: tc('reason'),
            render: (row) => {
              try {
                return tc(`returnReason.${row.reason}` as 'returnReason.OTHER');
              } catch {
                return row.reason;
              }
            },
          },
          {
            key: 'approvalStatus',
            header: tCommon('status'),
            render: (row) => row.approvalStatus ?? 'PENDING',
          },
          {
            key: 'salesOrder',
            header: tc('salesOrder'),
            render: (row) => row.salesOrder?.number ?? '—',
          },
        ]}
      />

      <Modal
        open={formOpen}
        onClose={() => !submitMutation.isPending && setFormOpen(false)}
        title={tc('submitReturn')}
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
        <div className="maher-form-section grid gap-3">
          {formError ? <Alert variant="error">{formError}</Alert> : null}

          <Select
            label={tc('selectSalesOrder')}
            value={salesOrderId}
            onChange={(e) => onSelectOrder(e.target.value)}
            disabled={submitMutation.isPending || ordersQuery.isLoading}
          >
            <option value="">{tc('selectSalesOrderPlaceholder')}</option>
            {orders.map((o) => (
              <option key={o.id} value={o.id}>
                {o.number}
                {o.lines?.[0]?.description ? ` — ${o.lines[0].description}` : ''}
              </option>
            ))}
          </Select>

          <Input
            label={tc('product')}
            value={productDesc}
            onChange={(e) => setProductDesc(e.target.value)}
            disabled={submitMutation.isPending}
          />
          <Input
            label={tc('quantity')}
            type="number"
            min="0.001"
            step="0.001"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            dir="ltr"
            disabled={submitMutation.isPending}
          />
          <Select
            label={tc('reason')}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={submitMutation.isPending}
          >
            {RETURN_REASONS.map((r) => (
              <option key={r} value={r}>
                {tc(`returnReason.${r}` as 'returnReason.OTHER')}
              </option>
            ))}
          </Select>
          <TextArea
            label={tc('description')}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            disabled={submitMutation.isPending}
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <ImageSourceField
              label={tc('uploadReasonPhoto')}
              value={reasonPhoto}
              onChange={setReasonPhoto}
              hint={tCommon('photoUrlHint')}
              uploadLabel={tCommon('uploadFromDevice')}
              uploadingLabel={tCommon('uploading')}
              disabled={submitMutation.isPending}
              onUploadFile={(file) => uploadPhoto(file, 'RETURN_REASON')}
            />
            <ImageSourceField
              label={tc('uploadIssuePhoto')}
              value={issuePhoto}
              onChange={setIssuePhoto}
              hint={tCommon('photoUrlHint')}
              uploadLabel={tCommon('uploadFromDevice')}
              uploadingLabel={tCommon('uploading')}
              disabled={submitMutation.isPending}
              onUploadFile={(file) => uploadPhoto(file, 'RETURN_ISSUE')}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
