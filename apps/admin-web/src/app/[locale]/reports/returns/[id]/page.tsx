'use client';

import { Link } from '@/i18n/navigation';
import { apiFetch } from '@/lib/api-client';
import {
  Card,
  EmptyState,
  PageHero,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableNumericCell,
  TableRow,
} from '@maher/ui';
import { useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';

type ReturnDossier = {
  id: string;
  number: string;
  status?: string;
  salesOrder?: { id: string; number: string } | null;
  pieceCount?: number;
  repairCost?: number | null;
  replacementCost?: number | null;
  recoveryCost?: number | null;
  returnGrossCost?: number | null;
  recoveredValue?: number | null;
  disposedValue?: number | null;
  pieces?: Array<{
    id: string;
    repairCost: number | null;
    replacementCost: number | null;
    recoveryCost: number | null;
    workCost: number | null;
    workerEffortMinutes: number;
  }>;
};

function money(locale: string, value: number | null | undefined) {
  if (value == null) return '—';
  return new Intl.NumberFormat(locale, { style: 'currency', currency: 'ILS' }).format(value);
}

export default function ReturnCostDossierPage() {
  const params = useParams<{ id: string }>();
  const ta = useTranslations('accounting');
  const locale = useLocale();
  const query = useQuery({
    queryKey: ['cost-return-dossier', params.id],
    queryFn: () => apiFetch<ReturnDossier>(`/api/v1/reports/cost/returns/${params.id}`),
  });

  if (query.isLoading) return <Skeleton className="h-96 w-full" />;
  if (!query.data) return <EmptyState title={ta('noData')} />;
  const d = query.data;

  return (
    <div className="space-y-6">
      <PageHero
        title={`${ta('returnCostDossier')} · ${d.number}`}
        description={ta('reportsSubtitle')}
        tone="soft"
        actions={
          <Link href="/reports/returns" className="text-sm underline">
            {ta('lensReturns')}
          </Link>
        }
      />
      <Card className="grid gap-3 p-4 sm:grid-cols-3">
        <div>
          <div className="text-xs text-muted-foreground">{ta('repairCost')}</div>
          <div className="text-lg font-semibold">{money(locale, d.repairCost)}</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">{ta('replacementCost')}</div>
          <div className="text-lg font-semibold">{money(locale, d.replacementCost)}</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">{ta('recoveryCost')}</div>
          <div className="text-lg font-semibold">{money(locale, d.recoveryCost)}</div>
        </div>
      </Card>
      {d.salesOrder ? (
        <Link href={`/sales-orders/${d.salesOrder.id}`} className="text-sm underline">
          {d.salesOrder.number}
        </Link>
      ) : null}
      <Card className="p-4">
        <h2 className="mb-2 font-semibold">{ta('lensReturns')}</h2>
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>Piece</TableHeaderCell>
              <TableHeaderCell>{ta('repairCost')}</TableHeaderCell>
              <TableHeaderCell>{ta('returnGrossCost')}</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {(d.pieces ?? []).map((piece, index) => (
              <TableRow key={piece.id}>
                <TableCell>
                  <Link href={`/returns/${d.id}`} className="underline">
                    {index + 1}
                  </Link>
                </TableCell>
                <TableNumericCell>{money(locale, piece.repairCost)}</TableNumericCell>
                <TableNumericCell>{money(locale, piece.workCost)}</TableNumericCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
