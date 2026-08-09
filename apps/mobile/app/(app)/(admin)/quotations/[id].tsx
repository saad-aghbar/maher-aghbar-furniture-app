import { useLocalSearchParams } from 'expo-router';
import { AdminQuotationDetailScreen } from '@/features/quotations/AdminQuotationDetailScreen';

/** Deep links prefer the RFQ workspace when the quote belongs to a request. */
export default function AdminQuotationDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <AdminQuotationDetailScreen
      quotationId={String(id ?? '')}
      preferWorkspace
    />
  );
}
