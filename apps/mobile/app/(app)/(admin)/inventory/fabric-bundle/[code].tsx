import { useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/auth/AuthProvider';
import { FabricDetailScreen } from '@/features/fabric/FabricDetailScreen';
import { PermissionGate } from '@/navigation/PermissionGate';

export default function AdminFabricBundleRoute() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const { user } = useAuth();
  return (
    <PermissionGate user={user} require="inventory.read" mode="all">
      <FabricDetailScreen code={String(code ?? '')} />
    </PermissionGate>
  );
}
