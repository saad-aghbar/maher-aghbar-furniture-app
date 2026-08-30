import { useLocalSearchParams, type Href } from 'expo-router';
import { useAuth } from '@/auth/AuthProvider';
import { DealerQuotationDetailScreen } from '@/features/quotations/DealerQuotationDetailScreen';
import { PermissionGate } from '@/navigation/PermissionGate';

export default function DealerQuotationDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  return (
    <PermissionGate user={user} require="quotation.read" mode="all">
      <DealerQuotationDetailScreen
        quotationId={String(id ?? '')}
        backFallback={'/(app)/(customer)/quotations' as Href}
      />
    </PermissionGate>
  );
}
