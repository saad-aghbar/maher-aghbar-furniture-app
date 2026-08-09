import { useLocalSearchParams } from 'expo-router';
import { ProductionFlowScreen } from '@/features/production-flow/ProductionFlowScreen';

export default function DealerOrderFlowRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <ProductionFlowScreen
      role="dealer"
      source="sales-order"
      id={String(id ?? '')}
      backFallback={`/(app)/(customer)/orders/${id}` as never}
    />
  );
}
