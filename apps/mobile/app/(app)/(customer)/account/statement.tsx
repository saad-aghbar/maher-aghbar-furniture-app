import { useAuth } from '@/auth/AuthProvider';
import { DealerAccountScreen } from '@/features/account/DealerAccountScreen';
import { PermissionGate } from '@/navigation/PermissionGate';

export default function DealerStatementRoute() {
  const { user } = useAuth();
  return (
    <PermissionGate user={user} require="statement.read" mode="all">
      <DealerAccountScreen />
    </PermissionGate>
  );
}
