import { useLocalSearchParams } from 'expo-router';
import { ProductDetailScreen } from '@/features/catalog/ProductDetailScreen';

export default function CustomerProductDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ProductDetailScreen productId={String(id ?? '')} variant="dealer" />;
}
