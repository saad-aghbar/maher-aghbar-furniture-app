import { useLocalSearchParams } from 'expo-router';
import { CostOrderDossierScreen } from '@/features/reports/CostOrderDossierScreen';

export default function OrderCostDossierRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <CostOrderDossierScreen id={String(id ?? '')} />;
}
