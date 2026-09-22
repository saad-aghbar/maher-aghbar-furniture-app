'use client';

import { Link } from '@/i18n/navigation';
import type { AuthUser } from '@maher/types';
import { can } from '@maher/permissions';
import { Board, Figure, Ledger, LedgerRow, Ribbon, Skeleton, Stamp } from '@maher/ui';
import { AlertTriangle, Boxes, ClipboardList, PackageCheck, RotateCcw, type LucideIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { ArrowUpRight } from 'lucide-react';

export type InventoryOverview = {
  rawMaterials: { itemCount: number; lowStockCount: number };
  semiFinished: { itemCount: number; totalQty: number };
  finishedGoods: { availableQty: number; reservedQty: number };
};

/** Warehouse persona: stock ledger, finished-goods split, and the inventory actions they hold. */
export function WarehouseStaffDashboard({
  firstName,
  overview,
  loading,
  user,
}: {
  firstName: string | null;
  overview?: InventoryOverview;
  loading: boolean;
  user?: AuthUser;
}) {
  const t = useTranslations('navigation');
  const tCommon = useTranslations('common');
  const lowStock = overview?.rawMaterials.lowStockCount ?? 0;
  const available = overview?.finishedGoods.availableQty ?? 0;
  const reserved = overview?.finishedGoods.reservedQty ?? 0;

  const actions: Array<{ href: string; label: string; icon: LucideIcon; show: boolean }> = [
    { href: '/admin/inventory', label: t('inventory'), icon: Boxes, show: can(user, 'inventory.read') },
    { href: '/admin/inventory/receive', label: tCommon('receiveStock'), icon: PackageCheck, show: can(user, 'inventory.receive') },
    { href: '/admin/inventory/low-stock', label: t('lowStock'), icon: AlertTriangle, show: can(user, 'inventory.read') },
    { href: '/admin/inventory', label: tCommon('transferStock'), icon: RotateCcw, show: can(user, 'inventory.transfer') },
    { href: '/admin/inventory', label: tCommon('stockCount'), icon: ClipboardList, show: can(user, 'inventory.count') },
  ].filter((a) => a.show);

  return (
    <div className="maher-stagger space-y-5 pb-8">
      <Board tone={lowStock > 0 ? 'warning' : 'success'} wash="top" as="section">
        <div className="grid gap-6 px-5 py-5 sm:px-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:items-start">
          <div className="min-w-0">
            <p className="text-[13px] leading-5 text-[var(--maher-text-secondary)]">{tCommon('deskWarehouseHint')}</p>
            <h1 className="mt-1 text-[26px] font-semibold leading-8 tracking-[-0.02em] text-[var(--maher-text-primary)] sm:text-[30px] sm:leading-9">
              {firstName
                ? tCommon('dashboardGreetingNamed', { name: firstName })
                : tCommon('dashboardGreeting')}
            </h1>
            <div className="mt-5 flex items-start gap-3">
              <Stamp tone={lowStock > 0 ? 'warning' : 'success'} className="mt-[7px]" />
              <div>
                <p className="text-[15px] font-semibold leading-6 text-[var(--maher-text-primary)]">
                  {lowStock > 0 ? `${lowStock} ${tCommon('deskWarehouseLowStock')}` : tCommon('deskSupplyEmptyTitle')}
                </p>
                <p className="mt-0.5 max-w-[52ch] text-[13px] leading-5 text-[var(--maher-text-secondary)]">
                  {tCommon('personaWarehouseBody')}
                </p>
                {lowStock > 0 ? (
                  <Link
                    href="/admin/inventory/low-stock"
                    className="maher-press mt-3 inline-flex items-center gap-1.5 rounded-full bg-[var(--maher-text-primary)] px-3.5 py-1.5 text-[13px] font-semibold text-[var(--maher-background)] transition-opacity hover:opacity-90"
                  >
                    {t('lowStock')}
                    <ArrowUpRight className="h-3.5 w-3.5 rtl:-scale-x-100" />
                  </Link>
                ) : null}
              </div>
            </div>
          </div>
          {loading && !overview ? (
            <div className="grid grid-cols-3 gap-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-14 rounded-[12px]" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-x-4 gap-y-4">
              <Link href="/admin/inventory/low-stock" className="maher-press -m-1.5 rounded-[12px] p-1.5 transition-colors hover:bg-[var(--maher-surface-muted)]">
                <Figure value={lowStock} size="sm" label={tCommon('metricLowStock')} tone={lowStock > 0 ? 'warning' : 'neutral'} />
              </Link>
              <Link href="/admin/inventory" className="maher-press -m-1.5 rounded-[12px] p-1.5 transition-colors hover:bg-[var(--maher-surface-muted)]">
                <Figure value={overview?.rawMaterials.itemCount ?? 0} size="sm" label={t('rawMaterials')} />
              </Link>
              <Link href="/admin/inventory" className="maher-press -m-1.5 rounded-[12px] p-1.5 transition-colors hover:bg-[var(--maher-surface-muted)]">
                <Figure value={overview?.semiFinished.itemCount ?? 0} size="sm" label={tCommon('metricSemiFinished')} />
              </Link>
            </div>
          )}
        </div>
      </Board>

      <div className="grid gap-5 xl:grid-cols-12 xl:items-stretch">
        <div className="flex flex-col gap-5 xl:col-span-7">
          <Board>
            <Board.Header title={tCommon('deskWarehouseFinished')} description={tCommon('mgmtSectionInventoryHint')} />
            {loading && !overview ? (
              <Board.Body>
                <Skeleton className="h-20 rounded-[12px]" />
              </Board.Body>
            ) : (
              <Board.Body>
                <Figure value={available + reserved} label={tCommon('deskWarehouseStock')} />
                <Ribbon
                  className="mt-4"
                  segments={[
                    { key: 'available', value: available, label: tCommon('metricFinishedAvailable'), tone: 'success' },
                    { key: 'reserved', value: reserved, label: tCommon('metricFinishedReserved'), tone: 'info' },
                  ]}
                />
              </Board.Body>
            )}
          </Board>
          <Board className="xl:flex-1">
            <Board.Header title={tCommon('mgmtSectionInventory')} description={tCommon('deskWarehouseHint')} />
            <Board.Body padding="tight" grow>
              <Ledger className="px-2">
                <LedgerRow label={t('rawMaterials')} value={(overview?.rawMaterials.itemCount ?? 0).toLocaleString('en-JO')} href="/admin/inventory" LinkComponent={Link} icon={<Boxes className="h-3.5 w-3.5" />} />
                <LedgerRow label={tCommon('metricLowStock')} value={lowStock.toLocaleString('en-JO')} tone={lowStock > 0 ? 'warning' : 'neutral'} stamp href="/admin/inventory/low-stock" LinkComponent={Link} />
                <LedgerRow label={tCommon('metricSemiFinished')} hint={overview ? `${overview.semiFinished.totalQty.toLocaleString('en-JO')} ${tCommon('deskWarehouseStock').toLowerCase()}` : undefined} value={(overview?.semiFinished.itemCount ?? 0).toLocaleString('en-JO')} href="/admin/inventory" LinkComponent={Link} icon={<PackageCheck className="h-3.5 w-3.5" />} />
                <LedgerRow label={tCommon('metricFinishedAvailable')} value={available.toLocaleString('en-JO')} tone="success" href="/admin/inventory" LinkComponent={Link} />
                <LedgerRow label={tCommon('metricFinishedReserved')} value={reserved.toLocaleString('en-JO')} tone="info" href="/admin/inventory" LinkComponent={Link} />
              </Ledger>
            </Board.Body>
          </Board>
        </div>

        <div className="flex flex-col gap-5 xl:col-span-5">
          {actions.length ? (
            <Board tone="neutral" className="xl:flex-1">
              <Board.Header stamp={false} title={tCommon('quickActions')} description={tCommon('dashboardQuickHint')} />
              <Board.Body padding="tight" grow>
                <ul className="m-0 grid list-none grid-cols-1 gap-x-2 p-0">
                  {actions.map((a) => {
                    const Icon = a.icon;
                    return (
                      <li key={`${a.href}-${a.label}`} className="m-0">
                        <Link
                          href={a.href}
                          className="maher-press group/jump flex min-h-[44px] items-center gap-3 rounded-[10px] px-2.5 py-2 text-sm text-[var(--maher-text-primary)] transition-colors hover:bg-[var(--maher-surface-muted)]"
                        >
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] bg-[var(--maher-surface-muted)] text-[var(--maher-text-secondary)] transition-colors group-hover/jump:bg-[var(--maher-brand-soft)] group-hover/jump:text-[var(--maher-brand)]">
                            <Icon className="h-4 w-4" />
                          </span>
                          <span className="min-w-0 flex-1 truncate font-medium">{a.label}</span>
                          <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-[var(--maher-text-tertiary)] opacity-0 transition-opacity group-hover/jump:opacity-100 rtl:-scale-x-100" />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </Board.Body>
            </Board>
          ) : null}
        </div>
      </div>
    </div>
  );
}
