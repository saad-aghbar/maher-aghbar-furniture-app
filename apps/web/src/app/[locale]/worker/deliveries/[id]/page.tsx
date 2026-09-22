'use client';

import { apiFetch } from '@/lib/api-client';
import { mutationErrorMessage } from '@/hooks/use-api-mutation';
import { ActionDock, Alert, Board, BoardSkeleton, Button, Checkbox, DetailHero, ErrorBoard, Ltr, Meter, Stamp, useCodeScanner, type BoardTone } from '@maher/ui';
import { ScanLine, Truck } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
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
  const tp = useTranslations('production');
  const tCommon = useTranslations('common');
  const qc = useQueryClient();
  const router = useRouter();
  const tStatus = useTranslations('statuses');
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

  if (query.isLoading) {
    return (
      <div className="space-y-5">
        <BoardSkeleton rows={3} />
        <BoardSkeleton rows={5} />
      </div>
    );
  }
  if (query.isError || !query.data) {
    return <ErrorBoard title={tNav('deliveries')} description={tCommon('loadFailed')} onRetry={() => query.refetch()} retryLabel={tCommon('retry')} />;
  }
  const sheet = query.data;
  const { loaded, total } = sheet.loadProgress;
  const complete = total > 0 && loaded >= total;
  const tone: BoardTone = sheet.status.toUpperCase() === 'DELIVERED' ? 'success' : complete ? 'success' : loaded > 0 ? 'brand' : 'info';
  const statusLabel = (() => {
    try {
      return tStatus(sheet.status as 'PENDING');
    } catch {
      return sheet.status.replaceAll('_', ' ').toLowerCase();
    }
  })();
  const scanLot = async () => {
    const code = await openScanner({ title: tp('scanFinLot') });
    if (!code) return;
    const needle = code.trim().toUpperCase();
    const product = sheet.products.find((p) => (p.lotQrCode ?? '').trim().toUpperCase() === needle);
    const next = product?.pieces.find((p) => !p.loadedAt);
    if (!next) {
      setError(ti('scanUnknown'));
      return;
    }
    setError(null);
    toggle.mutate({ pieceId: next.id, loaded: true });
  };

  return (
    <div className="maher-stagger space-y-5 pb-24 md:pb-0">
      <DetailHero
        tone={tone}
        back={{ label: tNav('deliveries'), onClick: () => router.push('/worker/tasks') }}
        code={sheet.number}
        title={ti('loadSheetTitle')}
        subtitle={ti('loadSheetHint')}
        status={{ label: statusLabel, tone }}
        facts={[
          { label: ti('loaded'), value: `${loaded}`, ltr: true, tone: loaded ? 'success' : undefined },
          { label: ti('toLoad'), value: `${Math.max(0, total - loaded)}`, ltr: true, tone: total - loaded > 0 ? 'warning' : 'success' },
          { label: tCommon('total'), value: `${total}`, ltr: true },
        ]}
        primary={<Button leadingIcon={<Truck className="h-4 w-4" />} disabled={!sheet.canDepart} loading={depart.isPending} onClick={() => depart.mutate()}>{ti('loadSheetConfirmDepart')}</Button>}
        actions={<Button variant="secondary" leadingIcon={<ScanLine className="h-4 w-4" />} onClick={scanLot} loading={toggle.isPending}>{tp('scanFinLot')}</Button>}
      >
        <Meter value={loaded} max={Math.max(1, total)} tone={tone} label={ti('loaded')} valueLabel={`${loaded}/${total}`} />
      </DetailHero>

      {error ? <Alert variant="error">{error}</Alert> : null}

      <div className={sheet.products.length > 1 ? "maher-stagger grid gap-5 lg:grid-cols-2" : "maher-stagger grid gap-5"}>
        {sheet.products.map((product) => {
          const done = product.pieces.filter((p) => p.loadedAt).length;
          return (
            <Board key={product.inventoryLotId} tone={done === product.pieces.length ? 'success' : done ? 'brand' : 'neutral'}>
              <Board.Header title={product.productNameEn} description={<Ltr>{product.sku}{product.lotQrCode ? ` · ${product.lotQrCode}` : ''}</Ltr>} meta={<Stamp tone={done === product.pieces.length ? 'success' : 'neutral'} size="sm">{`${done}/${product.pieces.length}`}</Stamp>} />
              <ul className="divide-y divide-[var(--maher-border)]">
                {product.pieces.map((piece) => (
                  <li key={piece.id} className="px-5 py-2">
                    <Checkbox
                      className="w-full"
                      checked={Boolean(piece.loadedAt)}
                      disabled={toggle.isPending}
                      onChange={(checked) => toggle.mutate({ pieceId: piece.id, loaded: checked })}
                      label={<span className="flex items-center justify-between gap-3"><span>{piece.label}</span>{piece.loadedAt ? <Stamp tone="success" size="sm">{ti('loaded')}</Stamp> : <Stamp tone="neutral" size="sm">{ti('toLoad')}</Stamp>}</span>}
                    />
                  </li>
                ))}
              </ul>
            </Board>
          );
        })}
      </div>

      <ActionDock className="md:hidden" note={<Ltr className="font-semibold">{`${loaded}/${total}`}</Ltr>}>
        <Button variant="secondary" leadingIcon={<ScanLine className="h-4 w-4" />} onClick={scanLot} loading={toggle.isPending}>{tp('scanFinLot')}</Button>
        <Button className="flex-1" leadingIcon={<Truck className="h-4 w-4" />} disabled={!sheet.canDepart} loading={depart.isPending} onClick={() => depart.mutate()}>
          {ti('loadSheetConfirmDepart')}
        </Button>
      </ActionDock>
    </div>
  );
}
