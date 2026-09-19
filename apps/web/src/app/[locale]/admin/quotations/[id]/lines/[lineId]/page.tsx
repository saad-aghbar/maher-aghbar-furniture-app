'use client';

import { FactoryLineDesk } from '@/features/factory-line/factory-line-desk';

export default function QuotationLineDeskPage({
  params,
}: {
  params: { id: string; lineId: string };
}) {
  return <FactoryLineDesk mode="quote" parentId={params.id} lineId={params.lineId} />;
}
