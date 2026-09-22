'use client';

import { useOrderBasket } from '@/components/order-basket-provider';
import { apiUpload } from '@/lib/api-client';
import { emptyBasketLine } from '@/lib/basket';
import { useRouter } from '@/i18n/navigation';
import { Alert, Board, Button, CameraCapture, FormFooter, FormSection, Input, Ledger, LedgerRow, Ltr, NumberField, Stamp, TextArea } from '@maher/ui';
import { Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

export default function CustomItemPage() {
  const tc = useTranslations('catalog');
  const tNav = useTranslations('navigation');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const basket = useOrderBasket();
  const [name, setName] = useState('');
  const [qty, setQty] = useState('1');
  const [width, setWidth] = useState('');
  const [height, setHeight] = useState('');
  const [depth, setDepth] = useState('');
  const [notes, setNotes] = useState('');
  const [photoIds, setPhotoIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onUpload(file: File) {
    const form = new FormData();
    form.append('file', file);
    const res = await apiUpload<{ document: { id: string } }>('/api/v1/uploads?category=ORDER_IMAGE', form);
    setPhotoIds((prev) => [...prev, res.document.id]);
  }

  function save() {
    if (!name.trim()) {
      setError(tc('customerProductRequired'));
      return;
    }
    if (!photoIds.length) {
      setError(tc('photosRequired'));
      return;
    }
    setBusy(true);
    basket.upsertLine(
      emptyBasketLine({
        customProductName: name.trim(),
        quantity: qty || '1',
        dimWidth: width,
        dimHeight: height,
        dimDepth: depth,
        notes,
        photoDocumentIds: photoIds,
        primaryImageDocumentId: photoIds[0] ?? '',
      }),
    );
    router.push('/dealer/basket');
  }

  const dims = [width, height, depth].filter(Boolean).join(' × ');
  const canSave = name.trim().length > 0 && photoIds.length > 0 && !busy;

  return (
    <div className="maher-stagger space-y-5">
      <Board tone="info" wash="top" as="section">
        <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-5 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] bg-[var(--maher-info-soft)] text-[var(--maher-info)]">
              <Sparkles className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h1 className="text-[24px] font-semibold leading-8 tracking-[-0.02em] text-[var(--maher-text-primary)] sm:text-[28px] sm:leading-9 rtl:tracking-normal">{tNav('customItem')}</h1>
              <p className="mt-1 max-w-[56ch] text-[14px] leading-5 text-[var(--maher-text-secondary)]">{tc('customItemHint')}</p>
            </div>
          </div>
          <Stamp tone="info" size="sm">{tc('basketLineCustom')}</Stamp>
        </div>
      </Board>
      {error ? <Alert variant="error">{error}</Alert> : null}

      <div className="grid gap-5 xl:grid-cols-12">
        <div className="space-y-5 xl:col-span-8">
          <FormSection title={tc('name')} columns={1} tone={name.trim() ? 'success' : 'info'}>
            <Input label={tc('name')} value={name} onChange={(e) => setName(e.target.value)} required />
            <TextArea label={tc('notes')} value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </FormSection>
          <FormSection title={tc('dimensions')} columns={2}>
            <NumberField label={tc('quantity')} value={Number(qty) || 1} onChange={(v) => setQty(String(Math.max(1, Math.round(v ?? 1))))} min={1} step={1} decimals={0} />
            <NumberField label={tc('dimWidth')} unit="cm" value={width === '' ? null : Number(width)} onChange={(v) => setWidth(v == null ? '' : String(v))} min={0} />
            <NumberField label={tc('dimHeight')} unit="cm" value={height === '' ? null : Number(height)} onChange={(v) => setHeight(v == null ? '' : String(v))} min={0} />
            <NumberField label={tc('dimDepth')} unit="cm" value={depth === '' ? null : Number(depth)} onChange={(v) => setDepth(v == null ? '' : String(v))} min={0} />
          </FormSection>
          <FormSection title={tCommon('takePhoto')} description={tc('photosRequired')} columns={1} tone={photoIds.length ? 'success' : 'warning'} meta={<Stamp tone={photoIds.length ? 'success' : 'warning'} size="sm">{photoIds.length}</Stamp>}>
            <CameraCapture label={tCommon('takePhoto')} onUploadFile={onUpload} hint={tc('photosRequired')} />
          </FormSection>
          <FormFooter primary={<Button onClick={save} loading={busy} disabled={!canSave}>{tc('addToBasket')}</Button>} secondary={<Button variant="ghost" onClick={() => router.push('/dealer/catalog')}>{tCommon('cancel')}</Button>} />
        </div>
        <div className="xl:col-span-4">
          <Board tone="info" className="xl:sticky xl:top-28">
            <Board.Header title={name.trim() || tNav('customItem')} meta={<Stamp tone="info" size="sm">{tc('basketLineCustom')}</Stamp>} />
            <Ledger className="px-5 pb-3">
              <LedgerRow label={tc('quantity')} value={<Ltr>{qty || '1'}</Ltr>} />
              {dims ? <LedgerRow label={tc('dimensions')} value={<Ltr>{dims} cm</Ltr>} /> : null}
              <LedgerRow label={tCommon('takePhoto')} value={<Ltr>{photoIds.length}</Ltr>} tone={photoIds.length ? 'success' : 'warning'} stamp />
            </Ledger>
          </Board>
        </div>
      </div>
    </div>
  );
}
