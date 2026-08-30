'use client';

import { InventoryItemThumb } from '@/components/admin/inventory-item-thumb';
import { Link } from '@/i18n/navigation';
import {
  fgLeaveByLabelKey,
  type FinishedOrderGroup,
} from '@/lib/select-finished-orders';
import { Button, Modal, StatusBadge } from '@maher/ui';
import { useLocale, useTranslations } from 'next-intl';

type Props = {
  order: FinishedOrderGroup | null;
  open: boolean;
  onClose: () => void;
};

function productLabel(order: FinishedOrderGroup, locale: string): string {
  if (locale === 'ar') return order.productNameAr || order.productNameEn;
  if (locale === 'he') return order.productNameHe || order.productNameEn;
  return order.productNameEn || order.productNameAr;
}

function dealerLabel(order: FinishedOrderGroup, locale: string): string {
  if (locale === 'ar') return order.dealerNameAr || order.dealerNameEn || '—';
  if (locale === 'he') return order.dealerNameHe || order.dealerNameEn || '—';
  return order.dealerNameEn || order.dealerNameAr || '—';
}

function formatDate(iso: string | null, locale: string): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString(locale, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return iso.slice(0, 10);
  }
}

export function FinishedOrderDetail({ order, open, onClose }: Props) {
  const ti = useTranslations('inventory');
  const tl = useTranslations('lifecycle');
  const tCommon = useTranslations('common');
  const locale = useLocale();

  if (!order) return null;

  const leave = fgLeaveByLabelKey({
    deliveryStatus: order.deliveryStatus,
    deliveryDate: order.deliveryDate,
  });
  const leaveLabel =
    leave.values != null
      ? tl(leave.key as 'overdueByDays', leave.values)
      : tl(leave.key as 'waitingForTruck');

  const byWarehouse = new Map<string, { label: string; packages: number; units: number }>();
  for (const lot of order.lots) {
    const id = lot.warehouse?.id ?? 'unknown';
    const label =
      lot.warehouse?.nameEn || lot.warehouse?.code || id;
    const cur = byWarehouse.get(id) ?? { label, packages: 0, units: 0 };
    const per = Math.max(1, Number(lot.packagesPerUnit) || 1);
    cur.packages += Number(lot.packageCount) || per * (Number(lot.quantity) || 1);
    cur.units += Number(lot.quantity) || 0;
    byWarehouse.set(id, cur);
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={ti('finishedOrderDetail')}
      size="lg"
      footer={
        <Button variant="secondary" onClick={onClose}>
          {tCommon('close')}
        </Button>
      }
    >
      <div className="space-y-5">
        <div className="flex gap-3">
          <InventoryItemThumb
            src={order.productImageUrl}
            alt={productLabel(order, locale)}
            size={72}
          />
          <div className="min-w-0 space-y-1">
            <p className="font-semibold text-text-primary" dir="ltr">
              {order.salesOrderNumber}
            </p>
            <p className="text-sm text-text-primary">
              {order.projectName || productLabel(order, locale)}
            </p>
            <p className="text-xs text-text-secondary">{dealerLabel(order, locale)}</p>
            <p className="text-xs font-medium text-brand">{leaveLabel}</p>
          </div>
        </div>

        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-text-tertiary">{ti('finishedDaysInFinished')}</dt>
            <dd className="font-medium text-text-primary" dir="ltr">
              {order.daysWaiting}
            </dd>
          </div>
          <div>
            <dt className="text-text-tertiary">{ti('finishedEntered')}</dt>
            <dd className="text-text-primary" dir="ltr">
              {formatDate(order.enteredAt, locale)}
            </dd>
          </div>
          {order.leftAt ? (
            <div>
              <dt className="text-text-tertiary">{ti('finishedLeft')}</dt>
              <dd className="text-text-primary" dir="ltr">
                {formatDate(order.leftAt, locale)}
              </dd>
            </div>
          ) : null}
          {order.loadTotal > 0 ? (
            <div>
              <dt className="text-text-tertiary">{ti('finishedLoadPrep')}</dt>
              <dd className="font-medium text-text-primary" dir="ltr">
                {ti('finishedLoadProgress', {
                  checked: order.loadChecked,
                  total: order.loadTotal,
                })}
              </dd>
            </div>
          ) : null}
          {order.deliveryStatus ? (
            <div>
              <dt className="text-text-tertiary">{ti('delivery')}</dt>
              <dd className="flex flex-wrap items-center gap-2">
                {order.deliveryNumber ? (
                  <span dir="ltr" className="text-text-secondary">
                    {order.deliveryNumber}
                  </span>
                ) : null}
                <StatusBadge status={order.deliveryStatus} />
              </dd>
            </div>
          ) : null}
        </dl>

        {order.productionOrderNumbers.length ? (
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-text-tertiary">
              {ti('productionOrder')}
            </p>
            <p className="text-sm text-text-primary" dir="ltr">
              {order.productionOrderNumbers.join(', ')}
            </p>
          </div>
        ) : null}

        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-text-tertiary">
            {ti('finishedPackagesByWarehouse')}
          </p>
          {byWarehouse.size === 0 ? (
            <p className="text-sm text-text-secondary">{ti('finishedPackagesEmpty')}</p>
          ) : (
            <ul className="space-y-2">
              {[...byWarehouse.entries()].map(([id, row]) => (
                <li
                  key={id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--maher-border)] px-3 py-2 text-sm"
                >
                  <span className="text-text-primary">
                    {row.label}
                    {order.multiWarehouse && byWarehouse.size > 1 ? (
                      <span className="ms-2 text-[11px] text-amber-700 dark:text-amber-400">
                        {ti('finishedMultiWarehouseSignal')}
                      </span>
                    ) : null}
                  </span>
                  <span className="text-text-secondary" dir="ltr">
                    {ti('finishedPackagesCount', { count: row.packages })} ·{' '}
                    {ti('lotQty')}: {row.units}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {order.pieceLabels.length ? (
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-text-tertiary">
              {ti('finishedPackagesSection')}
            </p>
            <ul className="space-y-1 text-sm text-text-secondary">
              {order.pieceLabels.map((p, i) => (
                <li key={`${p.nameEn}-${i}`}>
                  {locale === 'ar'
                    ? p.nameAr || p.nameEn
                    : locale === 'he'
                      ? p.nameHe || p.nameEn
                      : p.nameEn || p.nameAr}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {order.deliveryId ? (
            <Link href={`/deliveries/${order.deliveryId}`}>
              <Button size="sm">{ti('finishedViewDelivery')}</Button>
            </Link>
          ) : null}
          {order.salesOrderId && !order.salesOrderId.startsWith('lot:') ? (
            <Link href={`/sales-orders/${order.salesOrderId}`}>
              <Button size="sm" variant="secondary">
                {tl('viewOrder')}
              </Button>
            </Link>
          ) : null}
        </div>
      </div>
    </Modal>
  );
}
