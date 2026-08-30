'use client';

import { InventoryItemThumb } from '@/components/admin/inventory-item-thumb';
import { Badge, Card, EmptyState } from '@maher/ui';
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

export function ProductionMaterialsPanel({ materials }: Props) {
  const tp = useTranslations('production');
  const locale = useLocale();

  return (
    <Card className="space-y-4 p-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--maher-brand)]">
          {tp('usageEyebrow')}
        </p>
        <h2 className="text-base font-semibold">{tp('materials')}</h2>
        <p className="text-sm text-text-secondary">{tp('usageHint')}</p>
      </div>

      {materials.length === 0 ? (
        <EmptyState title={tp('usageEmptyTitle')} description={tp('usageEmptyBody')} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-text-tertiary">
                <th className="py-2 pr-3 font-semibold">{tp('materials')}</th>
                <th className="py-2 px-2 font-semibold" dir="ltr">
                  {tp('usageAssigned')}
                </th>
                <th className="py-2 px-2 font-semibold" dir="ltr">
                  {tp('usageUsed')}
                </th>
                <th className="py-2 px-2 font-semibold" dir="ltr">
                  {tp('usageReturned')}
                </th>
                <th className="py-2 px-2 font-semibold" dir="ltr">
                  {tp('usageVariance')}
                </th>
                <th className="py-2 pl-2 font-semibold">{tp('usageStatus')}</th>
              </tr>
            </thead>
            <tbody>
              {materials.map((row) => {
                const name = localizedName(locale, {
                  nameEn: row.nameEn,
                  nameAr: row.nameAr,
                  nameHe: row.nameHe,
                });
                const variance =
                  row.varianceQty > 0 ? `+${row.varianceQty}` : String(row.varianceQty);
                return (
                  <tr key={row.inventoryItemId} className="border-b border-border align-top">
                    <td className="py-3 pr-3">
                      <div className="flex items-start gap-3">
                        <InventoryItemThumb src={row.imageUrl} alt={name} size={40} />
                        <div className="min-w-0">
                          <p className="font-medium">{name}</p>
                          <p className="text-xs text-text-secondary" dir="ltr">
                            {[row.sku, row.unit].filter(Boolean).join(' · ')}
                          </p>
                          {row.tasks && row.tasks.length > 0 ? (
                            <p className="mt-1 text-xs text-text-tertiary">
                              {row.tasks
                                .map((t) =>
                                  t.stageCode
                                    ? `${t.stageCode}: ${t.actualQty}`
                                    : `${t.taskNumber}: ${t.actualQty}`,
                                )
                                .join(' · ')}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-2 tabular-nums" dir="ltr">
                      {row.assignedQty}
                    </td>
                    <td className="py-3 px-2 font-semibold tabular-nums" dir="ltr">
                      {row.usedQty}
                    </td>
                    <td className="py-3 px-2 tabular-nums" dir="ltr">
                      {row.returnedQty}
                    </td>
                    <td className="py-3 px-2 tabular-nums" dir="ltr">
                      {variance}
                    </td>
                    <td className="py-3 pl-2">
                      <Badge>{statusLabel(row.status, tp)}</Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
