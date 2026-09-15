'use client';

import { BackButton } from '@/components/back-button';
import { apiFetch } from '@/lib/api-client';
import { mutationErrorMessage } from '@/hooks/use-api-mutation';
import {
  Alert,
  Button,
  Card,
  ErrorState,
  PageHero,
  Skeleton,
  StatusBadge,
  useCodeScanner,
} from '@maher/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

type Piece = {
  id: string;
  pieceIndex: number;
  label: string;
  loadedAt: string | null;
};

type Product = {
  inventoryLotId: string;
  lotQrCode?: string | null;
  productNameEn: string;
  sku: string;
  pieces: Piece[];
};

type Sheet = {
  number: string;
  status: string;
  canDepart: boolean;
  loadProgress: { loaded: number; total: number };
  products: Product[];
};

export default function EmployeeDeliveryPage({ params }: { params: { id: string } }) {
  const ti = useTranslations('inventory');
  const tNav = useTranslations('navigation');
  const tCommon = useTranslations('common');
  const qc = useQueryClient();
  const { openScanner } = useCodeScanner();
  const [error, setError] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ['delivery-load-sheet', params.id],
    queryFn: () => apiFetch<Sheet>(`/api/v1/deliveries/${params.id}/load-sheet`),
  });

  const toggle = useMutation({
    mutationFn: (args: { pieceId: string; loaded: boolean }) =>
      apiFetch(
        `/api/v1/deliveries/${params.id}/load-pieces/${args.pieceId}/${args.loaded ? 'check' : 'uncheck'}`,
        { method: 'POST' },
      ),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['delivery-load-sheet', params.id] });
    },
    onError: (err) => setError(mutationErrorMessage(err)),
  });

  const depart = useMutation({
    mutationFn: () => apiFetch(`/api/v1/deliveries/${params.id}/depart`, { method: 'POST', body: '{}' }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['delivery-load-sheet', params.id] });
    },
    onError: (err) => setError(mutationErrorMessage(err)),
  });

  if (query.isLoading) return <Skeleton className="h-48 w-full" />;
  if (query.isError || !query.data) {
    return <ErrorState title={tNav('deliveries')} onRetry={() => query.refetch()} />;
  }
  const sheet = query.data;

  return (
    <div className="space-y-4">
      <BackButton fallbackHref="/tasks" />
      <PageHero tone="soft" title={sheet.number} />
      {error ? <Alert variant="error">{error}</Alert> : null}
      <Button
        variant="secondary"
        onClick={async () => {
          const code = await openScanner({ title: ti('scanFinLot') });
          if (!code) return;
          const needle = code.trim().toUpperCase();
          const product = sheet.products.find((p) => (p.lotQrCode ?? '').trim().toUpperCase() === needle);
          const next = product?.pieces.find((p) => !p.loadedAt);
          if (!next) {
            setError(ti('scanUnknown'));
            return;
          }
          toggle.mutate({ pieceId: next.id, loaded: true });
        }}
      >
        {ti('scanFinLot')}
      </Button>
      {sheet.products.map((product) => (
        <Card key={product.inventoryLotId} className="space-y-2 p-4">
          <p className="font-medium">{product.productNameEn}</p>
          {product.pieces.map((piece) => (
            <button
              key={piece.id}
              type="button"
              className="flex w-full items-center justify-between rounded-lg border px-3 py-2 text-start text-sm"
              onClick={() => toggle.mutate({ pieceId: piece.id, loaded: !piece.loadedAt })}
            >
              <span>{piece.label}</span>
              <StatusBadge status={piece.loadedAt ? 'LOADED' : 'OPEN'} />
            </button>
          ))}
        </Card>
      ))}
      <Button disabled={!sheet.canDepart} loading={depart.isPending} onClick={() => depart.mutate()}>
        {ti('loadSheetConfirmDepart')}
      </Button>
    </div>
  );
}
