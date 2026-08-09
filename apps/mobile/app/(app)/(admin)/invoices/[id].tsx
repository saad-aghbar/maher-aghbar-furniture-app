import { useLocalSearchParams, type Href } from 'expo-router';
import { useAuth } from '@/auth/AuthProvider';
import { InvoiceDetailScreen } from '@/features/invoices/InvoiceDetailScreen';
import { PermissionGate } from '@/navigation/PermissionGate';

export default function AdminInvoiceDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  return (
    <PermissionGate user={user} require="invoice.read" mode="all">
      <InvoiceDetailScreen
        invoiceId={String(id ?? '')}
        backFallback={'/(app)/(admin)/invoices' as Href}
      />
    </PermissionGate>
  );
}
