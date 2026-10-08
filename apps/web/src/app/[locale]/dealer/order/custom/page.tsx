'use client';

import { DealerLineDetails, isNamedDealerSpec } from '@/components/dealer/dealer-line-details';
import { useOrderBasket } from '@/components/order-basket-provider';
import { emptyBasketLine, type BasketLine } from '@/lib/basket';
import { useRouter } from '@/i18n/navigation';
import { Alert, Board, BoardSkeleton, Button, FormFooter, Ledger, LedgerRow, Ltr, Stamp } from '@maher/ui';
import { Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';

function CustomItemForm() {
  const tc = useTranslations('catalog');
  const tn = useTranslations('mobile.newOrder');
  const tNav = useTranslations('navigation');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const search = useSearchParams();
  const lineId = search.get('lineId') ?? '';
  const basket = useOrderBasket();
  const [line, setLine] = useState<BasketLine>(() => emptyBasketLine());
  const [error, setError] = useState<string | null>(null);
  const seeded = useRef(false);

  useEffect(() => {
    if (!lineId || !basket.hydrated || seeded.current) return;
    const existing = basket.lines.find((row) => row.id === lineId);
    seeded.current = true;
    if (existing) setLine({ ...existing, productId: '', imageUrl: '' });
  }, [basket.hydrated, basket.lines, lineId]);

  function save() {
    const name = line.customProductName.trim();
    if (!name) {
      setError(tn('customNameRequired'));
      return;
    }
    if (!line.photoDocumentIds.filter(Boolean).length) {
      setError(tn('customPhotoRequired'));
      return;
    }
    setError(null);
    basket.upsertLine({
      ...line,
      id: lineId || line.id,
      productId: '',
      dealerPrice: '',
      imageUrl: '',
      customProductName: name,
      primaryImageDocumentId: line.photoDocumentIds.find(Boolean) ?? '',
    });
    router.push('/dealer/basket');
  }

  const named = line.options.filter(isNamedDealerSpec);
  const library = line.options.filter((opt) => !isNamedDealerSpec(opt));
  const dims = [line.dimWidth, line.dimHeight, line.dimDepth].filter(Boolean).join(' × ');
  const saveLabel = lineId ? tn('saveCustomToBasket') : tn('addCustomToBasket');
  const canSave = line.customProductName.trim().length > 0 && line.photoDocumentIds.some(Boolean);

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
              <p className="mt-1 max-w-[56ch] text-[14px] leading-5 text-[var(--maher-text-secondary)]">{tn('customItemHint')}</p>
            </div>
          </div>
          <Stamp tone="info" size="sm">{tc('basketLineCustom')}</Stamp>
        </div>
      </Board>
      {error ? <Alert variant="error">{error}</Alert> : null}

      <div className="grid gap-5 xl:grid-cols-12">
        <div className="space-y-5 xl:col-span-8">
          <DealerLineDetails line={line} mode="custom" onChange={setLine} />
          <FormFooter
            primary={<Button onClick={save} disabled={!canSave}>{saveLabel}</Button>}
            secondary={<Button variant="ghost" onClick={() => router.push('/dealer/catalog')}>{tCommon('cancel')}</Button>}
          />
        </div>
        <div className="xl:col-span-4">
          <Board tone="info" className="xl:sticky xl:top-28">
            <Board.Header title={line.customProductName.trim() || tNav('customItem')} meta={<Stamp tone="info" size="sm">{tc('basketLineCustom')}</Stamp>} />
            <Ledger className="px-5 pb-3">
              <LedgerRow label={tc('quantity')} value={<Ltr>{line.quantity || '1'}</Ltr>} />
              <LedgerRow label={tn('waitingForFactoryPrice')} value={tn('waitingForFactoryPrice')} tone="warning" stamp />
              {dims ? <LedgerRow label={tc('dimensions')} value={<Ltr>{dims} cm</Ltr>} /> : null}
              {line.dimSeat ? <LedgerRow label={tc('seatHeight')} value={<Ltr>{line.dimSeat} cm</Ltr>} /> : null}
              {line.customMeasurements.map((row) => (
                <LedgerRow key={row.id} label={row.label} value={<Ltr>{`${row.value} ${row.unit || 'cm'}`}</Ltr>} />
              ))}
              {library.map((opt) => (
                <LedgerRow key={opt.specOptionValueId || opt.code} label={opt.groupCode || tc('specs')} value={opt.nameEn || '—'} tone="brand" stamp />
              ))}
              {named.map((opt) => (
                <LedgerRow key={opt.code} label={opt.nameEn || tn('ownSpec')} value={opt.note || '—'} tone="info" stamp />
              ))}
              <LedgerRow label={tn('customPhotos')} value={<Ltr>{line.photoDocumentIds.filter(Boolean).length}</Ltr>} tone={line.photoDocumentIds.some(Boolean) ? 'success' : 'warning'} stamp />
              {line.notes.trim() ? <LedgerRow label={tn('itemNotes')} value={line.notes} /> : null}
            </Ledger>
          </Board>
        </div>
      </div>
    </div>
  );
}

export default function CustomItemPage() {
  return (
    <Suspense fallback={<BoardSkeleton rows={6} />}>
      <CustomItemForm />
    </Suspense>
  );
}
