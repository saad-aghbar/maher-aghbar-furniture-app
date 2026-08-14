import { useLocalSearchParams } from 'expo-router';
import { PermissionGate } from '@/navigation/PermissionGate';
import { useAuth } from '@/auth/AuthProvider';
import { StaffTypeEditorScreen } from '@/features/users/StaffTypeEditorScreen';

export default function AdminStaffTypeEditorRoute() {
  const { user } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <PermissionGate user={user} require="role.manage" mode="all">
      <StaffTypeEditorScreen id={id ?? 'new'} />
    </PermissionGate>
  );
}
