import { type Href } from 'expo-router';
import { useAuth } from '@/auth/AuthProvider';
import { ReturnsListScreen } from '@/features/returns/ReturnsListScreen';
import { PermissionGate } from '@/navigation/PermissionGate';

export default function AdminReturnsRoute() {
  const { user } = useAuth();
  return (
    <PermissionGate user={user} require="sales-order.read" mode="all">
      <ReturnsListScreen
        detailHref={(id) => `/(app)/(admin)/returns/${id}` as Href}
        adminControls
      />
    </PermissionGate>
  );
}
