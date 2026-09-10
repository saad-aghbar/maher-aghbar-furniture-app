import { useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/auth/AuthProvider';
import { ReceiveGoodsScreen } from '@/features/purchasing/ReceiveGoodsScreen';
import { PermissionGate } from '@/navigation/PermissionGate';

export default function AdminReceiveGoodsRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  return (
    <PermissionGate user={user} require="inventory.receive" mode="all">
      <ReceiveGoodsScreen orderId={String(id ?? '')} />
    </PermissionGate>
  );
}
