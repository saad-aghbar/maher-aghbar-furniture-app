'use client';

import { DealerDossier } from '@/components/customers/dealer-dossier';
import { BoardSkeleton } from '@maher/ui';
import { Suspense } from 'react';

export default function CustomerDetailPage({ params }: { params: { id: string } }) {
  return (
    <Suspense fallback={<BoardSkeleton rows={6} />}>
      <DealerDossier id={params.id} />
    </Suspense>
  );
}
