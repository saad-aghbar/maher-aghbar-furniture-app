import { useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/auth/AuthProvider';
import { SupplierInvoiceDetailScreen } from '@/features/purchasing/SupplierInvoiceDetailScreen';
import { PermissionGate } from '@/navigation/PermissionGate';

export default function AdminSupplierInvoiceDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  return (
    <PermissionGate user={user} require="supplier-invoice.read" mode="all">
      <SupplierInvoiceDetailScreen invoiceId={String(id ?? '')} />
    </PermissionGate>
  );
}
