'use client';

import { Link } from '@/i18n/navigation';
import { mutationErrorMessage } from '@/hooks/use-api-mutation';
import { apiFetch } from '@/lib/api-client';
import { useKitCopy } from '@/lib/kit-copy';
import {
  Board,
  BoardSkeleton,
  Button,
  DetailHero,
  ErrorBoard,
  FormFooter,
  FormSection,
  Input,
  KeyFacts,
  Ltr,
  MoneyField,
  NumberField,
  TextArea,
  useToast,
} from '@maher/ui';
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
  material?: string | null;
  width?: number | string | null;
  height?: number | string | null;
  depth?: number | string | null;
  manufacturingComplexity?: string | null;
};

type RequestDetail = { id: string; number: string; status: string; items: RequestItem[] };
type QuoteLine = { id: string; description: string; quantity: number | string; unitPrice: number | string; material?: string | null; fabric?: string | null; color?: string | null; width?: number | string | null; height?: number | string | null; depth?: number | string | null; manufacturingComplexity?: string | null };
type QuotationDetail = { id: string; number: string; status: string; currency?: string | null; lines?: QuoteLine[] };

/**
 * FactoryLineDesk — one request item or quotation line on its own desk:
 * the spec facts, the editable fields, and a save bar.
 */
export function FactoryLineDesk({ mode, parentId, lineId }: { mode: 'rfq' | 'quote'; parentId: string; lineId: string }) {
  const t = useTranslations('catalog');
  const tCommon = useTranslations('common');
  const tSales = useTranslations('sales');
  const tq = useTranslations('quotations');
  const kit = useKitCopy();
  const toast = useToast();
  const qc = useQueryClient();
  const [productName, setProductName] = useState('');
  const [quantity, setQuantity] = useState<number | null>(1);
  const [notes, setNotes] = useState('');
  const [unitPrice, setUnitPrice] = useState<number | null>(null);

  const requestQuery = useQuery({ enabled: mode === 'rfq', queryKey: ['admin-rfq', parentId], queryFn: () => apiFetch<RequestDetail>(`/api/v1/requests/${parentId}`) });
  const quoteQuery = useQuery({ enabled: mode === 'quote', queryKey: ['quotation', parentId], queryFn: () => apiFetch<QuotationDetail>(`/api/v1/quotations/${parentId}`) });

  const requestItem = requestQuery.data?.items.find((item) => item.id === lineId);
  const quoteLine = quoteQuery.data?.lines?.find((line) => line.id === lineId);

  useEffect(() => {
    if (requestItem) {
      setProductName(requestItem.productName);
      setQuantity(Number(requestItem.quantity) || 1);
      setNotes(requestItem.notes ?? '');
    }
  }, [requestItem]);
  useEffect(() => {
    if (quoteLine) {
      setProductName(quoteLine.description);
      setQuantity(Number(quoteLine.quantity) || 1);
      setUnitPrice(Number(quoteLine.unitPrice) > 0 ? Number(quoteLine.unitPrice) : null);
    }
  }, [quoteLine]);

  const saveRequest = useMutation({
    mutationFn: async () => {
      const items = (requestQuery.data?.items ?? []).map((item) => ({
        productName: item.id === lineId ? productName.trim() || item.productName : item.productName,
        quantity: item.id === lineId ? quantity ?? 1 : Number(item.quantity) || 1,
        notes: item.id === lineId ? notes.trim() || undefined : item.notes ?? undefined,
        fabric: item.fabric ?? undefined,
        color: item.color ?? undefined,
        width: item.width ?? undefined,
        height: item.height ?? undefined,
        depth: item.depth ?? undefined,
      }));
      return apiFetch(`/api/v1/requests/${parentId}`, { method: 'PATCH', body: JSON.stringify({ items }) });
    },
    onSuccess: async () => {
      toast.success(tCommon('saved'));
      await qc.invalidateQueries({ queryKey: ['admin-rfq', parentId] });
    },
    onError: (err) => toast.error(mutationErrorMessage(err)),
  });
  const saveQuote = useMutation({
    mutationFn: async () => {
      const lines = (quoteQuery.data?.lines ?? []).map((line) => ({
        description: line.id === lineId ? productName.trim() || line.description : line.description,
        quantity: line.id === lineId ? quantity ?? 1 : Number(line.quantity) || 1,
        unitPrice: line.id === lineId ? unitPrice ?? 0 : Number(line.unitPrice) || 0,
      }));
      return apiFetch(`/api/v1/quotations/${parentId}`, { method: 'PATCH', body: JSON.stringify({ lines }) });
    },
    onSuccess: async () => {
      toast.success(tCommon('saved'));
      await qc.invalidateQueries({ queryKey: ['quotation', parentId] });
    },
    onError: (err) => toast.error(mutationErrorMessage(err)),
  });

  const loading = mode === 'rfq' ? requestQuery.isLoading : quoteQuery.isLoading;
  const failed = mode === 'rfq' ? requestQuery.isError : quoteQuery.isError;
  const missing = mode === 'rfq' ? !requestItem : !quoteLine;
  const parentNumber = mode === 'rfq' ? requestQuery.data?.number : quoteQuery.data?.number;
  const backHref = mode === 'rfq' ? `/admin/requests/${parentId}` : `/admin/quotations/${parentId}`;

  if (loading) {
    return (
      <div className="space-y-5">
        <BoardSkeleton rows={1} header={false} className="h-40" />
        <BoardSkeleton rows={4} />
      </div>
    );
  }
  if (failed || missing) return <ErrorBoard title={t('lineItems')} onRetry={() => (mode === 'rfq' ? requestQuery.refetch() : quoteQuery.refetch())} />;

  const spec = (mode === 'rfq' ? requestItem : quoteLine) as RequestItem | QuoteLine;
  const dims = [spec.width, spec.height, spec.depth].filter((v) => v != null && v !== '').join(' × ');
  const editable = mode === 'rfq' ? requestQuery.data?.status === 'DRAFT' || requestQuery.data?.status === 'SUBMITTED' || requestQuery.data?.status === 'UNDER_REVIEW' : quoteQuery.data?.status === 'DRAFT';
  const original = mode === 'rfq' ? { name: requestItem!.productName, qty: Number(requestItem!.quantity) || 1, notes: requestItem!.notes ?? '' } : { name: quoteLine!.description, qty: Number(quoteLine!.quantity) || 1, price: Number(quoteLine!.unitPrice) > 0 ? Number(quoteLine!.unitPrice) : null };
  const dirty = productName !== original.name || (quantity ?? 1) !== original.qty || (mode === 'rfq' ? notes !== (original as { notes: string }).notes : unitPrice !== (original as { price: number | null }).price);
  const currency = (mode === 'quote' && quoteQuery.data?.currency) || 'ILS';

  return (
    <div className="maher-stagger space-y-5">
      <DetailHero
        LinkComponent={Link}
        back={{ label: parentNumber ?? t('lineItems'), href: backHref }}
        code={parentNumber}
        title={productName || t('lineItems')}
        subtitle={mode === 'rfq' ? tSales('desk.lineDeskHintRfq') : tSales('desk.lineDeskHintQuote')}
        facts={[
          { label: t('qty'), value: String(original.qty), ltr: true },
          ...(dims ? [{ label: t('dims'), value: `${dims} cm`, ltr: true }] : []),
          ...(spec.fabric ? [{ label: t('fabric'), value: `${spec.fabric}${spec.color ? ` / ${spec.color}` : ''}` }] : []),
          ...(spec.material ? [{ label: tSales('material'), value: spec.material }] : []),
          ...(mode === 'quote' ? [{ label: t('unitPrice'), value: original && 'price' in original && original.price != null ? `${original.price.toFixed(2)} ${currency}` : tq('priceRequired'), ltr: true }] : []),
        ]}
      />

      <FormSection title={t('lineItems')} description={editable ? undefined : tSales('desk.lineLocked')} columns={2}>
        <Input label={t('product')} value={productName} onChange={(e) => setProductName(e.target.value)} disabled={!editable} className="md:col-span-2" />
        <NumberField label={t('qty')} value={quantity} onChange={setQuantity} min={1} disabled={!editable} />
        {mode === 'quote' ? (
          <MoneyField label={t('unitPrice')} currency={currency} value={unitPrice} onChange={setUnitPrice} min={0} disabled={!editable} />
        ) : (
          <TextArea autoGrow label={t('notes')} value={notes} onChange={(e) => setNotes(e.target.value)} disabled={!editable} className="md:col-span-2" rows={3} />
        )}
      </FormSection>

      <Board tone="neutral">
        <Board.Header title={t('specs')} />
        <Board.Body>
          <KeyFacts
            columns={3}
            facts={[
              { label: t('width'), value: spec.width != null && spec.width !== '' ? String(spec.width) : '—', ltr: true },
              { label: t('height'), value: spec.height != null && spec.height !== '' ? String(spec.height) : '—', ltr: true },
              { label: t('depth'), value: spec.depth != null && spec.depth !== '' ? String(spec.depth) : '—', ltr: true },
              { label: t('fabric'), value: spec.fabric ?? '—' },
              { label: t('color'), value: spec.color ?? '—' },
              { label: tSales('material'), value: spec.material ?? '—' },
            ]}
          />
        </Board.Body>
      </Board>

      {editable ? (
        <FormFooter
          dirty={dirty}
          dirtyLabel={kit.unsaved}
          primary={
            <Button onClick={() => (mode === 'rfq' ? saveRequest.mutate() : saveQuote.mutate())} loading={saveRequest.isPending || saveQuote.isPending} disabled={!dirty}>
              {tCommon('save')}
            </Button>
          }
          secondary={
            <Link href={backHref} className="maher-press inline-flex h-10 items-center rounded-[10px] px-4 text-sm font-medium text-[var(--maher-text-secondary)] hover:bg-[var(--maher-surface-muted)]">
              {tCommon('cancel')}
            </Link>
          }
        />
      ) : null}
      <Ltr className="sr-only">{lineId}</Ltr>
    </div>
  );
}
