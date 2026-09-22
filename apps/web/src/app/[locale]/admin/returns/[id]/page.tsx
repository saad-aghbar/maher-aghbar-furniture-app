'use client';

import { ReturnDesk } from '@/components/returns/return-desk';
import { PermissionGate } from '@/session/permission-gate';

export default function AdminReturnDetailPage({ params }: { params: { id: string } }) {
  return (
    <PermissionGate anyOf={['return.read']}>
      <ReturnDesk id={params.id} />
    </PermissionGate>
  );
}
