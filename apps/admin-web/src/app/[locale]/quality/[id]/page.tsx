'use client';

import { PageHeader } from '@/components/admin/page-header';
import { Link } from '@/i18n/navigation';
import { apiFetch } from '@/lib/api-client';
import { CHECKLIST_ITEM_RESULTS, QUALITY_RESULTS, statusOptions } from '@/lib/status-options';
import { mutationErrorMessage } from '@/hooks/use-api-mutation';
import {
  Alert,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  MotionSection,
  Select,
  Skeleton,
  StatusBadge,
  Table,
  TableBody,
  TableCell,
  TableNumericCell,
  TableHead,
  TableHeaderCell,
  TableRow,
  TextArea,
} from '@maher/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { localizedName } from '@maher/i18n';

interface InspectionDetail {
  id: string;
  number: string;
  result?: string | null;
  notes?: string | null;
  stageCode?: string | null;
  productionOrderId?: string;
  items?: Array<{
    id: string;
    checklistCode: string;
    label: string;
    result?: string | null;
    note?: string | null;
  }>;
  defects?: Array<{ id: string; description: string; severity?: string | null }>;
  rework?: Array<{
    id: string;
    number: string;
    status: string;
    description?: string | null;
    reentryStageInstanceId?: string | null;
  }>;
}

export default function QualityDetailPage({ params }: { params: { id: string } }) {
  const tc = useTranslations('catalog');
  const tp = useTranslations('production');
  const tCommon = useTranslations('common');
  const tNav = useTranslations('navigation');
  const tStatus = useTranslations('statuses');
  const locale = useLocale();
  const queryClient = useQueryClient();

  const [banner, setBanner] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState('PASSED');
  const [notes, setNotes] = useState('');
  const [defectDescription, setDefectDescription] = useState('');
  const [itemResults, setItemResults] = useState<Record<string, string>>({});
  const [reworkStageId, setReworkStageId] = useState('');
  const [reworkNotes, setReworkNotes] = useState('');

  const detailQuery = useQuery({
    queryKey: ['quality-inspection', params.id],
    queryFn: () => apiFetch<InspectionDetail>(`/api/v1/quality-inspections/${params.id}`),
  });

  useEffect(() => {
    const data = detailQuery.data;
    if (!data) return;
    setNotes(data.notes ?? '');
    if (data.result) setResult(data.result);
    setItemResults(
      Object.fromEntries(
        (data.items ?? []).map((item) => [item.checklistCode, item.result ?? 'PASS']),
      ),
    );
  }, [detailQuery.data]);

  const submitMutation = useMutation({
    mutationFn: () =>
      apiFetch(`/api/v1/quality-inspections/${params.id}/submit`, {
        method: 'POST',
        body: JSON.stringify({
          result,
          notes: notes.trim() || undefined,
          defectDescription:
            result === 'FAILED_REWORK_REQUIRED' || result === 'BLOCKED'
              ? defectDescription.trim() || undefined
              : undefined,
          checklistResults: Object.entries(itemResults).map(([checklistCode, itemResult]) => ({
            checklistCode,
            result: itemResult,
          })),
        }),
      }),
    onSuccess: async () => {
      setBanner(tc('resultSubmitted'));
      await queryClient.invalidateQueries({ queryKey: ['quality-inspection', params.id] });
      await queryClient.invalidateQueries({ queryKey: ['quality-inspections'] });
    },
    onError: (err) => setError(mutationErrorMessage(err)),
  });

  const poQuery = useQuery({
    queryKey: ['production-order', detailQuery.data?.productionOrderId],
    queryFn: () =>
      apiFetch<{
        stages: Array<{
          id: string;
          stageDefinition: { nameEn: string; nameAr: string; nameHe?: string | null };
        }>;
      }>(`/api/v1/production-orders/${detailQuery.data!.productionOrderId}`),
    enabled: Boolean(detailQuery.data?.productionOrderId),
  });

  const reworkMutation = useMutation({
    mutationFn: (reworkId: string) =>
      apiFetch(`/api/v1/quality-inspections/rework/${reworkId}/complete`, { method: 'POST' }),
    onSuccess: async () => {
      setBanner(tc('reworkCompleted'));
      await queryClient.invalidateQueries({ queryKey: ['quality-inspection', params.id] });
    },
    onError: (err) => setError(mutationErrorMessage(err)),
  });

  const startReworkMutation = useMutation({
    mutationFn: (args: { reworkId: string; stageInstanceId: string; notes?: string }) =>
      apiFetch(`/api/v1/quality-inspections/rework/${args.reworkId}/start`, {
        method: 'POST',
        body: JSON.stringify({
          stageInstanceId: args.stageInstanceId,
          notes: args.notes,
        }),
      }),
    onSuccess: async () => {
      setBanner(tp('reworkStarted'));
      await queryClient.invalidateQueries({ queryKey: ['quality-inspection', params.id] });
    },
    onError: (err) => setError(mutationErrorMessage(err)),
  });

  if (detailQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (detailQuery.isError || !detailQuery.data) {
    return (
      <ErrorState
        title={tNav('quality')}
        onRetry={() => detailQuery.refetch()}
        retryLabel={tCommon('retry')}
      />
    );
  }

  const inspection = detailQuery.data;
  const items = inspection.items ?? [];
  const pending = !inspection.result;
  const resultOptions = statusOptions(tStatus, QUALITY_RESULTS);
  const itemResultOptions = statusOptions(tStatus, CHECKLIST_ITEM_RESULTS);
  const productionBackHref = inspection.productionOrderId
    ? `/production/${inspection.productionOrderId}`
    : '/quality';

  return (
    <div className="space-y-6">
      <PageHeader
        backHref={productionBackHref}
        title={inspection.number}
        description={inspection.stageCode ?? tNav('quality')}
        actions={
          <>
            {inspection.result ? <StatusBadge status={inspection.result} /> : null}
            {inspection.productionOrderId ? (
              <Link href={`/production/${inspection.productionOrderId}`}>
                <Button variant="ghost" size="sm">
                  {tp('factoryOrderNumber')}
                </Button>
              </Link>
            ) : null}
            <Link href="/quality">
              <Button variant="ghost" size="sm">
                {tNav('quality')}
              </Button>
            </Link>
          </>
        }
      />

      {banner ? <Alert variant="success">{banner}</Alert> : null}
      {error ? <Alert variant="error">{error}</Alert> : null}

      <MotionSection className="maher-form-section space-y-6" as="div">
      <Card className="space-y-3 p-4">
        <h2 className="text-base font-semibold">{tc('lineItems')}</h2>
        {items.length === 0 ? (
          <EmptyState title={tc('noInspections')} />
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>{tc('code')}</TableHeaderCell>
                <TableHeaderCell>{tc('name')}</TableHeaderCell>
                <TableHeaderCell>{tc('result')}</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableNumericCell>{item.checklistCode}</TableNumericCell>
                  <TableCell>{item.label}</TableCell>
                  <TableCell>
                    {pending ? (
                      <Select
                        value={itemResults[item.checklistCode] ?? 'PASS'}
                        onChange={(e) =>
                          setItemResults((prev) => ({
                            ...prev,
                            [item.checklistCode]: e.target.value,
                          }))
                        }
                        options={itemResultOptions}
                      />
                    ) : item.result ? (
                      <StatusBadge status={item.result} />
                    ) : (
                      '—'
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {(inspection.defects ?? []).length > 0 ? (
        <Card className="space-y-2 border-error/40 p-4">
          <h2 className="text-base font-semibold text-error">{tc('defectDescription')}</h2>
          <ul className="list-disc space-y-1 ps-5 text-sm">
            {(inspection.defects ?? []).map((d) => (
              <li key={d.id}>{d.description}</li>
            ))}
          </ul>
        </Card>
      ) : null}

      {pending ? (
        <Card className="space-y-3 p-4">
          <h2 className="text-base font-semibold">{tc('submitResult')}</h2>
          <Select
            label={tc('overallResult')}
            value={result}
            onChange={(e) => setResult(e.target.value)}
            options={resultOptions}
          />
          <TextArea
            label={tc('notes')}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
          />
          {result === 'FAILED_REWORK_REQUIRED' || result === 'BLOCKED' ? (
            <Input
              label={tc('defectDescription')}
              value={defectDescription}
              onChange={(e) => setDefectDescription(e.target.value)}
              required
            />
          ) : null}
          <Button loading={submitMutation.isPending} onClick={() => submitMutation.mutate()}>
            {tc('submitResult')}
          </Button>
        </Card>
      ) : (
        <Card className="p-4">
          <p className="text-sm text-text-secondary">{tc('notes')}</p>
          <p className="mt-1 font-medium">{inspection.notes ?? '—'}</p>
        </Card>
      )}

      {(inspection.rework ?? []).length > 0 ? (
        <Card className="space-y-3 p-4">
          <h2 className="text-base font-semibold">{tc('rework')}</h2>
          <ul className="space-y-2 text-sm">
            {(inspection.rework ?? []).map((rw) => (
              <li key={rw.id} className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  <span dir="ltr">{rw.number}</span> — {rw.description ?? '—'}{' '}
                  <StatusBadge status={rw.status} />
                </span>
                {rw.status !== 'COMPLETED' ? (
                  <div className="flex flex-wrap items-end gap-2">
                    {rw.status === 'AWAITING_STAGE' || rw.status === 'OPEN' ? (
                      <>
                        <Select
                          label={tp('chooseReworkStage')}
                          value={reworkStageId}
                          onChange={(e) => setReworkStageId(e.target.value)}
                          options={[
                            { value: '', label: tp('chooseReworkStage') },
                            ...(poQuery.data?.stages ?? []).map((stage) => ({
                              value: stage.id,
                              label: localizedName(locale, stage.stageDefinition),
                            })),
                          ]}
                        />
                        <Input
                          label={tc('notes')}
                          value={reworkNotes}
                          onChange={(e) => setReworkNotes(e.target.value)}
                        />
                        <Button
                          size="sm"
                          loading={startReworkMutation.isPending}
                          disabled={!reworkStageId}
                          onClick={() =>
                            startReworkMutation.mutate({
                              reworkId: rw.id,
                              stageInstanceId: reworkStageId,
                              notes: reworkNotes.trim() || undefined,
                            })
                          }
                        >
                          {tp('startRework')}
                        </Button>
                      </>
                    ) : (
                      <Button
                        size="sm"
                        loading={reworkMutation.isPending}
                        onClick={() => reworkMutation.mutate(rw.id)}
                      >
                        {tc('completeRework')}
                      </Button>
                    )}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
      </MotionSection>
    </div>
  );
}
