import { type Href } from 'expo-router';
import { useAuth } from '@/auth/AuthProvider';
import { InvoicesDeskHost } from '@/features/invoices/InvoicesDeskHost';
import { PermissionGate } from '@/navigation/PermissionGate';

export default function DealerInvoicesRoute() {
  const { user } = useAuth();
  return (
    <PermissionGate user={user} require="invoice.read" mode="all">
      <InvoicesDeskHost
        compactHref={(id) => `/(app)/(customer)/invoices/${id}` as Href}
        listBackFallback={'/(app)/(customer)/(tabs)/account' as Href}
        detailBackFallback={'/(app)/(customer)/invoices' as Href}
        adminControls={false}
      />
    </PermissionGate>
  );
}
