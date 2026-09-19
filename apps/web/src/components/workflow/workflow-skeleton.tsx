'use client';

import { Skeleton } from '@maher/ui';

export function WorkflowSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true">
      <Skeleton className="h-10 w-64" />
      <div className="flex flex-col items-center gap-8 rounded-2xl border border-[var(--maher-border)] p-8">
        <Skeleton className="h-14 w-14 rounded-full" />
        <div className="flex gap-10">
          <Skeleton className="h-14 w-14 rounded-full" />
          <Skeleton className="h-14 w-14 rounded-full" />
        </div>
        <Skeleton className="h-14 w-14 rounded-full" />
      </div>
      <Skeleton className="h-24 rounded-xl" />
    </div>
  );
}
