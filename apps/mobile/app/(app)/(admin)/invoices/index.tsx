import { type Href } from 'expo-router';
import { useAuth } from '@/auth/AuthProvider';
import { InvoicesListScreen } from '@/features/invoices/InvoicesListScreen';
import { PermissionGate } from '@/navigation/PermissionGate';

export default function AdminInvoicesRoute() {
  const { user } = useAuth();
  return (
    <PermissionGate user={user} require="invoice.read" mode="all">
      <InvoicesListScreen
        detailHref={(id) => `/(app)/(admin)/invoices/${id}` as Href}
        adminControls
      />
    </PermissionGate>
  );
}
