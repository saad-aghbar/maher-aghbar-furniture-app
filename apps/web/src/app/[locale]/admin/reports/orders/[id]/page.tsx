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

type Dossier = {
  number: string;
  status: string;
  summary: {
    saleValue: number | null;
    actualProductionCost: number | null;
    plannedCost: number | null;
    grossMargin: number | null;
    marginPct: number | null;
    coverage: string;
    labor?: number | null;
    quantity: number;
    averageCostPerUnit: number | null;
    perPieceTracked: boolean;
  };
  lines: Array<{
    id: string;
    description: string;
    quantity: number;
    actualCost: number | null;
    averageCostPerUnit: number | null;
    note: string | null;
  }>;
  materials: { coverage: string; rows: Array<{ sku: string; netQty: number; actualCost: number | null; unpricedIssueQty: number }> };
  time: {
    workerEffortMinutes: number;
    wallClockMinutes: number | null;
    reworkEffortMinutes: number;
    labor: {
      enabled: boolean;
      total: number | null;
      note: string | null;
      byWorker?: Array<{ userId: string; minutes: number; actual: number | null }>;
    };
    byStage: Array<{
      stageCode: string;
      workerEffortMinutes?: number;
      reworkEffortMinutes?: number;
      minutes?: number;
    }>;
  };
  waste: { scrapCost: number | null; alreadyIncludedInActual: boolean };
  rework: { materialCost: number | null; effortMinutes: number };
  lifetime: {
    originalProductionCost: number | null;
    afterSaleReturnCost: number | null;
    lifetimeCost: number | null;
    recoveredValue: number | null;
    disposedValue: number | null;
  };
  provenance: {
    source: string;
    formula: string;
    issueCount: number;
    costedIssueCount: number;
    transactions?: Array<{
      id: string;
      number: string;
      type: string;
      sku: string;
      quantity: number;
      unitCost: number | null;
    }>;
  };
  returns?: Array<{ id: string; number: string; lifecycleState: string }>;
};

function money(locale: string, value: number | null) {
  if (value == null) return '—';
  return new Intl.NumberFormat(locale, { style: 'currency', currency: 'ILS' }).format(value);
}

export default function OrderCostDossierPage() {
  const params = useParams<{ id: string }>();
  const ta = useTranslations('accounting');
  const locale = useLocale();
  const query = useQuery({
    queryKey: ['cost-dossier', params.id],
    queryFn: () => apiFetch<Dossier>(`/api/v1/reports/cost/orders/${params.id}`),
  });

  if (query.isLoading) return <Skeleton className="h-96 w-full" />;
  if (!query.data) return <EmptyState title={ta('noData')} />;
  const d = query.data;

  return (
    <div className="space-y-6">
      <PageHero
        title={`${ta('orderCostDossier')} · ${d.number}`}
        description={ta('reportsSubtitle')}
        tone="soft"
        actions={
          <Link href={`/admin/sales-orders/${params.id}`} className="text-sm underline">
            {d.number}
          </Link>
        }
      />

      <Card className="grid gap-3 p-4 sm:grid-cols-4">
        <Metric label={ta('saleValue')} value={money(locale, d.summary.saleValue)} />
        <Metric label={ta('actualCost')} value={money(locale, d.summary.actualProductionCost)} />
        <Metric label={ta('laborCost')} value={money(locale, d.summary.labor ?? d.time.labor.total)} />
        <Metric
          label={ta('grossMargin')}
          value={`${money(locale, d.summary.grossMargin)}${d.summary.marginPct != null ? ` (${d.summary.marginPct}%)` : ''}`}
        />
        <div>
          <div className="text-xs text-muted-foreground">{ta('coverage')}</div>
          <div className="text-lg font-semibold">{d.summary.coverage}</div>
        </div>
      </Card>

      {d.summary.plannedCost != null ? (
        <Card className="p-4">
          <h2 className="mb-2 font-semibold">{ta('plannedVsActual')}</h2>
          <p>
            {money(locale, d.summary.plannedCost)} → {money(locale, d.summary.actualProductionCost)}
          </p>
        </Card>
      ) : null}

      <Card className="p-4">
        <h2 className="mb-2 font-semibold">{ta('lensOrders')}</h2>
        <p className="mb-3 text-sm text-muted-foreground">{ta('perPieceNote')}</p>
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>Line</TableHeaderCell>
              <TableHeaderCell>Qty</TableHeaderCell>
              <TableHeaderCell>{ta('actualCost')}</TableHeaderCell>
              <TableHeaderCell>{ta('averagePerUnit')}</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {d.lines.map((line) => (
              <TableRow key={line.id}>
                <TableCell>{line.description}</TableCell>
                <TableNumericCell>{line.quantity}</TableNumericCell>
                <TableNumericCell>{money(locale, line.actualCost)}</TableNumericCell>
                <TableNumericCell>{money(locale, line.averageCostPerUnit)}</TableNumericCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Card className="p-4">
        <h2 className="mb-2 font-semibold">{ta('lensMaterials')}</h2>
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>SKU</TableHeaderCell>
              <TableHeaderCell>Net qty</TableHeaderCell>
              <TableHeaderCell>{ta('actualCost')}</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {d.materials.rows.map((row) => (
              <TableRow key={row.sku}>
                <TableCell>
                  {row.sku}
                  {row.unpricedIssueQty > 0 ? (
                    <span className="ml-2 text-xs text-muted-foreground">{ta('coverageUnpriced')}</span>
                  ) : null}
                </TableCell>
                <TableNumericCell>{row.netQty}</TableNumericCell>
                <TableNumericCell>{money(locale, row.actualCost)}</TableNumericCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Card className="space-y-2 p-4">
        <h2 className="font-semibold">{ta('lensTime')}</h2>
        <p>
          {ta('workerEffort')}: {(d.time.workerEffortMinutes / 60).toFixed(1)} h · {ta('wallClock')}:{' '}
          {d.time.wallClockMinutes != null ? `${(d.time.wallClockMinutes / 60).toFixed(1)} h` : '—'} ·{' '}
          {ta('reworkTime')}: {(d.time.reworkEffortMinutes / 60).toFixed(1)} h
        </p>
        {d.time.labor.enabled ? (
          <p>{ta('laborCost')}: {money(locale, d.time.labor.total)}</p>
        ) : (
          <p className="text-sm text-muted-foreground">{ta('laborHidden')}</p>
        )}
        {(d.time.labor.byWorker ?? []).length ? (
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>{ta('laborByWorker')}</TableHeaderCell>
                <TableHeaderCell>{ta('factoryTime')}</TableHeaderCell>
                <TableHeaderCell>{ta('laborCost')}</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {d.time.labor.byWorker!.map((row) => (
                <TableRow key={row.userId}>
                  <TableCell>
                    <Link href={`/employees?edit=${row.userId}`}>{row.userId}</Link>
                  </TableCell>
                  <TableNumericCell>{(row.minutes / 60).toFixed(1)} h</TableNumericCell>
                  <TableNumericCell>{money(locale, row.actual)}</TableNumericCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : null}
        {(d.time.byStage ?? []).length ? (
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>{ta('currentStage')}</TableHeaderCell>
                <TableHeaderCell>{ta('factoryTime')}</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {d.time.byStage.map((stage) => (
                <TableRow key={stage.stageCode}>
                  <TableCell>{stage.stageCode}</TableCell>
                  <TableNumericCell>
                    {((stage.workerEffortMinutes ?? (stage as { minutes?: number }).minutes ?? 0) / 60).toFixed(1)} h
                  </TableNumericCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : null}
      </Card>

      <Card className="p-4">
        <h2 className="mb-2 font-semibold">{ta('lifetimeCost')}</h2>
        <p>
          {ta('originalProduction')}: {money(locale, d.lifetime.originalProductionCost)} · {ta('afterSaleReturn')}:{' '}
          {money(locale, d.lifetime.afterSaleReturnCost)} · {ta('lifetimeCost')}: {money(locale, d.lifetime.lifetimeCost)}
        </p>
        <p className="text-sm text-muted-foreground">
          {ta('recoveredValue')}: {money(locale, d.lifetime.recoveredValue)} · {ta('disposedValue')}:{' '}
          {money(locale, d.lifetime.disposedValue)}
        </p>
        {d.waste.alreadyIncludedInActual ? (
          <p className="text-sm text-muted-foreground">{ta('scrapIncluded')}</p>
        ) : null}
      </Card>

      <Card className="p-4">
        <h2 className="mb-1 font-semibold">{ta('provenance')}</h2>
        <p className="text-sm text-muted-foreground">
          {d.provenance.formula} · {d.provenance.costedIssueCount}/{d.provenance.issueCount}
        </p>
        {(d.provenance.transactions ?? []).length ? (
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>{ta('sku')}</TableHeaderCell>
                <TableHeaderCell>{ta('count')}</TableHeaderCell>
                <TableHeaderCell>{ta('actualCost')}</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(d.provenance.transactions ?? []).map((tx) => (
                <TableRow key={tx.id}>
                  <TableCell>
                    <span className="underline">{tx.sku}</span>
                  </TableCell>
                  <TableNumericCell>{tx.quantity}</TableNumericCell>
                  <TableNumericCell>{money(locale, tx.unitCost)}</TableNumericCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : null}
      </Card>

      {(d.returns ?? []).length ? (
        <Card className="p-4">
          <h2 className="mb-2 font-semibold">{ta('lensReturns')}</h2>
          <ul className="space-y-1 text-sm">
            {d.returns!.map((row) => (
              <li key={row.id}>
                <Link href={`/admin/reports/returns/${row.id}`} className="underline">
                  {row.number}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}
