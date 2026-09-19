'use client';

import { PageHeader } from '@/components/admin/page-header';
import { apiFetch } from '@/lib/api-client';
import { mutationErrorMessage } from '@/hooks/use-api-mutation';
import { Alert, Button, ErrorState, FloorBoard, Input, Skeleton, TextArea } from '@maher/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

type RequestItem = {
  id: string;
  productName: string;
  quantity: number | string;
  notes?: string | null;
  fabric?: string | null;
  color?: string | null;
  width?: number | string | null;
  height?: number | string | null;
  depth?: number | string | null;
};

type RequestDetail = {
  id: string;
  number: string;
  items: RequestItem[];
};

type QuoteLine = {
  id: string;
  description: string;
  quantity: number | string;
  unitPrice: number | string;
};

type QuotationDetail = {
  id: string;
  number: string;
  lines?: QuoteLine[];
};

export function FactoryLineDesk({
  mode,
  parentId,
  lineId,
}: {
  mode: 'rfq' | 'quote';
  parentId: string;
  lineId: string;
}) {
  const t = useTranslations('catalog');
  const tCommon = useTranslations('common');
  const qc = useQueryClient();
  const [productName, setProductName] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [notes, setNotes] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const requestQuery = useQuery({
    enabled: mode === 'rfq',
    queryKey: ['admin-rfq', parentId],
    queryFn: () => apiFetch<RequestDetail>(`/api/v1/requests/${parentId}`),
  });
  const quoteQuery = useQuery({
    enabled: mode === 'quote',
    queryKey: ['quotation', parentId],
    queryFn: () => apiFetch<QuotationDetail>(`/api/v1/quotations/${parentId}`),
  });

  const requestItem = requestQuery.data?.items.find((item) => item.id === lineId);
  const quoteLine = quoteQuery.data?.lines?.find((line) => line.id === lineId);

  useEffect(() => {
    if (requestItem) {
      setProductName(requestItem.productName);
      setQuantity(String(requestItem.quantity ?? '1'));
      setNotes(requestItem.notes ?? '');
    }
  }, [requestItem]);

  useEffect(() => {
    if (quoteLine) {
      setProductName(quoteLine.description);
      setQuantity(String(quoteLine.quantity ?? '1'));
      setUnitPrice(String(quoteLine.unitPrice ?? ''));
    }
  }, [quoteLine]);

  const saveRequest = useMutation({
    mutationFn: async () => {
      const items = (requestQuery.data?.items ?? []).map((item) =>
        item.id === lineId
          ? {
              productName: productName.trim() || item.productName,
              quantity: Number(quantity) || 1,
              notes: notes.trim() || undefined,
              fabric: item.fabric ?? undefined,
              color: item.color ?? undefined,
              width: item.width ?? undefined,
              height: item.height ?? undefined,
              depth: item.depth ?? undefined,
            }
          : {
              productName: item.productName,
              quantity: Number(item.quantity) || 1,
              notes: item.notes ?? undefined,
              fabric: item.fabric ?? undefined,
              color: item.color ?? undefined,
              width: item.width ?? undefined,
              height: item.height ?? undefined,
              depth: item.depth ?? undefined,
            },
      );
      return apiFetch(`/api/v1/requests/${parentId}`, {
        method: 'PATCH',
        body: JSON.stringify({ items }),
      });
    },
    onSuccess: async () => {
      setError(null);
      setMessage(tCommon('saved'));
      await qc.invalidateQueries({ queryKey: ['admin-rfq', parentId] });
    },
    onError: (err) => setError(mutationErrorMessage(err)),
  });

  const saveQuote = useMutation({
    mutationFn: async () => {
      const lines = (quoteQuery.data?.lines ?? []).map((line) =>
        line.id === lineId
          ? {
              description: productName.trim() || line.description,
              quantity: Number(quantity) || 1,
              unitPrice: Number(unitPrice) || 0,
            }
          : {
              description: line.description,
              quantity: Number(line.quantity) || 1,
              unitPrice: Number(line.unitPrice) || 0,
            },
      );
      return apiFetch(`/api/v1/quotations/${parentId}`, {
        method: 'PATCH',
        body: JSON.stringify({ lines }),
      });
    },
    onSuccess: async () => {
      setError(null);
      setMessage(tCommon('saved'));
      await qc.invalidateQueries({ queryKey: ['quotation', parentId] });
    },
    onError: (err) => setError(mutationErrorMessage(err)),
  });

  const loading = mode === 'rfq' ? requestQuery.isLoading : quoteQuery.isLoading;
  const failed = mode === 'rfq' ? requestQuery.isError : quoteQuery.isError;
  const missing = mode === 'rfq' ? !requestItem : !quoteLine;
  const title =
    mode === 'rfq'
      ? (requestQuery.data?.number ?? t('lineItems'))
      : (quoteQuery.data?.number ?? t('lineItems'));
  const backHref = mode === 'rfq' ? `/admin/requests/${parentId}` : `/admin/quotations/${parentId}`;

  if (loading) return <Skeleton className="h-48 w-full" />;
  if (failed || missing) {
    return (
      <ErrorState
        title={t('lineItems')}
        onRetry={() => (mode === 'rfq' ? requestQuery.refetch() : quoteQuery.refetch())}
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader backHref={backHref} title={title} description={productName} />
      {message ? <Alert variant="success">{message}</Alert> : null}
      {error ? <Alert variant="error">{error}</Alert> : null}
      <FloorBoard header={t('lineItems')}>
        <div className="space-y-4">
          <Input label={t('product')} value={productName} onChange={(e) => setProductName(e.target.value)} />
          <Input
            label={t('qty')}
            type="number"
            min="1"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
          {mode === 'quote' ? (
            <Input
              label={t('unitPrice')}
              type="number"
              min="0"
              value={unitPrice}
              onChange={(e) => setUnitPrice(e.target.value)}
            />
          ) : (
            <TextArea label={t('notes')} value={notes} onChange={(e) => setNotes(e.target.value)} />
          )}
          <Button
            onClick={() => (mode === 'rfq' ? saveRequest.mutate() : saveQuote.mutate())}
            loading={saveRequest.isPending || saveQuote.isPending}
          >
            {tCommon('save')}
          </Button>
        </div>
      </FloorBoard>
    </div>
  );
}
