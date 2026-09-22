'use client';

import type { ManagementSummary } from '@/lib/management-summary';
import { tileValues } from '@/lib/management-summary';
import { Skeleton } from '@maher/ui';
import { useMemo } from 'react';
import {
  ActivityBoard,
  AttentionBoard,
  ExceptionsBoard,
  FloorFlowBoard,
  MoneyBoard,
  OutboundBoard,
  ProductionLoadBoard,
  QualityBoard,
  QuickJumpsBoard,
  ShiftBoard,
  SupplyBoard,
  WorkersBoard,
} from './desk';

export function ManagementDashboardSkeleton() {
  return (
    <div className="space-y-5 pb-8">
      <Skeleton className="h-52 w-full rounded-[18px]" />
      <div className="grid gap-5 xl:grid-cols-12">
        <div className="space-y-5 xl:col-span-7">
          <Skeleton className="h-64 rounded-[18px]" />
          <Skeleton className="h-56 rounded-[18px]" />
          <Skeleton className="h-72 rounded-[18px]" />
        </div>
        <div className="space-y-5 xl:col-span-5">
          <Skeleton className="h-40 rounded-[18px]" />
          <Skeleton className="h-56 rounded-[18px]" />
          <Skeleton className="h-64 rounded-[18px]" />
        </div>
      </div>
    </div>
  );
}

/**
 * The management desk. Two columns on xl (7 / 5); each column's last board is
 * elastic so both end flush. Boards hide zero rows, teach when empty, or fold
 * into a neighbour — no blank tiles.
 */
export function ManagementDashboard({
  data,
  firstName,
}: {
  data: ManagementSummary;
  firstName: string | null;
}) {
  const exceptionsAllClear = useMemo(
    () => !data.exceptions || tileValues(data.exceptions).every((tile) => tile.count === 0),
    [data.exceptions],
  );

  return (
    <div className="maher-stagger space-y-5 pb-8">
      <ShiftBoard data={data} firstName={firstName} />

      <div className="grid gap-5 xl:grid-cols-12 xl:items-stretch">
        <div className="flex flex-col gap-5 xl:col-span-7">
          <AttentionBoard data={data} />
          <FloorFlowBoard data={data} />
          <ProductionLoadBoard data={data} />
          <OutboundBoard data={data} />
          <QuickJumpsBoard />
        </div>

        <div className="flex flex-col gap-5 xl:col-span-5">
          {data.workers ? <WorkersBoard workers={data.workers} /> : null}
          {data.quality ? (
            <QualityBoard
              quality={data.quality}
              series={data.series}
              exceptionsAllClear={Boolean(data.exceptions) && exceptionsAllClear}
            />
          ) : null}
          <SupplyBoard data={data} />
          {data.finance ? (
            <MoneyBoard finance={data.finance} manufacturing={data.manufacturing} series={data.series} />
          ) : null}
          {data.exceptions && !exceptionsAllClear ? <ExceptionsBoard exceptions={data.exceptions} /> : null}
          <ActivityBoard items={data.activity} />
        </div>
      </div>
    </div>
  );
}
