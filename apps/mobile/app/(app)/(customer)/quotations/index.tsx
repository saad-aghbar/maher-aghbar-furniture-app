import { useAuth } from '@/auth/AuthProvider';
import { DealerQuotationsDeskHost } from '@/features/quotations/DealerQuotationsDeskHost';
import { PermissionGate } from '@/navigation/PermissionGate';

export default function DealerQuotationsRoute() {
  const { user } = useAuth();
  return (
    <PermissionGate user={user} require="quotation.read" mode="all">
      <DealerQuotationsDeskHost />
    </PermissionGate>
  );
}
