'use client';

import { ProductionHub } from '@/components/production/production-hub/production-hub';
import { BoardSkeleton } from '@maher/ui';
import { Suspense } from 'react';

export default function ProductionDetailPage({ params }: { params: { id: string } }) {
  return (
    <Suspense fallback={<BoardSkeleton rows={6} />}>
      <ProductionHub id={params.id} />
    </Suspense>
  );
}
