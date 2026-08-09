import { PermissionGate } from '@/navigation/PermissionGate';
import { useAuth } from '@/auth/AuthProvider';
import { UsersListScreen } from '@/features/users';

export default function AdminUsersRoute() {
  const { user } = useAuth();
  return (
    <PermissionGate user={user} require="user.manage" mode="all">
      <UsersListScreen />
    </PermissionGate>
  );
}
