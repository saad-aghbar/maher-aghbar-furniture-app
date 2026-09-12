import { useLocalSearchParams } from 'expo-router';
import { CostReturnDossierScreen } from '@/features/reports/CostReturnDossierScreen';

export default function ReturnCostDossierRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <CostReturnDossierScreen id={String(id ?? '')} />;
}
