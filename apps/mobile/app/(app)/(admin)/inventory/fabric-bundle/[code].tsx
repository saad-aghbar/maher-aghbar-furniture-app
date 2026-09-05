import { useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/auth/AuthProvider';
import { FabricBundleDetailScreen } from '@/features/inventory/FabricBundleDetailScreen';
import { PermissionGate } from '@/navigation/PermissionGate';

export default function AdminFabricBundleRoute() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const { user } = useAuth();
  return (
    <PermissionGate user={user} require="inventory.read" mode="all">
      <FabricBundleDetailScreen code={String(code ?? '')} />
    </PermissionGate>
  );
}
