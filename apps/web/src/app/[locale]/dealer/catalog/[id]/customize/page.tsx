'use client';

import { useOrderBasket } from '@/components/order-basket-provider';
import { apiFetch } from '@/lib/api-client';
import { emptyBasketLine, type BasketLine, type BasketOption } from '@/lib/basket';
import { mediaSrc } from '@/lib/media';
import { useRouter } from '@/i18n/navigation';
import { Board, BoardSkeleton, Button, Combobox, DetailHero, FormFooter, FormSection, Ledger, LedgerRow, Ltr, NumberField, Stamp } from '@maher/ui';
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
    router.push('/dealer/basket');
  }

  const chosen = grouped
    .map(({ group, values: opts }) => {
      const picked = line.options.find((o) => o.groupId === group.id || o.groupCode === group.code);
      const value = opts.find((v) => v.id === picked?.specOptionValueId);
      return value ? { key: group.id, label: localizedName(locale, group), value: localizedName(locale, value) } : null;
    })
    .filter(Boolean) as Array<{ key: string; label: string; value: string }>;
  const dims = [line.dimWidth, line.dimHeight, line.dimDepth].filter(Boolean).join(' × ');
  const num = (v: string) => (v === '' ? null : Number(v));
  const str = (v: number | null) => (v == null ? '' : String(v));

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
          ...(chosen.length ? [{ label: tc('variants'), value: `${chosen.length}` }] : []),
        ]}
        primary={<Button onClick={save}>{tc('addToBasket')}</Button>}
      />

      <div className="grid gap-5 xl:grid-cols-12">
        <div className="space-y-5 xl:col-span-8">
          <FormSection title={tc('dimensions')} columns={3}>
            <NumberField label={tc('dimWidth')} unit="cm" value={num(line.dimWidth)} onChange={(v) => setLine({ ...line, dimWidth: str(v), modifiedByDealer: true })} min={0} />
            <NumberField label={tc('dimHeight')} unit="cm" value={num(line.dimHeight)} onChange={(v) => setLine({ ...line, dimHeight: str(v), modifiedByDealer: true })} min={0} />
            <NumberField label={tc('dimDepth')} unit="cm" value={num(line.dimDepth)} onChange={(v) => setLine({ ...line, dimDepth: str(v), modifiedByDealer: true })} min={0} />
            <NumberField label={tc('seatHeight')} unit="cm" value={num(line.dimSeat)} onChange={(v) => setLine({ ...line, dimSeat: str(v), modifiedByDealer: true })} min={0} />
            <NumberField label={tc('quantity')} value={num(line.quantity) ?? 1} onChange={(v) => setLine({ ...line, quantity: String(Math.max(1, Math.round(v ?? 1))) })} min={1} step={1} decimals={0} />
          </FormSection>
          {grouped.some(({ values: opts }) => opts.length) ? (
            <FormSection title={tc('variants')} columns={2}>
              {grouped.map(({ group, values: opts }) =>
                opts.length ? (
                  <Combobox<string>
                    key={group.id}
                    label={localizedName(locale, group)}
                    value={line.options.find((o) => o.groupId === group.id || o.groupCode === group.code)?.specOptionValueId ?? null}
                    onChange={(value) => setOption(group, value ?? '')}
                    placeholder={tc('emptyValue')}
                    clearable
                    options={opts.map((opt) => ({ value: opt.id, label: localizedName(locale, opt) }))}
                  />
                ) : null,
              )}
            </FormSection>
          ) : null}
          <FormFooter primary={<Button onClick={save}>{tc('addToBasket')}</Button>} secondary={<Button variant="ghost" onClick={() => router.push(`/dealer/catalog/${productId}`)}>{tCommon('cancel')}</Button>} dirty={Boolean(line.modifiedByDealer)} />
        </div>
        <div className="xl:col-span-4">
          <Board tone="warning" wash="top" className="xl:sticky xl:top-28">
            <Board.Header title={localizedName(locale, product)} meta={<Stamp tone="warning" size="sm">{tc('basketLineModified')}</Stamp>} />
            <Ledger className="px-5 pb-3">
              <LedgerRow label={tc('quantity')} value={<Ltr>{line.quantity || '1'}</Ltr>} />
              {dims ? <LedgerRow label={tc('dimensions')} value={<Ltr>{dims} cm</Ltr>} /> : null}
              {line.dimSeat ? <LedgerRow label={tc('seatHeight')} value={<Ltr>{line.dimSeat} cm</Ltr>} /> : null}
              {chosen.map((c) => (
                <LedgerRow key={c.key} label={c.label} value={c.value} tone="brand" stamp />
              ))}
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
