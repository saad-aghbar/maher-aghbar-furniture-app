'use client';

import { ConfirmDialog } from '@/components/admin/confirm-dialog';
import { BasketLinePhoto } from '@/components/dealer/dealer-line-details';
import { useDealerMoney } from '@/components/dealer/catalog-shared';
import { useOrderBasket } from '@/components/order-basket-provider';
import { basketLineKind, lineHasProduct } from '@/lib/basket';
import { useRouter } from '@/i18n/navigation';
import { ActionDock, Board, Button, Figure, Ledger, LedgerRow, Ltr, Menu, NumberField, Stamp } from '@maher/ui';
import { MoreHorizontal, Pencil, Sparkles, Trash2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';

export default function BasketPage() {
  const t = useTranslations('navigation');
  const tc = useTranslations('catalog');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const router = useRouter();
  const basket = useOrderBasket();
  const money = useDealerMoney();
  const [clearing, setClearing] = useState(false);
  const lines = basket.lines.filter(lineHasProduct);

  const priced = lines.filter((l) => Number.isFinite(Number(l.dealerPrice)) && Number(l.dealerPrice) > 0);
  const unpriced = lines.length - priced.length;
  const subtotal = priced.reduce((acc, l) => acc + Number(l.dealerPrice) * Math.max(1, Number(l.quantity) || 1), 0);
  const pieces = lines.reduce((acc, l) => acc + Math.max(1, Number(l.quantity) || 1), 0);

  return (
    <div className="maher-stagger space-y-5 pb-24 md:pb-0">
      <Board tone="brand" wash="top" as="section">
        <div className="grid gap-5 px-5 py-5 sm:px-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-[24px] font-semibold leading-8 tracking-[-0.02em] text-[var(--maher-text-primary)] sm:text-[28px] sm:leading-9 rtl:tracking-normal">{t('basket')}</h1>
              <p className="mt-1 max-w-[56ch] text-[14px] leading-5 text-[var(--maher-text-secondary)]">{tc('basketEmptyHint')}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" leadingIcon={<Sparkles className="h-4 w-4" />} onClick={() => router.push('/dealer/order/custom')}>
                {t('customItem')}
              </Button>
              {lines.length ? (
                <Button variant="ghost" leadingIcon={<Trash2 className="h-4 w-4" />} onClick={() => setClearing(true)}>
                  {tc('clearBasket')}
                </Button>
              ) : null}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-5 lg:min-w-[20rem]">
            <Figure size="sm" value={lines.length} label={tc('lines')} />
            <Figure size="sm" value={pieces} label={tc('quantity')} tone="info" />
            <Figure size="sm" value={money(subtotal)} label={tc('estimatedTotal')} tone="success" locale={locale} />
          </div>
        </div>
      </Board>

      {lines.length === 0 ? (
        <Board tone="neutral">
          <Board.Empty title={tc('basketEmpty')} description={tc('basketEmptyHint')} action={<Button size="sm" onClick={() => router.push('/dealer/catalog')}>{t('catalog')}</Button>} />
        </Board>
      ) : (
        <div className="grid gap-5 xl:grid-cols-12">
          <ul className="maher-stagger space-y-3 xl:col-span-8">
            {lines.map((line) => {
              const kind = basketLineKind(line);
              const kindLabel = kind === 'custom' ? tc('basketLineCustom') : kind === 'customized' ? tc('basketLineModified') : tc('basketLineStandard');
              const qty = Math.max(1, Number(line.quantity) || 1);
              const unit = Number(line.dealerPrice);
              const dims = [line.dimWidth, line.dimHeight, line.dimDepth].filter(Boolean).join(' × ');
              return (
                <Board key={line.id} as="li" tone={kind === 'custom' ? 'info' : kind === 'customized' ? 'warning' : 'brand'}>
                  <div className="flex gap-4 px-4 py-4 sm:px-5">
                    <div className="h-20 w-20 shrink-0 overflow-hidden rounded-[12px] bg-[var(--maher-surface-muted)] sm:h-24 sm:w-24">
                      <BasketLinePhoto line={line} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-[15px] font-semibold text-[var(--maher-text-primary)]">{line.customProductName || line.variantLabel || line.productId}</p>
                          <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[12px] text-[var(--maher-text-tertiary)]">
                            <Stamp tone={kind === 'custom' ? 'info' : kind === 'customized' ? 'warning' : 'neutral'} size="sm">{kindLabel}</Stamp>
                            {line.variantLabel ? <span>{line.variantLabel}</span> : null}
                            {dims ? <Ltr>{dims} cm</Ltr> : null}
                            {line.notes.trim() ? <span className="max-w-[24ch] truncate">{line.notes}</span> : null}
                            {line.fabrics[0]?.type ? <span>{line.fabrics[0].type}</span> : null}
                          </p>
                        </div>
                        <Menu
                          aria-label={tCommon('actions')}
                          trigger={<Button size="sm" variant="ghost" aria-label={tCommon('actions')}><MoreHorizontal className="h-4 w-4" /></Button>}
                          items={[
                            { id: 'edit', label: tCommon('edit'), icon: <Pencil className="h-4 w-4" />, onSelect: () => router.push(line.productId ? `/dealer/catalog/${line.productId}/customize?variantId=${line.variantId}&qty=${line.quantity}&lineId=${line.id}` : `/dealer/order/custom?lineId=${line.id}`) },
                            { id: 'remove', label: tc('removeFromBasket'), icon: <Trash2 className="h-4 w-4" />, tone: 'error' as const, separator: true, onSelect: () => basket.removeLine(line.id) },
                          ]}
                        />
                      </div>
                      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
                        <div className="w-32">
                          <NumberField aria-label={tc('quantity')} value={qty} onChange={(v) => basket.patchLine(line.id, { quantity: String(Math.max(1, Math.round(v ?? 1))) })} min={1} step={1} decimals={0} />
                        </div>
                        <div className="text-end">
                          <Ltr className="block text-[16px] font-semibold text-[var(--maher-text-primary)]">{Number.isFinite(unit) && unit > 0 ? money(unit * qty) : '—'}</Ltr>
                          {Number.isFinite(unit) && unit > 0 && qty > 1 ? <Ltr className="block text-[12px] text-[var(--maher-text-tertiary)]">{`${qty} × ${money(unit)}`}</Ltr> : null}
                        </div>
                      </div>
                    </div>
                  </div>
                </Board>
              );
            })}
          </ul>

          <div className="xl:col-span-4">
            <Board tone="success" wash="top" className="xl:sticky xl:top-28">
              <Board.Header title={tc('estimatedTotal')} description={tc('estimatedTotalHint')} />
              <Board.Body className="space-y-4">
                <Figure size="lg" value={money(subtotal)} label={tc('subtotal')} tone="success" locale={locale} />
                <Ledger>
                  <LedgerRow label={tc('lines')} value={<Ltr>{lines.length}</Ltr>} />
                  <LedgerRow label={tc('quantity')} value={<Ltr>{pieces}</Ltr>} />
                  {unpriced ? <LedgerRow label={tc('basketLineCustom')} value={<Ltr>{unpriced}</Ltr>} tone="info" stamp /> : null}
                </Ledger>
              </Board.Body>
              <Board.Footer>
                <Button className="w-full" onClick={() => router.push('/dealer/orders/new')}>
                  {tc('continueToOrder')}
                </Button>
              </Board.Footer>
            </Board>
          </div>
        </div>
      )}

      {lines.length ? (
        <ActionDock className="md:hidden" note={<Ltr className="font-semibold">{money(subtotal)}</Ltr>}>
          <Button className="flex-1" onClick={() => router.push('/dealer/orders/new')}>
            {tc('continueToOrder')}
          </Button>
        </ActionDock>
      ) : null}

      <ConfirmDialog
        open={clearing}
        title={tc('clearBasket')}
        description={tc('clearBasketConfirm')}
        confirmLabel={tc('clearBasket')}
        danger
        onClose={() => setClearing(false)}
        onConfirm={() => {
          basket.clear();
          setClearing(false);
        }}
      />
    </div>
  );
}
