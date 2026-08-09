import { useLocalSearchParams } from 'expo-router';
import { ProductionFlowScreen } from '@/features/production-flow/ProductionFlowScreen';

export default function AdminProductionFlowRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <ProductionFlowScreen
      role="admin"
      source="production-order"
      id={String(id ?? '')}
      backFallback={`/(app)/(admin)/production/${id}` as never}
    />
  );
}
