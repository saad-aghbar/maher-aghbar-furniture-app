import { useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/auth/AuthProvider';
import { DealerCustomItemScreen } from '@/features/catalog/DealerCustomItemScreen';
import { parseDeepLinkText } from '@/features/catalog/newOrderDeepLink';
import { PermissionGate } from '@/navigation/PermissionGate';

export default function CustomerCustomItemRoute() {
  const { user } = useAuth();
  const { lineId } = useLocalSearchParams<{ lineId?: string }>();
  return (
    <PermissionGate user={user} require="request.create" mode="all">
      <DealerCustomItemScreen lineId={parseDeepLinkText(lineId)} />
    </PermissionGate>
  );
}
