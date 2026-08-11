import { useAuth } from '@/auth/AuthProvider';
import { DealerStatementScreen } from '@/features/account/DealerStatementScreen';
import { PermissionGate } from '@/navigation/PermissionGate';

export default function CustomerStatementRoute() {
  const { user } = useAuth();
  return (
    <PermissionGate user={user} require="statement.read" mode="all">
      <DealerStatementScreen />
    </PermissionGate>
  );
}
