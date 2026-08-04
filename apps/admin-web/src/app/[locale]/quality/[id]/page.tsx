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
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

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
  rework?: Array<{ id: string; number: string; status: string; description?: string | null }>;
}

export default function QualityDetailPage({ params }: { params: { id: string } }) {
  const tc = useTranslations('catalog');
  const tCommon = useTranslations('common');
  const tNav = useTranslations('navigation');
  const tStatus = useTranslations('statuses');
  const queryClient = useQueryClient();

  const [banner, setBanner] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState('PASSED');
  const [notes, setNotes] = useState('');
  const [defectDescription, setDefectDescription] = useState('');
  const [itemResults, setItemResults] = useState<Record<string, string>>({});

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

  const reworkMutation = useMutation({
    mutationFn: (reworkId: string) =>
      apiFetch(`/api/v1/quality-inspections/rework/${reworkId}/complete`, { method: 'POST' }),
    onSuccess: async () => {
      setBanner(tc('reworkCompleted'));
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

  return (
    <div className="space-y-6">
      <PageHeader
        backHref="/production"
        title={inspection.number}
        description={inspection.stageCode ?? tNav('quality')}
        actions={
          <>
            {inspection.result ? <StatusBadge status={inspection.result} /> : null}
            <Link href="/quality">
              <Button variant="ghost" size="sm">
                {tCommon('back')}
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
                  <Button
                    size="sm"
                    loading={reworkMutation.isPending}
                    onClick={() => reworkMutation.mutate(rw.id)}
                  >
                    {tc('completeRework')}
                  </Button>
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
