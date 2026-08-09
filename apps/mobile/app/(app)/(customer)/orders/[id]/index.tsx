import { useLocalSearchParams } from 'expo-router';
import { OrderDetailScreen } from '@/features/sales-orders/OrderDetailScreen';

export default function CustomerOrderDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <OrderDetailScreen orderId={String(id ?? '')} variant="dealer" />;
}
