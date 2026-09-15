'use client';

import { BackButton } from '@/components/back-button';
import { useOrderBasket } from '@/components/order-basket-provider';
import { basketLineKind, lineHasProduct } from '@/lib/basket';
import { mediaSrc, moneyLabel } from '@/lib/media';
import { Link, useRouter } from '@/i18n/navigation';
import { Button, Card, EmptyState, PageHero } from '@maher/ui';
import { Armchair } from 'lucide-react';
import { useTranslations } from 'next-intl';

export default function BasketPage() {
  const t = useTranslations('navigation');
  const tc = useTranslations('catalog');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const basket = useOrderBasket();
  const lines = basket.lines.filter(lineHasProduct);

  return (
    <div className="space-y-6">
      <BackButton fallbackHref="/catalog" />
      <PageHero
        tone="soft"
        title={t('basket')}
        description={tc('basketEmptyHint')}
        actions={
          <Button variant="secondary" onClick={() => router.push('/order/custom')}>
            {t('customItem')}
          </Button>
        }
      />

      {lines.length === 0 ? (
        <EmptyState
          title={tc('basketEmpty')}
          description={tc('basketEmptyHint')}
          action={
            <Button onClick={() => router.push('/catalog')}>{t('catalog')}</Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {lines.map((line) => {
            const kind = basketLineKind(line);
            const kindLabel =
              kind === 'custom'
                ? tc('basketLineCustom')
                : kind === 'customized'
                  ? tc('basketLineModified')
                  : tc('basketLineStandard');
            const img = mediaSrc(line.imageUrl);
            return (
              <Card key={line.id} className="flex gap-4">
                <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-[var(--maher-surface-muted)]">
                  {img ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={img} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-text-tertiary">
                      <Armchair className="h-6 w-6 opacity-40" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="font-medium text-text-primary">
                    {line.customProductName || line.variantLabel || line.productId}
                  </p>
                  <p className="text-xs text-text-secondary">
                    {kindLabel}
                    {line.variantLabel ? ` · ${line.variantLabel}` : ''}
                    {` · ${line.quantity}`}
                  </p>
                  <p className="text-sm" dir="ltr">
                    {moneyLabel(line.dealerPrice, tCommon('currency'))}
                  </p>
                  {line.fabrics[0]?.type ? (
                    <p className="text-xs text-text-secondary">{line.fabrics[0].type}</p>
                  ) : null}
                </div>
                <div className="flex flex-col items-end gap-2">
                  {line.productId ? (
                    <Link
                      href={`/catalog/${line.productId}/customize?variantId=${line.variantId}&qty=${line.quantity}&lineId=${line.id}`}
                      className="text-xs text-brand hover:underline"
                    >
                      {tCommon('edit')}
                    </Link>
                  ) : null}
                  <button
                    type="button"
                    className="text-xs text-[var(--maher-error)] hover:underline"
                    onClick={() => basket.removeLine(line.id)}
                  >
                    {tc('removeFromBasket')}
                  </button>
                </div>
              </Card>
            );
          })}
          <Button className="w-full" onClick={() => router.push('/orders/new')}>
            {tc('continueToOrder')}
          </Button>
        </div>
      )}
    </div>
  );
}
