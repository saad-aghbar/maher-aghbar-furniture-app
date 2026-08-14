import { PermissionGate } from '@/navigation/PermissionGate';
import { useAuth } from '@/auth/AuthProvider';
import { StaffTypesListScreen } from '@/features/users/StaffTypesListScreen';

export default function AdminStaffTypesRoute() {
  const { user } = useAuth();
  return (
    <PermissionGate user={user} require="role.manage" mode="all">
      <StaffTypesListScreen />
    </PermissionGate>
  );
}
