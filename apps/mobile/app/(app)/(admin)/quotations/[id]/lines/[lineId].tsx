import { useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/auth/AuthProvider';
import { FactoryLineDeskScreen } from '@/features/requests/FactoryLineDeskScreen';
import { PermissionGate } from '@/navigation/PermissionGate';

export default function AdminQuotationLineRoute() {
  const { user } = useAuth();
  const { id, lineId } = useLocalSearchParams<{ id: string; lineId: string }>();
  return (
    <PermissionGate user={user} require="quotation.read" mode="all">
      <FactoryLineDeskScreen mode="quote" quotationId={String(id)} lineId={String(lineId)} />
    </PermissionGate>
  );
}
