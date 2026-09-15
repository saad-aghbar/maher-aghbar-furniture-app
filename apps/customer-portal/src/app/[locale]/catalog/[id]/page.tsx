'use client';

import { BackButton } from '@/components/back-button';
import { useOrderBasket } from '@/components/order-basket-provider';
import { apiFetch } from '@/lib/api-client';
import { mediaSrc, moneyLabel } from '@/lib/media';
import { Link, useRouter } from '@/i18n/navigation';
import {
  Alert,
  Button,
  Card,
  NumberStepper,
  PageHero,
  Skeleton,
} from '@maher/ui';
import { localizedName } from '@maher/i18n';
import { useQuery } from '@tanstack/react-query';
import { Armchair } from 'lucide-react';
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
  const [qty, setQty] = useState('1');
  const [variantId, setVariantId] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);

  const productQuery = useQuery({
    queryKey: ['catalog-browse-product', params.id],
    queryFn: () => apiFetch<BrowseProduct>(`/api/v1/catalog/browse/products/${params.id}`),
  });

  const variantsQuery = useQuery({
    queryKey: ['catalog-product-variants', params.id],
    queryFn: () => apiFetch<ProductVariant[]>(`/api/v1/products/${params.id}/variants`),
    retry: false,
  });

  const product = productQuery.data;
  const variants = variantsQuery.data ?? [];
  const selected =
    variants.find((row) => row.id === variantId) ??
    variants.find((row) => row.isDefault) ??
    variants[0] ??
    null;

  const title = product ? localizedName(locale, product) : '';
  const price = selected?.dealerPrice ?? selected?.price ?? product?.dealerPrice ?? product?.price;
  const image = mediaSrc(selected ? undefined : product?.imageUrl) ?? mediaSrc(product?.imageUrl);
  const gallery = useMemo(() => {
    const urls = [product?.imageUrl, ...(product?.galleryUrls ?? [])].filter(Boolean) as string[];
    return [...new Set(urls)].map((u) => mediaSrc(u)).filter(Boolean) as string[];
  }, [product]);

  function addToBasket(preferUpdate = true) {
    if (!product) return;
    basket.addFromCatalog({
      productId: product.id,
      quantity: qty || '1',
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
      preferUpdate,
    });
    setBanner(tc('addedToBasket'));
  }

  if (productQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-40" />
        <Skeleton className="aspect-[4/3] w-full max-w-xl rounded-xl" />
      </div>
    );
  }

  if (!product) {
    return (
      <div>
        <BackButton fallbackHref="/catalog" />
        <Alert variant="error">{tCommon('loadFailed')}</Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <BackButton fallbackHref="/catalog" />
      <PageHero tone="soft" title={title} description={product.sku} />
      {banner ? <Alert>{banner}</Alert> : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <Card padded={false} className="overflow-hidden">
          {image || gallery[0] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={gallery[0] ?? image ?? ''}
              alt={title}
              className="aspect-[4/3] w-full object-cover"
            />
          ) : (
            <div className="flex aspect-[4/3] items-center justify-center bg-[var(--maher-surface-muted)] text-text-tertiary">
              <Armchair className="h-12 w-8 opacity-40" />
            </div>
          )}
          {gallery.length > 1 ? (
            <div className="flex gap-2 p-3">
              {gallery.map((src) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={src} src={src} alt="" className="h-16 w-16 rounded-lg object-cover" />
              ))}
            </div>
          ) : null}
        </Card>

        <div className="space-y-4">
          <Card>
            <div className="space-y-4">
              {product.category ? (
                <p className="text-sm text-text-secondary">{localizedName(locale, product.category)}</p>
              ) : null}
              <p className="text-2xl font-medium text-text-primary" dir="ltr">
                {moneyLabel(price, tCommon('currency'))}
              </p>
              {product.description ? (
                <p className="text-sm text-text-secondary">{product.description}</p>
              ) : null}
              {variants.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {variants.map((row) => {
                    const active = (selected?.id ?? '') === row.id;
                    return (
                      <button
                        key={row.id}
                        type="button"
                        onClick={() => setVariantId(row.id)}
                        className={`rounded-[var(--maher-radius-lg)] border px-3 py-2 text-sm ${
                          active
                            ? 'border-brand bg-brand-soft text-brand'
                            : 'border-border text-text-secondary'
                        }`}
                      >
                        {localizedName(locale, row) || row.sku || tc('standardVariant')}
                      </button>
                    );
                  })}
                </div>
              ) : null}
              <div className="max-w-[12rem]">
                <NumberStepper
                  label={tc('quantity')}
                  value={qty}
                  min={1}
                  onChange={setQty}
                />
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button className="flex-1" onClick={() => addToBasket(true)}>
                  {tc('addToBasket')}
                </Button>
                {selected ? (
                  <Button
                    variant="secondary"
                    className="flex-1"
                    onClick={() =>
                      router.push(
                        `/catalog/${product.id}/customize?variantId=${selected.id}&qty=${qty}`,
                      )
                    }
                  >
                    {tc('customizeProduct')}
                  </Button>
                ) : null}
              </div>
              <Link href="/basket" className="text-sm font-medium text-brand hover:underline">
                {tc('viewBasket')}
              </Link>
            </div>
          </Card>
          <p className="text-xs text-text-tertiary" dir="ltr">
            SKU {product.sku}
          </p>
        </div>
      </div>
    </div>
  );
}
