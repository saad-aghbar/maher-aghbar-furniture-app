'use client';

import { useDealerMoney } from '@/components/dealer/catalog-shared';
import { useOrderBasket } from '@/components/order-basket-provider';
import { apiFetch } from '@/lib/api-client';
import { mediaSrc } from '@/lib/media';
import { Link, useRouter } from '@/i18n/navigation';
import { ActionDock, Board, BoardSkeleton, Button, ErrorBoard, Figure, Ledger, LedgerRow, Ltr, NumberField, Stamp, useToast } from '@maher/ui';
import { localizedName } from '@maher/i18n';
import { useQuery } from '@tanstack/react-query';
import { Armchair, ArrowLeft, ShoppingCart, SlidersHorizontal } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';

type BrowseProduct = {
  id: string;
  sku: string;
  nameEn: string;
  nameAr?: string | null;
  nameHe?: string | null;
  description?: string | null;
  imageUrl?: string | null;
  galleryUrls?: string[];
  dealerPrice?: string | number | null;
  price?: string | number | null;
  width?: string | number | null;
  height?: string | number | null;
  depth?: string | number | null;
  seatHeight?: string | number | null;
  category?: { nameEn: string; nameAr?: string | null; nameHe?: string | null } | null;
};

type ProductVariant = {
  id: string;
  sku?: string | null;
  code?: string | null;
  nameEn?: string | null;
  nameAr?: string | null;
  nameHe?: string | null;
  isDefault?: boolean;
  width?: string | number | null;
  height?: string | number | null;
  depth?: string | number | null;
  seatHeight?: string | number | null;
  dealerPrice?: string | number | null;
  price?: string | number | null;
};

function dim(value: string | number | null | undefined): string {
  if (value == null || value === '') return '';
  return String(value);
}

export default function CatalogProductPage({ params }: { params: { id: string } }) {
  const locale = useLocale();
  const t = useTranslations('navigation');
  const tc = useTranslations('catalog');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const basket = useOrderBasket();
  const toast = useToast();
  const money = useDealerMoney();
  const [qty, setQty] = useState(1);
  const [variantId, setVariantId] = useState<string | null>(null);
  const [heroIndex, setHeroIndex] = useState(0);

  const productQuery = useQuery({ queryKey: ['catalog-browse-product', params.id], queryFn: () => apiFetch<BrowseProduct>(`/api/v1/catalog/browse/products/${params.id}`) });
  const variantsQuery = useQuery({ queryKey: ['catalog-product-variants', params.id], queryFn: () => apiFetch<ProductVariant[]>(`/api/v1/products/${params.id}/variants`), retry: false });

  const product = productQuery.data;
  const variants = variantsQuery.data ?? [];
  const selected = variants.find((row) => row.id === variantId) ?? variants.find((row) => row.isDefault) ?? variants[0] ?? null;
  const title = product ? localizedName(locale, product) : '';
  const priceRaw = selected?.dealerPrice ?? selected?.price ?? product?.dealerPrice ?? product?.price;
  const price = priceRaw != null && Number.isFinite(Number(priceRaw)) ? Number(priceRaw) : null;
  const gallery = useMemo(() => {
    const urls = [product?.imageUrl, ...(product?.galleryUrls ?? [])].filter(Boolean) as string[];
    return [...new Set(urls)].map((u) => mediaSrc(u)).filter(Boolean) as string[];
  }, [product]);
  const hero = gallery[Math.min(heroIndex, Math.max(0, gallery.length - 1))] ?? null;

  const specs = useMemo(() => {
    if (!product) return [];
    const rows: Array<{ key: string; label: string; value: string }> = [
      { key: 'w', label: tc('width'), value: dim(selected?.width ?? product.width) },
      { key: 'h', label: tc('height'), value: dim(selected?.height ?? product.height) },
      { key: 'd', label: tc('depth'), value: dim(selected?.depth ?? product.depth) },
      { key: 's', label: tc('seatHeight'), value: dim(selected?.seatHeight ?? product.seatHeight) },
    ];
    return rows.filter((r) => r.value);
  }, [product, selected, tc]);

  function addToBasket() {
    if (!product) return;
    basket.addFromCatalog({
      productId: product.id,
      quantity: String(qty || 1),
      customProductName: title,
      variantId: selected?.id,
      variantSku: selected?.sku ?? undefined,
      variantLabel: selected ? localizedName(locale, selected) : undefined,
      dimWidth: dim(selected?.width ?? product.width),
      dimHeight: dim(selected?.height ?? product.height),
      dimDepth: dim(selected?.depth ?? product.depth),
      dimSeat: dim(selected?.seatHeight ?? product.seatHeight),
      imageUrl: product.imageUrl ?? undefined,
      dealerPrice: price != null ? String(price) : undefined,
    });
    toast.toast({ tone: 'success', title: tc('addedToBasket'), description: title, action: { label: tc('viewBasket'), onClick: () => router.push('/dealer/basket') } });
  }

  if (productQuery.isLoading && !product) {
    return (
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <BoardSkeleton rows={6} />
        <BoardSkeleton rows={5} />
      </div>
    );
  }
  if (!product) {
    return <ErrorBoard title={t('catalog')} description={tCommon('loadFailed')} onRetry={() => productQuery.refetch()} retryLabel={tCommon('retry')} />;
  }

  return (
    <div className="maher-stagger space-y-5 pb-24 md:pb-0">
      <Link href="/dealer/catalog" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[var(--maher-text-secondary)] hover:text-[var(--maher-brand)]">
        <ArrowLeft className="h-4 w-4 rtl:-scale-x-100" />
        {t('catalog')}
      </Link>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <Board tone="neutral" className="self-start overflow-hidden">
          <div className="relative aspect-[4/3] bg-[var(--maher-surface-muted)]">
            {hero ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={hero} src={hero} alt={title} className="maher-fade-in h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-[var(--maher-text-tertiary)]">
                <Armchair className="h-12 w-12 opacity-40" />
              </div>
            )}
            {product.category ? (
              <span className="absolute start-3 top-3">
                <Stamp tone="brand" size="sm">{localizedName(locale, product.category)}</Stamp>
              </span>
            ) : null}
          </div>
          {gallery.length > 1 ? (
            <div className="flex gap-2 overflow-x-auto p-3">
              {gallery.map((src, i) => (
                <button
                  key={src}
                  type="button"
                  onClick={() => setHeroIndex(i)}
                  aria-label={`${tc('photos')} ${i + 1}`}
                  aria-pressed={i === heroIndex}
                  className={`h-16 w-16 shrink-0 overflow-hidden rounded-[10px] border-2 transition ${i === heroIndex ? 'border-[var(--maher-text-primary)]' : 'border-transparent opacity-80 hover:opacity-100'}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          ) : null}
        </Board>

        <div className="space-y-5">
          <Board tone="brand" wash="top">
            <div className="px-5 pt-5 sm:px-6">
              <Ltr className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--maher-text-tertiary)]">{product.sku}</Ltr>
              <h1 className="mt-1 text-[24px] font-semibold leading-8 tracking-[-0.02em] text-[var(--maher-text-primary)] sm:text-[28px] sm:leading-9 rtl:tracking-normal">{title}</h1>
              {product.description ? <p className="mt-2 text-[14px] leading-6 text-[var(--maher-text-secondary)]">{product.description}</p> : null}
            </div>
            <Board.Body className="space-y-4">
              <Figure size="lg" value={money(price)} label={selected ? localizedName(locale, selected) || tc('standardVariant') : tc('price')} locale={locale} />
              {variants.length > 1 ? (
                <div>
                  <p className="mb-1.5 text-[12px] font-medium text-[var(--maher-text-secondary)]">{tc('variants')}</p>
                  <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={tc('variants')}>
                    {variants.map((row) => {
                      const active = (selected?.id ?? '') === row.id;
                      const rowPrice = row.dealerPrice ?? row.price;
                      return (
                        <button
                          key={row.id}
                          type="button"
                          role="radio"
                          aria-checked={active}
                          onClick={() => setVariantId(row.id)}
                          className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-[13px] font-medium transition ${
                            active ? 'border-[var(--maher-text-primary)] bg-[var(--maher-text-primary)] text-[var(--maher-surface)]' : 'border-[var(--maher-border)] text-[var(--maher-text-secondary)] hover:border-[var(--maher-brand)]'
                          }`}
                        >
                          {localizedName(locale, row) || row.sku || tc('standardVariant')}
                          {rowPrice != null ? <Ltr className={active ? 'opacity-80' : 'text-[var(--maher-text-tertiary)]'}>{money(Number(rowPrice))}</Ltr> : null}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}
              <div className="grid gap-3 sm:grid-cols-[10rem_minmax(0,1fr)] sm:items-end">
                <NumberField label={tc('quantity')} value={qty} onChange={(v) => setQty(Math.max(1, Math.round(v ?? 1)))} min={1} step={1} decimals={0} />
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button className="flex-1" leadingIcon={<ShoppingCart className="h-4 w-4" />} onClick={() => addToBasket()}>
                    {tc('addToBasket')}
                  </Button>
                  {selected ? (
                    <Button variant="secondary" className="flex-1" leadingIcon={<SlidersHorizontal className="h-4 w-4" />} onClick={() => router.push(`/dealer/catalog/${product.id}/customize?variantId=${selected.id}&qty=${qty}`)}>
                      {tc('customizeProduct')}
                    </Button>
                  ) : null}
                </div>
              </div>
            </Board.Body>
          </Board>

          {specs.length ? (
            <Board tone="neutral">
              <Board.Header title={tc('dimensions')} />
              <Ledger className="px-5 pb-2">
                {specs.map((row) => (
                  <LedgerRow key={row.key} label={row.label} value={<Ltr>{row.value}</Ltr>} />
                ))}
              </Ledger>
            </Board>
          ) : null}
        </div>
      </div>

      <ActionDock className="md:hidden" note={<Ltr className="font-semibold">{money(price)}</Ltr>}>
        <Button className="flex-1" leadingIcon={<ShoppingCart className="h-4 w-4" />} onClick={() => addToBasket()}>
          {tc('addToBasket')}
        </Button>
      </ActionDock>
    </div>
  );
}
