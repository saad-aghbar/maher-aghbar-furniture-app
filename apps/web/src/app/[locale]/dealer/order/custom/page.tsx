'use client';

import { BackButton } from '@/components/back-button';
import { useOrderBasket } from '@/components/order-basket-provider';
import { apiUpload } from '@/lib/api-client';
import { emptyBasketLine } from '@/lib/basket';
import { useRouter } from '@/i18n/navigation';
import { Alert, Button, CameraCapture, Card, Input, PageHero } from '@maher/ui';
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

  return (
    <div className="space-y-6">
      <BackButton fallbackHref="/dealer/catalog" />
      <PageHero tone="soft" title={tNav('customItem')} description={tc('customItemHint')} />
      {error ? <Alert variant="error">{error}</Alert> : null}
      <Card className="space-y-4">
        <Input label={tc('name')} value={name} onChange={(e) => setName(e.target.value)} required />
        <div className="grid gap-3 sm:grid-cols-2">
          <Input label={tc('quantity')} value={qty} onChange={(e) => setQty(e.target.value)} dir="ltr" />
          <Input label={tc('dimWidth')} value={width} onChange={(e) => setWidth(e.target.value)} dir="ltr" />
          <Input label={tc('dimHeight')} value={height} onChange={(e) => setHeight(e.target.value)} dir="ltr" />
          <Input label={tc('dimDepth')} value={depth} onChange={(e) => setDepth(e.target.value)} dir="ltr" />
        </div>
        <Input label={tc('notes')} value={notes} onChange={(e) => setNotes(e.target.value)} />
        <CameraCapture
          label={tCommon('takePhoto')}
          onUploadFile={onUpload}
          hint={tc('photosRequired')}
        />
        {photoIds.length ? (
          <p className="text-xs text-text-secondary" dir="ltr">
            {photoIds.length}
          </p>
        ) : null}
        <Button onClick={save} loading={busy}>
          {tc('addToBasket')}
        </Button>
      </Card>
    </div>
  );
}
