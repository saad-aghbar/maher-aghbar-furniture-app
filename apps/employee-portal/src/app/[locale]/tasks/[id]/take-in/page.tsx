'use client';

import { BackButton } from '@/components/back-button';
import { apiFetch } from '@/lib/api-client';
import { mutationErrorMessage } from '@/hooks/use-api-mutation';
import { Alert, Button, Card, ErrorState, PageHero, Skeleton, useCodeScanner } from '@maher/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

type Incoming = {
  required: boolean;
  allReceived: boolean;
  lines?: Array<{ id: string; qrCode?: string; status?: string }>;
};

export default function TaskTakeInPage({ params }: { params: { id: string } }) {
  const t = useTranslations('production');
  const tNav = useTranslations('navigation');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const qc = useQueryClient();
  const { openScanner } = useCodeScanner();
  const [error, setError] = useState<string | null>(null);

  const incoming = useQuery({
    queryKey: ['task-wip-incoming', params.id],
    queryFn: () => apiFetch<Incoming>(`/api/v1/tasks/${params.id}/wip-incoming`),
  });

  const receive = useMutation({
    mutationFn: (scanCode: string) =>
      apiFetch(`/api/v1/tasks/${params.id}/wip-receive`, {
        method: 'POST',
        body: JSON.stringify({ scanCode }),
      }),
    onSuccess: async () => {
      setError(null);
      await qc.invalidateQueries({ queryKey: ['task-wip-incoming', params.id] });
    },
    onError: (err) => setError(mutationErrorMessage(err)),
  });

  if (incoming.isLoading) return <Skeleton className="h-48 w-full" />;
  if (incoming.isError) return <ErrorState title={t('takeInTitle')} onRetry={() => incoming.refetch()} />;

  const board = incoming.data;
  const ready = Boolean(board && (!board.required || board.allReceived));

  return (
    <div className="space-y-4">
      <BackButton fallbackHref={`/tasks/${params.id}`} />
      <PageHero tone="soft" title={t('takeInTitle')} />
      {error ? <Alert variant="error">{error}</Alert> : null}
      <Card className="space-y-3 p-4">
        <Button
          onClick={async () => {
            const code = await openScanner({ title: tNav('takeIn') });
            if (code) receive.mutate(code);
          }}
          loading={receive.isPending}
        >
          {tCommon('scanTitle')}
        </Button>
        <ul className="text-sm">
          {(board?.lines ?? []).map((line) => (
            <li key={line.id} dir="ltr">
              {line.qrCode ?? line.id} · {line.status}
            </li>
          ))}
        </ul>
        <Button disabled={!ready} onClick={() => router.push(`/tasks/${params.id}`)}>
          {t('takeInContinue')}
        </Button>
      </Card>
    </div>
  );
}
