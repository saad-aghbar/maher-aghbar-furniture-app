import { useLocalSearchParams } from 'expo-router';
import { ProductionFlowScreen } from '@/features/production-flow/ProductionFlowScreen';

export default function AdminOrderFlowRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <ProductionFlowScreen
      role="admin"
      source="sales-order"
      id={String(id ?? '')}
      backFallback={`/(app)/(admin)/orders/${id}` as never}
    />
  );
}
