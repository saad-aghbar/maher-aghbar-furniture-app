import { useLocalSearchParams } from 'expo-router';
import { AdminRequestDetailScreen } from '@/features/requests/AdminRequestDetailScreen';
import { parseRfqWorkspaceStage } from '@/features/requests/rfqWorkspaceStage';

/** Admin opens unapproved orders from Orders — single RFQ workspace. */
export default function AdminRequestDetailRoute() {
  const { id, stage, quoteId } = useLocalSearchParams<{
    id: string;
    stage?: string;
    quoteId?: string;
  }>();
  return (
    <AdminRequestDetailScreen
      requestId={String(id)}
      initialStage={parseRfqWorkspaceStage(stage)}
      initialQuoteId={quoteId ? String(quoteId) : undefined}
    />
  );
}
