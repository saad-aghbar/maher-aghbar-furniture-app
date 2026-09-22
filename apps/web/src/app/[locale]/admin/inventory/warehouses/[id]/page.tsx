'use client';

import { InventoryScanBar } from '@/components/inventory/inventory-scan-bar';
import { usePdfDownload } from '@/hooks/use-pdf-download';
import { mutationErrorMessage } from '@/hooks/use-api-mutation';
import { Link } from '@/i18n/navigation';
import { apiFetch } from '@/lib/api-client';
import { localizedName } from '@maher/i18n';
import { Board, BoardSkeleton, Button, DetailHero, ErrorBoard, Ltr, QrDisplay, Stamp } from '@maher/ui';
import { useQuery } from '@tanstack/react-query';
import { FileText, Printer } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

type Warehouse = {
  id: string;
  code: string;
  nameEn: string;
  nameAr?: string | null;
  nameHe?: string | null;
  type?: string | null;
  isDefault?: boolean;
  isActive?: boolean;
  locations?: Array<{ id: string; code: string; name?: string | null; qrCode?: string | null; isDefault?: boolean; isActive?: boolean }>;
};

function typeKey(type?: string | null): 'warehouseTypeRaw' | 'warehouseTypeSemi' | 'warehouseTypeFinished' | null {
  switch ((type ?? '').toUpperCase()) {
    case 'RAW_MATERIALS':
      return 'warehouseTypeRaw';
    case 'SEMI_FINISHED':
      return 'warehouseTypeSemi';
    case 'FINISHED_GOODS':
      return 'warehouseTypeFinished';
    default:
      return null;
  }
}

/** Warehouse bins with their QR codes; print one label or the whole sheet (mobile parity). */
export default function InventoryWarehousePage({ params }: { params: { id: string } }) {
  const locale = useLocale();
  const ti = useTranslations('inventory');
  const tCommon = useTranslations('common');
  const { openPdf, pdfDialog } = usePdfDownload();
  const query = useQuery({
    queryKey: ['warehouse', params.id],
    queryFn: () => apiFetch<Warehouse>(`/api/v1/warehouses/${params.id}`),
  });

  if (query.isLoading) return <BoardSkeleton rows={6} />;
  if (query.isError || !query.data) {
    return <ErrorBoard title={ti('warehouses')} description={mutationErrorMessage(query.error)} onRetry={() => query.refetch()} retryLabel={tCommon('retry')} />;
  }
  const wh = query.data;
  const bins = (wh.locations ?? []).filter((l) => l.isActive !== false);
  const tk = typeKey(wh.type);

  return (
    <div className="maher-stagger space-y-5">
      <DetailHero
        back={{ label: ti('warehouses'), href: '/admin/warehouses' }}
        LinkComponent={Link}
        code={<Ltr>{wh.code}</Ltr>}
        title={localizedName(locale, wh, wh.nameEn)}
        status={tk ? { label: ti(tk), tone: 'neutral' } : undefined}
        facts={[
          { label: ti('bins'), value: String(bins.length), ltr: true },
          ...(wh.isDefault ? [{ label: tCommon('default'), value: tCommon('yes') }] : []),
        ]}
        primary={
          bins.length ? (
            <Button leadingIcon={<Printer className="h-4 w-4" />} onClick={() => openPdf({ path: `/api/v1/warehouses/${wh.id}/locations/label-sheet`, documentName: `${wh.code} · ${ti('binLabels')}`, filename: `bins-${wh.code}.pdf` })}>
              {ti('printBinLabels')}
            </Button>
          ) : undefined
        }
      />

      <InventoryScanBar />

      <Board tone="neutral">
        <Board.Header title={ti('bins')} description={ti('binsHint')} meta={<span className="tabular-nums">{bins.length}</span>} />
        {bins.length === 0 ? (
          <Board.Empty title={ti('noBins')} />
        ) : (
          <Board.Body>
            <ul className="m-0 grid list-none gap-4 p-0 sm:grid-cols-2 xl:grid-cols-3">
              {bins.map((loc) => (
                <li key={loc.id} className="flex items-start gap-4 rounded-[14px] border border-[var(--maher-border)] bg-[var(--maher-surface)] p-4">
                  {loc.qrCode ? <QrDisplay value={loc.qrCode} size={96} /> : <Stamp tone="neutral" />}
                  <div className="min-w-0 flex-1">
                    <p className="m-0 flex flex-wrap items-center gap-1.5 text-[14px] font-semibold text-[var(--maher-text-primary)]">
                      <Ltr>{loc.code}</Ltr>
                      {loc.isDefault ? (
                        <Stamp tone="brand" size="sm">
                          {tCommon('default')}
                        </Stamp>
                      ) : null}
                    </p>
                    {loc.name && loc.name !== loc.code ? <p className="m-0 mt-0.5 text-[13px] text-[var(--maher-text-secondary)]">{loc.name}</p> : null}
                    {loc.qrCode ? (
                      <p className="m-0 mt-1 text-[11px] text-[var(--maher-text-tertiary)]">
                        <Ltr>{loc.qrCode}</Ltr>
                      </p>
                    ) : null}
                    <Button size="sm" variant="secondary" className="mt-3" leadingIcon={<FileText className="h-3.5 w-3.5" />} onClick={() => openPdf({ path: `/api/v1/warehouses/${wh.id}/locations/${loc.id}/qr-label`, documentName: loc.code, filename: `bin-${loc.code}.pdf` })}>
                      {ti('printLabel')}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </Board.Body>
        )}
      </Board>
      {pdfDialog}
    </div>
  );
}
