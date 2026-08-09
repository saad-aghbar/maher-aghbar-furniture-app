import { useLocalSearchParams } from 'expo-router';
import { OrderDetailScreen } from '@/features/sales-orders/OrderDetailScreen';

export default function AdminOrderDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <OrderDetailScreen orderId={String(id ?? '')} variant="admin" />;
}
