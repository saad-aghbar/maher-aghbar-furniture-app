import { BoardSkeleton } from '@maher/ui';
import { Suspense } from 'react';
import InventoryPage from './inventory-client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function InventoryRoute({ searchParams }: { searchParams?: { group?: string | string[] } }) {
  const group = typeof searchParams?.group === 'string' ? searchParams.group : null;
  return (
    <Suspense fallback={<BoardSkeleton rows={6} />}>
      <InventoryPage initialGroup={group} />
    </Suspense>
  );
}
