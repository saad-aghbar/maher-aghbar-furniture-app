import { useAuth } from '@/auth/AuthProvider';
import { InvoicesDeskHost } from '@/features/invoices/InvoicesDeskHost';
import { PermissionGate } from '@/navigation/PermissionGate';

export default function AdminInvoicesRoute() {
  const { user } = useAuth();
  return (
    <PermissionGate user={user} require="invoice.read" mode="all">
      <InvoicesDeskHost />
    </PermissionGate>
  );
}
