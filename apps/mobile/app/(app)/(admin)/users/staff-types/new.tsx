import { PermissionGate } from '@/navigation/PermissionGate';
import { useAuth } from '@/auth/AuthProvider';
import { StaffTypeEditorScreen } from '@/features/users/StaffTypeEditorScreen';

export default function AdminNewStaffTypeRoute() {
  const { user } = useAuth();
  return (
    <PermissionGate user={user} require="role.manage" mode="all">
      <StaffTypeEditorScreen id="new" />
    </PermissionGate>
  );
}
