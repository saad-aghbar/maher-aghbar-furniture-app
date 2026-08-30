import { useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/auth/AuthProvider';
import { PermissionGate } from '@/navigation/PermissionGate';
import { DeliveryLoadSheetScreen } from '@/features/delivery-load';

export default function AdminDeliveryLoadRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  return (
    <PermissionGate user={user} require="delivery.read" mode="all">
      <DeliveryLoadSheetScreen deliveryId={String(id ?? '')} />
    </PermissionGate>
  );
}
