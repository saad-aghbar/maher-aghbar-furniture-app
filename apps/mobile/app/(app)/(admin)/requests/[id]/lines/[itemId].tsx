import { useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/auth/AuthProvider';
import { FactoryLineDeskScreen } from '@/features/requests/FactoryLineDeskScreen';
import { PermissionGate } from '@/navigation/PermissionGate';

export default function AdminRequestLineRoute() {
  const { user } = useAuth();
  const { id, itemId } = useLocalSearchParams<{ id: string; itemId: string }>();
  return (
    <PermissionGate user={user} require="request.read" mode="all">
      <FactoryLineDeskScreen mode="rfq" requestId={String(id)} itemId={String(itemId)} />
    </PermissionGate>
  );
}
