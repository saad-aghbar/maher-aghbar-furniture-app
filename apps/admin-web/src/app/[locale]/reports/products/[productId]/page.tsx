'use client';

import { PageHeader } from '@/components/admin/page-header';
import { Link } from '@/i18n/navigation';
import { apiFetch } from '@/lib/api-client';
import { useReportsFilterQs } from '@/components/cost-performance/reports-chrome';
import { Card, ErrorState, Skeleton, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableNumericCell, TableRow } from '@maher/ui';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';

type Profile = {
  product?: { sku?: string; nameEn?: string | null };
  orderCount?: number;
  averageActualCost?: number | null;
  variants?: Array<{ variantId: string; sku?: string; orderCount: number; averageActualCost?: number | null }>;
};

export default function ReportsProductProfilePage({ params }: { params: { productId: string } }) {
  const ta = useTranslations('accounting');
  const qs = useReportsFilterQs();
  const query = useQuery({
    queryKey: ['cost-product-profile', params.productId, qs],
    queryFn: () => apiFetch<Profile>(`/api/v1/reports/cost/products/${params.productId}${qs}`),
    retry: 0,
  });

  if (query.isLoading) return <Skeleton className="h-48 w-full" />;
  if (query.isError || !query.data) {
    return <ErrorState title={ta('sectionProducts')} onRetry={() => query.refetch()} />;
  }

  return (
    <div className="space-y-4">
      <PageHeader
        backHref={`/reports/products${qs}`}
        title={query.data.product?.sku ?? params.productId}
        description={query.data.product?.nameEn ?? undefined}
      />
      <Card className="p-4">
        <p className="text-sm">
          {ta('orderCount')}: {query.data.orderCount ?? 0}
        </p>
        <p className="text-sm" dir="ltr">
          {ta('actualCost')}: {String(query.data.averageActualCost ?? '—')}
        </p>
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>{ta('variantSlot')}</TableHeaderCell>
              <TableHeaderCell>{ta('orderCount')}</TableHeaderCell>
              <TableHeaderCell>{ta('actualCost')}</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {(query.data.variants ?? []).map((row) => (
              <TableRow key={row.variantId}>
                <TableCell>
                  <Link
                    href={`/reports/products/${params.productId}/variants/${row.variantId}${qs}`}
                    className="text-brand hover:underline"
                  >
                    {row.sku ?? row.variantId}
                  </Link>
                </TableCell>
                <TableNumericCell>{row.orderCount}</TableNumericCell>
                <TableNumericCell>{String(row.averageActualCost ?? '—')}</TableNumericCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
