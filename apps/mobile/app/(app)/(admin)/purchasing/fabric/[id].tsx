import { useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/auth/AuthProvider';
import { FabricProcurementDetailScreen } from '@/features/purchasing/FabricProcurementDetailScreen';
import { PermissionGate } from '@/navigation/PermissionGate';

export default function AdminFabricProcurementRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  return (
    <PermissionGate user={user} require="fabric.procurement.read" mode="all">
      <FabricProcurementDetailScreen procurementId={String(id ?? '')} />
    </PermissionGate>
  );
}
