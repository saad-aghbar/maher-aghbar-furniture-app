'use client';

import { BackButton } from '@/components/back-button';
import { useOrderBasket } from '@/components/order-basket-provider';
import { apiFetch } from '@/lib/api-client';
import { emptyBasketLine, type BasketLine, type BasketOption } from '@/lib/basket';
import { mediaSrc } from '@/lib/media';
import { useRouter } from '@/i18n/navigation';
import { Button, Card, Input, PageHero, Select } from '@maher/ui';
import { localizedName } from '@maher/i18n';
import { useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useState } from 'react';

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

type SpecGroup = { id: string; code: string; nameEn: string; nameAr?: string; nameHe?: string | null };
type SpecValue = {
  id: string;
  groupId: string;
  code: string;
  nameEn: string;
  nameAr?: string;
  nameHe?: string | null;
};

function dim(value: string | number | null | undefined): string {
  return value == null ? '' : String(value);
}

function CustomizeForm({ productId }: { productId: string }) {
  const locale = useLocale();
  const tc = useTranslations('catalog');
  const tNav = useTranslations('navigation');
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
  const groupsQuery = useQuery({
    queryKey: ['spec-option-groups'],
    queryFn: () =>
      apiFetch<{ data: SpecGroup[] }>('/api/v1/spec-option-groups?pageSize=100').then((r) => r.data ?? []),
    retry: false,
  });
  const valuesQuery = useQuery({
    queryKey: ['spec-option-values'],
    queryFn: () =>
      apiFetch<{ data: SpecValue[] }>('/api/v1/spec-option-values?pageSize=200').then((r) => r.data ?? []),
    retry: false,
  });

  const product = productQuery.data;
  const variant =
    variantsQuery.data?.find((row) => row.id === variantId) ??
    variantsQuery.data?.find((row) => row.isDefault) ??
    variantsQuery.data?.[0];
  const [line, setLine] = useState<BasketLine | null>(null);

  useEffect(() => {
    if (!product || !variant) return;
    if (lineId) {
      const existing = basket.lines.find((row) => row.id === lineId);
      if (existing) {
        setLine(existing);
        return;
      }
    }
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
  }, [product, variant, locale, qty, lineId, basket.lines]);

  const groups = groupsQuery.data ?? [];
  const values = valuesQuery.data ?? [];
  const grouped = useMemo(() => {
    return groups.map((group) => ({
      group,
      values: values.filter((v) => v.groupId === group.id),
    }));
  }, [groups, values]);

  if (!line || !product) {
    return <p className="text-sm text-text-secondary">{tc('products')}</p>;
  }

  function setOption(group: SpecGroup, valueId: string) {
    const value = values.find((v) => v.id === valueId) ?? null;
    setLine((prev) => {
      if (!prev) return prev;
      const options = prev.options.filter((opt) => opt.groupId !== group.id && opt.groupCode !== group.code);
      if (value) {
        options.push({
          specOptionValueId: value.id,
          groupId: group.id,
          groupCode: group.code,
          code: value.code,
          nameEn: value.nameEn,
          nameAr: value.nameAr,
        });
      }
      return { ...prev, options, modifiedByDealer: true };
    });
  }

  function save() {
    if (!line) return;
    basket.upsertLine({ ...line, modifiedByDealer: true });
    router.push('/basket');
  }

  return (
    <div className="space-y-6">
      <BackButton fallbackHref={`/catalog/${productId}`} />
      <PageHero tone="soft" title={tNav('customize')} description={localizedName(locale, product)} />
      <Card className="space-y-4">
        {product.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={mediaSrc(product.imageUrl) ?? ''} alt="" className="h-28 w-28 rounded-xl object-cover" />
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            label={tc('dimWidth')}
            value={line.dimWidth}
            onChange={(e) => setLine({ ...line, dimWidth: e.target.value, modifiedByDealer: true })}
            dir="ltr"
          />
          <Input
            label={tc('dimHeight')}
            value={line.dimHeight}
            onChange={(e) => setLine({ ...line, dimHeight: e.target.value, modifiedByDealer: true })}
            dir="ltr"
          />
          <Input
            label={tc('dimDepth')}
            value={line.dimDepth}
            onChange={(e) => setLine({ ...line, dimDepth: e.target.value, modifiedByDealer: true })}
            dir="ltr"
          />
          <Input
            label={tc('seatHeight')}
            value={line.dimSeat}
            onChange={(e) => setLine({ ...line, dimSeat: e.target.value, modifiedByDealer: true })}
            dir="ltr"
          />
          <Input
            label={tc('quantity')}
            value={line.quantity}
            onChange={(e) => setLine({ ...line, quantity: e.target.value })}
            dir="ltr"
          />
        </div>
        {grouped.map(({ group, values: opts }) =>
          opts.length ? (
            <Select
              key={group.id}
              label={localizedName(locale, group)}
              value={line.options.find((o) => o.groupId === group.id || o.groupCode === group.code)?.specOptionValueId ?? ''}
              onChange={(e) => setOption(group, e.target.value)}
            >
              <option value="">{tc('emptyValue')}</option>
              {opts.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {localizedName(locale, opt)}
                </option>
              ))}
            </Select>
          ) : null,
        )}
        <Button onClick={save}>{tc('addToBasket')}</Button>
      </Card>
    </div>
  );
}

export default function CustomizePage({ params }: { params: { id: string } }) {
  return (
    <Suspense fallback={<p>…</p>}>
      <CustomizeForm productId={params.id} />
    </Suspense>
  );
}
