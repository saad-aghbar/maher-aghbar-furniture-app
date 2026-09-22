'use client';

import { Link } from '@/i18n/navigation';
import type { ManagementSummary } from '@/lib/management-summary';
import { tileLink } from '@/lib/management-summary';
import { Board, Figure, Ledger, LedgerRow, Meter, Sparkline } from '@maher/ui';
import { useDeskCopy } from './desk-shared';

/**
 * Receivable, overdue and credit stay separate figures — never netted.
 * Footer folds in manufacturing costing when available.
 */
export function MoneyBoard({
  finance,
  manufacturing,
  series,
}: {
  finance: NonNullable<ManagementSummary['finance']>;
  manufacturing: ManagementSummary['manufacturing'];
  series: ManagementSummary['series'];
}) {
  const { t, tileLabel, money, compactMoney, locale } = useDeskCopy();
  const overduePct =
    finance.receivable > 0 ? Math.round((finance.overdue / finance.receivable) * 100) : 0;
  const payments = series?.paymentsLast30 ?? null;
  const paymentPoints = payments?.map((p) => p.amount) ?? [];
  const hasPaymentTrend = paymentPoints.some((v) => v > 0);
  const top = finance.topOverdue.slice(0, 3);

  return (
    <Board tone={finance.overdue > 0 ? 'error' : 'success'}>
      <Board.Header title={t('mgmtSectionMoney')} description={t('mgmtSectionMoneyHint')} />
      <Board.Body>
        <div className="grid gap-4 sm:grid-cols-2">
          <Figure
            value={compactMoney(finance.receivable)}
            label={t('metricReceivables')}
            size="sm"
            locale={locale}
          />
          <Figure
            value={compactMoney(finance.overdue)}
            label={t('mgmtFinanceOverdue')}
            size="sm"
            locale={locale}
            tone={finance.overdue > 0 ? 'error' : 'success'}
          />
        </div>
        <Link
          href={tileLink(finance.openInvoices.href, finance.openInvoices.filter)}
          className="-mx-2 mt-3 block rounded-[10px] px-2 py-1 transition-colors hover:bg-[var(--maher-surface-muted)]"
        >
          <Meter
            size="sm"
            label={t('deskMoneyOverdueShare')}
            value={finance.overdue}
            max={Math.max(finance.receivable, finance.overdue, 1)}
            tone={finance.overdue > 0 ? 'error' : 'success'}
            valueLabel={`${overduePct}%`}
          />
        </Link>

        <div className="mt-5 flex items-end justify-between gap-4">
          <Figure
            value={compactMoney(finance.paymentsThisMonth)}
            label={t('mgmtFinancePaymentsMonth')}
            size="sm"
            locale={locale}
            tone="success"
            delta={hasPaymentTrend ? t('deskMoneyPayments30') : undefined}
          />
          {hasPaymentTrend ? (
            <div className="w-1/2 max-w-[220px]">
              <Sparkline points={paymentPoints} tone="success" height={40} />
            </div>
          ) : null}
        </div>

        <Ledger className="mt-4 border-t border-[var(--maher-border)] pt-1">
          <LedgerRow
            label={tileLabel(finance.openInvoices.key)}
            value={finance.openInvoices.count.toLocaleString('en-JO')}
            href={tileLink(finance.openInvoices.href, finance.openInvoices.filter)}
            LinkComponent={Link}
          />
          <LedgerRow
            label={t('mgmtFinanceAccountCredit')}
            value={money(finance.accountCredit)}
            tone={finance.accountCredit > 0 ? 'success' : 'neutral'}
          />
          {top.map((row) => (
            <LedgerRow
              key={row.customerId}
              label={row.name}
              hint={t('deskMoneyTopOverdue')}
              value={money(row.amount)}
              tone="error"
              href={row.href}
              LinkComponent={Link}
            />
          ))}
        </Ledger>
      </Board.Body>

      {manufacturing ? (
        <Board.Footer className="flex-col items-stretch gap-2 py-3">
          <div className="flex items-center justify-between gap-3">
            <span className="font-medium text-[var(--maher-text-primary)]">{t('deskMoneyCosting')}</span>
            <span className="tabular-nums" dir="ltr">
              {manufacturing.finalCostOrders.toLocaleString('en-JO')} · {compactMoney(manufacturing.finalCostTotal)}
            </span>
          </div>
          {manufacturing.grossMfgDifference != null ? (
            <div className="flex items-center justify-between gap-3">
              <span>{t('mgmtMfgGrossDiff')}</span>
              <span
                className="font-semibold tabular-nums"
                style={{
                  color:
                    manufacturing.grossMfgDifference < 0
                      ? 'var(--maher-error)'
                      : 'var(--maher-success)',
                }}
                dir="ltr"
              >
                {money(manufacturing.grossMfgDifference)}
              </span>
            </div>
          ) : null}
          {manufacturing.incompleteCosting > 0 ? (
            <Meter
              size="sm"
              label={t('mgmtMfgIncomplete')}
              value={manufacturing.incompleteCosting}
              max={Math.max(manufacturing.finalCostOrders + manufacturing.incompleteCosting, 1)}
              tone="warning"
            />
          ) : null}
        </Board.Footer>
      ) : null}
    </Board>
  );
}
