import { useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/auth/AuthProvider';
import { AdminQuotationDetailScreen } from '@/features/quotations/AdminQuotationDetailScreen';
import { PermissionGate } from '@/navigation/PermissionGate';

/** Deep links prefer the RFQ workspace when the quote belongs to a request. */
export default function AdminQuotationDetailRoute() {
  const { user } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <PermissionGate user={user} require="quotation.read" mode="all">
      <AdminQuotationDetailScreen
        quotationId={String(id ?? '')}
        preferWorkspace
      />
    </PermissionGate>
  );
}
