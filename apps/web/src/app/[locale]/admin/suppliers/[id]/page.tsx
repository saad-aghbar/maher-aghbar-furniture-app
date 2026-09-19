'use client';

import { PageHeader } from '@/components/admin/page-header';
import { Link } from '@/i18n/navigation';
import { apiFetch, API_URL } from '@/lib/api-client';
import { mutationErrorMessage } from '@/hooks/use-api-mutation';
import {
  Alert,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Skeleton,
  StatusBadge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableNumericCell,
  TableRow,
  Tabs,
  TabList,
  Tab,
  TabPanel,
} from '@maher/ui';
import { localizedName } from '@maher/i18n';
import { useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';

type PurchaseOrder = {
  id: string;
  number: string;
  status: string;
  total?: string | number;
  createdAt?: string;
};

type HistoryRow = {
  receiptNumber: string;
  receiptDate: string | null;
  purchaseOrderNumber: string;
  sku: string | null;
  nameEn: string | null;
  unitCost: number | null;
  acceptedQty: number;
};

type SupplierDetail = {
  id: string;
  code: string;
  name: string;
  nameEn?: string | null;
  nameAr?: string | null;
  nameHe?: string | null;
  phone?: string | null;
  email?: string | null;
  companyName?: string | null;
  status: string;
  isCertified?: boolean;
  paymentTermsDays?: number;
  leadTimeDays?: number;
  openPurchaseOrders?: PurchaseOrder[];
  recentPurchaseOrders?: PurchaseOrder[];
  purchaseHistory?: HistoryRow[];
};

type InvoiceRow = {
  id: string;
  number: string;
  status: string;
  outstandingAmount?: number | string | null;
  paidAmount?: number | string | null;
};

export default function SupplierDetailPage({ params }: { params: { id: string } }) {
  const locale = useLocale();
  const tc = useTranslations('catalog');
  const tPurchasing = useTranslations('purchasing');
  const tCommon = useTranslations('common');
  const tNav = useTranslations('navigation');
  const [error, setError] = useState<string | null>(null);

  const detailQuery = useQuery({
    queryKey: ['supplier', params.id],
    queryFn: () => apiFetch<SupplierDetail>(`/api/v1/suppliers/${params.id}`),
  });
  const invoicesQuery = useQuery({
    queryKey: ['supplier-invoices', params.id],
    queryFn: () =>
      apiFetch<{ data: InvoiceRow[] }>(
        `/api/v1/supplier-invoices?supplierId=${params.id}&pageSize=50`,
      ).then((r) => r.data),
  });

  if (detailQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }
  if (detailQuery.isError || !detailQuery.data) {
    return (
      <ErrorState
        title={tNav('suppliers')}
        onRetry={() => detailQuery.refetch()}
        retryLabel={tCommon('retry')}
      />
    );
  }

  const supplier = detailQuery.data;
  const invoices = invoicesQuery.data ?? [];
  const outstanding = invoices.reduce((sum, inv) => sum + Number(inv.outstandingAmount ?? 0), 0);
  const paid = invoices.reduce((sum, inv) => sum + Number(inv.paidAmount ?? 0), 0);
  const name = localizedName(locale, supplier, supplier.name);

  return (
    <div className="space-y-6">
      <PageHeader
        backHref="/admin/suppliers"
        title={name}
        description={supplier.code}
        actions={
          <Button
            variant="secondary"
            onClick={() => {
              try {
                window.open(
                  `${API_URL}/api/v1/suppliers/${supplier.id}/statement/pdf`,
                  '_blank',
                  'noopener,noreferrer',
                );
              } catch (err) {
                setError(mutationErrorMessage(err));
              }
            }}
          >
            {tPurchasing('statementPdf')}
          </Button>
        }
      />
      {error ? <Alert variant="error">{error}</Alert> : null}

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs text-text-secondary">{tc('phone')}</p>
          <p className="mt-1 font-medium" dir="ltr">
            {supplier.phone ?? '—'}
          </p>
          <p className="mt-3 text-xs text-text-secondary">{tc('email')}</p>
          <p className="mt-1" dir="ltr">
            {supplier.email ?? '—'}
          </p>
          <div className="mt-3">
            <StatusBadge status={supplier.status} />
          </div>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-text-secondary">{tPurchasing('outstandingAp')}</p>
          <p className="mt-1 text-2xl font-semibold text-[var(--maher-warning)]" dir="ltr">
            {outstanding.toFixed(2)}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-text-secondary">{tPurchasing('paidAp')}</p>
          <p className="mt-1 text-2xl font-semibold text-[var(--maher-success)]" dir="ltr">
            {paid.toFixed(2)}
          </p>
        </Card>
      </div>

      <Tabs defaultValue="open">
        <TabList>
          <Tab value="open" count={supplier.openPurchaseOrders?.length}>
            {tPurchasing('openOrders')}
          </Tab>
          <Tab value="recent" count={supplier.recentPurchaseOrders?.length}>
            {tPurchasing('recentOrders')}
          </Tab>
          <Tab value="history" count={supplier.purchaseHistory?.length}>
            {tPurchasing('purchaseHistory')}
          </Tab>
          <Tab value="invoices" count={invoices.length}>
            {tc('supplierInvoices')}
          </Tab>
        </TabList>

        <TabPanel value="open">
          <OrderTable
            rows={supplier.openPurchaseOrders ?? []}
            empty={tc('noPurchaseOrders')}
            details={tCommon('details')}
            statusLabel={tCommon('status')}
            totalLabel={tCommon('total')}
          />
        </TabPanel>
        <TabPanel value="recent">
          <OrderTable
            rows={supplier.recentPurchaseOrders ?? []}
            empty={tc('noPurchaseOrders')}
            details={tCommon('details')}
            statusLabel={tCommon('status')}
            totalLabel={tCommon('total')}
          />
        </TabPanel>
        <TabPanel value="history">
          {(supplier.purchaseHistory ?? []).length === 0 ? (
            <EmptyState title={tPurchasing('purchaseHistory')} />
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>{tc('code')}</TableHeaderCell>
                  <TableHeaderCell>{tc('material')}</TableHeaderCell>
                  <TableHeaderCell>{tc('qty')}</TableHeaderCell>
                  <TableHeaderCell>{tc('unitCost')}</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(supplier.purchaseHistory ?? []).map((row, idx) => (
                  <TableRow key={`${row.receiptNumber}-${idx}`}>
                    <TableCell dir="ltr">{row.sku ?? '—'}</TableCell>
                    <TableCell>{row.nameEn ?? '—'}</TableCell>
                    <TableNumericCell>{row.acceptedQty}</TableNumericCell>
                    <TableNumericCell>
                      {row.unitCost != null ? row.unitCost.toFixed(2) : '—'}
                    </TableNumericCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TabPanel>
        <TabPanel value="invoices">
          {invoices.length === 0 ? (
            <EmptyState title={tc('supplierInvoices')} />
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>{tc('code')}</TableHeaderCell>
                  <TableHeaderCell>{tCommon('status')}</TableHeaderCell>
                  <TableHeaderCell>{tPurchasing('outstandingAp')}</TableHeaderCell>
                  <TableHeaderCell>{tPurchasing('paidAp')}</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {invoices.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell>
                      <Link
                        href={`/admin/purchasing/supplier-invoices/${inv.id}`}
                        className="font-medium text-brand"
                      >
                        {inv.number}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={inv.status} />
                    </TableCell>
                    <TableNumericCell>{Number(inv.outstandingAmount ?? 0).toFixed(2)}</TableNumericCell>
                    <TableNumericCell>{Number(inv.paidAmount ?? 0).toFixed(2)}</TableNumericCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TabPanel>
      </Tabs>
    </div>
  );
}

function OrderTable({
  rows,
  empty,
  details,
  statusLabel,
  totalLabel,
}: {
  rows: PurchaseOrder[];
  empty: string;
  details: string;
  statusLabel: string;
  totalLabel: string;
}) {
  if (rows.length === 0) return <EmptyState title={empty} />;
  return (
    <Table>
      <TableHead>
        <TableRow>
          <TableHeaderCell>PO</TableHeaderCell>
          <TableHeaderCell>{statusLabel}</TableHeaderCell>
          <TableHeaderCell>{totalLabel}</TableHeaderCell>
          <TableHeaderCell />
        </TableRow>
      </TableHead>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id}>
            <TableCell dir="ltr">{row.number}</TableCell>
            <TableCell>
              <StatusBadge status={row.status} />
            </TableCell>
            <TableNumericCell>{Number(row.total ?? 0).toFixed(2)}</TableNumericCell>
            <TableCell>
              <Link href={`/admin/purchasing/${row.id}`} className="text-sm font-medium text-brand">
                {details}
              </Link>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
