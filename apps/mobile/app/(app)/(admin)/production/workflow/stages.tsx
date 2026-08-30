import { Stack } from 'expo-router';
import { PermissionGate } from '@/navigation/PermissionGate';
import { useAuth } from '@/auth/AuthProvider';
import { ManageStagesScreen } from '@/features/workflow/ManageStagesScreen';

export default function AdminManageStagesRoute() {
  const { user } = useAuth();
  return (
    <>
      <Stack.Screen options={{ headerBackButtonMenuEnabled: false }} />
      <PermissionGate
        user={user}
        require={['production.workflow.read', 'production-order.update']}
        mode="any"
      >
        <ManageStagesScreen />
      </PermissionGate>
    </>
  );
}
