import { useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/auth/AuthProvider';
import { CostReturnDossierScreen } from '@/features/reports/CostReturnDossierScreen';
import { PermissionGate } from '@/navigation/PermissionGate';

export default function ReturnCostDossierRoute() {
  const { user } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <PermissionGate
      user={user}
      require={['inventory.cost.read', 'report.inventory.read']}
      mode="any"
    >
      <CostReturnDossierScreen id={String(id ?? '')} />
    </PermissionGate>
  );
}
