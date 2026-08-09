import { useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/auth/AuthProvider';
import { PermissionGate } from '@/navigation/PermissionGate';
import { NewOrderScreen } from '@/features/requests/NewOrderScreen';

/**
 * Query params `productId` / `qty` are read inside NewOrderScreen.
 * This route keeps the permission gate at the tab edge.
 */
export default function CustomerNewOrder() {
  const { user } = useAuth();
  // Ensure expo-router tracks search params for this tab route.
  useLocalSearchParams<{ productId?: string; qty?: string }>();
  return (
    <PermissionGate user={user} require="request.create" mode="all">
      <NewOrderScreen />
    </PermissionGate>
  );
}
