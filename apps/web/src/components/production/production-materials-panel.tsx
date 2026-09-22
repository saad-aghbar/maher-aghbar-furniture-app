'use client';

import { InventoryItemThumb } from '@/components/admin/inventory-item-thumb';
import { Board, DataBoard, Meter, Stamp, type BoardTone, type DataColumn } from '@maher/ui';
import { localizedName } from '@maher/i18n';
import { useLocale, useTranslations } from 'next-intl';

export type ProductionMaterialUsageStatus =
  | 'ON_TARGET'
  | 'OVER'
  | 'UNDER'
  | 'EXTRA'
  | 'UNUSED';

export type ProductionMaterialUsageRow = {
  inventoryItemId: string;
  sku: string;
  nameEn: string;
  nameAr: string;
  nameHe?: string | null;
  unit: string;
  imageUrl?: string | null;
  itemClass?: string | null;
  assignedQty: number;
  usedQty: number;
  returnedQty: number;
  scrapQty: number;
  varianceQty: number;
  status: ProductionMaterialUsageStatus;
  isExtra?: boolean;
  tasks?: Array<{
    taskId: string;
    taskNumber: string;
    stageCode?: string | null;
    actualQty: number;
    expectedQty: number;
  }>;
};

type Props = {
  materials: ProductionMaterialUsageRow[];
};

function statusLabel(
  status: ProductionMaterialUsageStatus,
  tp: ReturnType<typeof useTranslations>,
): string {
  switch (status) {
    case 'OVER':
      return tp('usageStatusOver');
    case 'UNDER':
      return tp('usageStatusUnder');
    case 'EXTRA':
      return tp('usageStatusExtra');
    case 'UNUSED':
      return tp('usageStatusUnused');
    default:
      return tp('usageStatusOnTarget');
  }
}

function statusTone(status: ProductionMaterialUsageStatus): BoardTone {
  switch (status) {
    case 'OVER':
      return 'error';
    case 'UNDER':
      return 'warning';
    case 'EXTRA':
      return 'info';
    case 'UNUSED':
      return 'neutral';
    default:
      return 'success';
  }
}

export function ProductionMaterialsPanel({ materials }: Props) {
  const tp = useTranslations('production');
  const locale = useLocale();
  const columns: DataColumn<ProductionMaterialUsageRow>[] = [
    {
      key: 'material',
      header: tp('materials'),
      cell: (row) => {
        const name = localizedName(locale, { nameEn: row.nameEn, nameAr: row.nameAr, nameHe: row.nameHe });
        return (
          <span className="flex items-center gap-3">
            <InventoryItemThumb src={row.imageUrl} alt={name} size={36} />
            <span className="min-w-0">
              <span className="block truncate font-semibold text-[var(--maher-text-primary)]">{name}</span>
              <span className="block truncate text-[12px] text-[var(--maher-text-tertiary)]" dir="ltr">
                {[row.sku, row.unit].filter(Boolean).join(' · ')}
                {row.tasks?.length ? ` · ${row.tasks.map((t) => `${t.stageCode ?? t.taskNumber}: ${t.actualQty}`).join(' · ')}` : ''}
              </span>
            </span>
          </span>
        );
      },
    },
    { key: 'assigned', header: tp('usageAssigned'), numeric: true, hideBelow: 'md', cell: (row) => String(row.assignedQty) },
    {
      key: 'used',
      header: tp('usageUsed'),
      width: '180px',
      cell: (row) => <Meter value={Math.min(row.usedQty, Math.max(row.assignedQty, row.usedQty))} max={Math.max(1, row.assignedQty || row.usedQty)} size="sm" valueLabel={String(row.usedQty)} tone={statusTone(row.status)} />,
    },
    { key: 'returned', header: tp('usageReturned'), numeric: true, hideBelow: 'lg', cell: (row) => String(row.returnedQty) },
    { key: 'variance', header: tp('usageVariance'), numeric: true, hideBelow: 'md', cell: (row) => <span className={row.varianceQty > 0 ? 'font-semibold text-[var(--maher-error)]' : row.varianceQty < 0 ? 'text-[var(--maher-warning)]' : ''}>{row.varianceQty > 0 ? `+${row.varianceQty}` : String(row.varianceQty)}</span> },
    { key: 'status', header: tp('usageStatus'), cell: (row) => <Stamp tone={statusTone(row.status)} size="sm">{statusLabel(row.status, tp)}</Stamp> },
  ];

  return (
    <DataBoard<ProductionMaterialUsageRow>
      aria-label={tp('materials')}
      title={tp('materials')}
      description={tp('usageHint')}
      tone="brand"
      columns={columns}
      rows={materials}
      rowKey={(r) => r.inventoryItemId}
      mobileRow={(row) => ({ leading: <InventoryItemThumb src={row.imageUrl} alt="" size={36} />, title: localizedName(locale, { nameEn: row.nameEn, nameAr: row.nameAr, nameHe: row.nameHe }), meta: `${row.usedQty} / ${row.assignedQty} ${row.unit}`, trailing: <Stamp tone={statusTone(row.status)} size="sm">{statusLabel(row.status, tp)}</Stamp> })}
      empty={<Board.Empty title={tp('usageEmptyTitle')} description={tp('usageEmptyBody')} />}
    />
  );
}
