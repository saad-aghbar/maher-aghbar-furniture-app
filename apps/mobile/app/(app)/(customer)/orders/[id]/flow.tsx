import { useLocalSearchParams } from 'expo-router';
import { OrderProductionFlowScreen } from '@/features/production-flow/OrderProductionFlowScreen';

function firstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return String(value[0] ?? '');
  return String(value ?? '');
}

export default function DealerOrderFlowRoute() {
  const { id, po } = useLocalSearchParams<{ id: string; po?: string }>();
  const salesOrderId = firstParam(id);
  const selected = firstParam(po);
  return (
    <OrderProductionFlowScreen
      role="dealer"
      salesOrderId={salesOrderId}
      selectedProductionOrderId={selected || null}
      orderBackFallback={`/(app)/(customer)/orders/${salesOrderId}` as never}
    />
  );
}
