'use client';

import { DealerLineDetails, isNamedDealerSpec } from '@/components/dealer/dealer-line-details';
import { useOrderBasket } from '@/components/order-basket-provider';
import { apiFetch } from '@/lib/api-client';
import { emptyBasketLine, type BasketLine, type BasketOption } from '@/lib/basket';
import { mediaSrc } from '@/lib/media';
import { useRouter } from '@/i18n/navigation';
import { Board, BoardSkeleton, Button, DetailHero, FormFooter, Ledger, LedgerRow, Ltr, Stamp } from '@maher/ui';
import { localizedName } from '@maher/i18n';
import { useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';

type Product = {
  id: string;
  nameEn: string;
  nameAr?: string | null;
  nameHe?: string | null;
  imageUrl?: string | null;
  dealerPrice?: string | number | null;
  width?: string | number | null;
  height?: string | number | null;
  depth?: string | number | null;
  seatHeight?: string | number | null;
};

type Variant = {
  id: string;
  sku?: string | null;
  nameEn?: string | null;
  nameAr?: string | null;
  nameHe?: string | null;
  isDefault?: boolean;
  width?: string | number | null;
  height?: string | number | null;
  depth?: string | number | null;
  seatHeight?: string | number | null;
  dealerPrice?: string | number | null;
  options?: Array<{
    specOptionValueId?: string;
    specOptionValue?: {
      id: string;
      code?: string;
      nameEn?: string;
      nameAr?: string;
      groupId?: string;
      group?: { id: string; code: string };
    };
  }>;
};

function dim(value: string | number | null | undefined): string {
  return value == null ? '' : String(value);
}

function CustomizeForm({ productId }: { productId: string }) {
  const locale = useLocale();
  const tc = useTranslations('catalog');
  const tNav = useTranslations('navigation');
  const tn = useTranslations('mobile.newOrder');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const search = useSearchParams();
  const basket = useOrderBasket();
  const variantId = search.get('variantId') ?? '';
  const qty = search.get('qty') ?? '1';
  const lineId = search.get('lineId') ?? '';

  const productQuery = useQuery({
    queryKey: ['catalog-browse-product', productId],
    queryFn: () => apiFetch<Product>(`/api/v1/catalog/browse/products/${productId}`),
  });
  const variantsQuery = useQuery({
    queryKey: ['catalog-product-variants', productId],
    queryFn: () => apiFetch<Variant[]>(`/api/v1/products/${productId}/variants`),
    retry: false,
  });
  const product = productQuery.data;
  const variant =
    variantsQuery.data?.find((row) => row.id === variantId) ??
    variantsQuery.data?.find((row) => row.isDefault) ??
    variantsQuery.data?.[0];
  const [line, setLine] = useState<BasketLine | null>(null);
  const seeded = useRef('');

  useEffect(() => {
    if (!product || !variant) return;
    if (lineId && !basket.hydrated) return;
    if (lineId) {
      const existing = basket.lines.find((row) => row.id === lineId);
      if (existing) {
        if (seeded.current === lineId) return;
        seeded.current = lineId;
        setLine(existing);
        return;
      }
    }
    const seedKey = lineId ? `missing-${lineId}` : `new-${variant.id}`;
    if (seeded.current === seedKey) return;
    seeded.current = seedKey;
    const options: BasketOption[] = (variant.options ?? []).flatMap((row) => {
      const specOptionValueId = String(row.specOptionValueId ?? row.specOptionValue?.id ?? '');
      if (!specOptionValueId) return [];
      return [
        {
          specOptionValueId,
          groupId: row.specOptionValue?.groupId ?? row.specOptionValue?.group?.id,
          groupCode: row.specOptionValue?.group?.code,
          code: row.specOptionValue?.code,
          nameEn: row.specOptionValue?.nameEn,
          nameAr: row.specOptionValue?.nameAr,
        } satisfies BasketOption,
      ];
    });
    setLine(
      emptyBasketLine({
        productId: product.id,
        customProductName: localizedName(locale, product),
        variantId: variant.id,
        variantSku: variant.sku ?? '',
        variantLabel: localizedName(locale, variant),
        quantity: qty,
        dimWidth: dim(variant.width ?? product.width),
        dimHeight: dim(variant.height ?? product.height),
        dimDepth: dim(variant.depth ?? product.depth),
        dimSeat: dim(variant.seatHeight ?? product.seatHeight),
        imageUrl: product.imageUrl ?? '',
        dealerPrice: variant.dealerPrice != null ? String(variant.dealerPrice) : '',
        options,
        modifiedByDealer: true,
      }),
    );
  }, [product, variant, locale, qty, lineId, basket.hydrated, basket.lines]);

  if (!line || !product) {
    return <p className="text-sm text-text-secondary">{tc('products')}</p>;
  }

  function save() {
    if (!line) return;
    basket.upsertLine({ ...line, modifiedByDealer: true });
    router.push('/dealer/basket');
  }

  const library = line.options.filter((opt) => !isNamedDealerSpec(opt));
  const named = line.options.filter(isNamedDealerSpec);
  const dims = [line.dimWidth, line.dimHeight, line.dimDepth].filter(Boolean).join(' × ');
  const saveLabel = lineId ? tn('saveModifiedToBasket') : tn('addModifiedToBasket');

  return (
    <div className="maher-stagger space-y-5">
      <DetailHero
        tone="warning"
        back={{ label: localizedName(locale, product), onClick: () => router.push(`/dealer/catalog/${productId}`) }}
        title={tNav('customize')}
        subtitle={localizedName(locale, product)}
        status={{ label: tc('basketLineModified'), tone: 'warning' }}
        media={
          product.imageUrl ? (
            <span className="block h-16 w-16 overflow-hidden rounded-[14px] bg-[var(--maher-surface-muted)] sm:h-20 sm:w-20">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={mediaSrc(product.imageUrl) ?? ''} alt="" className="h-full w-full object-cover" />
            </span>
          ) : undefined
        }
        facts={[
          { label: tc('quantity'), value: line.quantity || '1', ltr: true },
          ...(dims ? [{ label: tc('dimensions'), value: `${dims} cm`, ltr: true }] : []),
          ...(library.length + named.length ? [{ label: tc('specs'), value: `${library.length + named.length}` }] : []),
        ]}
        primary={<Button onClick={save}>{saveLabel}</Button>}
      />

      <div className="grid gap-5 xl:grid-cols-12">
        <div className="space-y-5 xl:col-span-8">
          <DealerLineDetails line={line} mode="modify" onChange={setLine} />
          <FormFooter primary={<Button onClick={save}>{saveLabel}</Button>} secondary={<Button variant="ghost" onClick={() => router.push(`/dealer/catalog/${productId}`)}>{tCommon('cancel')}</Button>} dirty={Boolean(line.modifiedByDealer)} />
        </div>
        <div className="xl:col-span-4">
          <Board tone="warning" wash="top" className="xl:sticky xl:top-28">
            <Board.Header title={localizedName(locale, product)} meta={<Stamp tone="warning" size="sm">{tc('basketLineModified')}</Stamp>} />
            <Ledger className="px-5 pb-3">
              <LedgerRow label={tc('quantity')} value={<Ltr>{line.quantity || '1'}</Ltr>} />
              {dims ? <LedgerRow label={tc('dimensions')} value={<Ltr>{dims} cm</Ltr>} /> : null}
              {line.dimSeat ? <LedgerRow label={tc('seatHeight')} value={<Ltr>{line.dimSeat} cm</Ltr>} /> : null}
              {line.customMeasurements.map((row) => (
                <LedgerRow key={row.id} label={row.label} value={<Ltr>{`${row.value} ${row.unit || 'cm'}`}</Ltr>} />
              ))}
              {library.map((opt) => (
                <LedgerRow key={opt.specOptionValueId || opt.code} label={opt.groupCode || tc('specs')} value={locale === 'ar' ? opt.nameAr || opt.nameEn || '—' : opt.nameEn || opt.nameAr || '—'} tone="brand" stamp />
              ))}
              {named.map((opt) => (
                <LedgerRow key={opt.code} label={opt.nameEn || tn('ownSpec')} value={opt.note || '—'} tone="info" stamp />
              ))}
              {line.notes.trim() ? <LedgerRow label={tn('itemNotes')} value={line.notes} /> : null}
            </Ledger>
          </Board>
        </div>
      </div>
    </div>
  );
}

export default function CustomizePage({ params }: { params: { id: string } }) {
  return (
    <Suspense fallback={<BoardSkeleton rows={6} />}>
      <CustomizeForm productId={params.id} />
    </Suspense>
  );
}
