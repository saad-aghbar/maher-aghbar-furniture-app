'use client';

import { ProductHub } from '@/components/catalog/product-hub/product-hub';
import { BoardSkeleton } from '@maher/ui';
import { useParams } from 'next/navigation';
import { Suspense } from 'react';

export default function ProductDetailPage() {
  const params = useParams<{ id: string }>();
  return (
    <Suspense fallback={<BoardSkeleton rows={6} />}>
      <ProductHub id={params.id} />
    </Suspense>
  );
}
