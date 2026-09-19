'use client';

import { FactoryLineDesk } from '@/features/factory-line/factory-line-desk';

export default function RequestLineDeskPage({
  params,
}: {
  params: { id: string; itemId: string };
}) {
  return <FactoryLineDesk mode="rfq" parentId={params.id} lineId={params.itemId} />;
}
