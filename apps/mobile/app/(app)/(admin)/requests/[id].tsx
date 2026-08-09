import { useLocalSearchParams } from 'expo-router';
import { AdminRequestDetailScreen } from '@/features/requests/AdminRequestDetailScreen';
import type { RfqWorkspaceStage } from '@/features/requests/components/RfqStageRail';

function parseStage(value: string | string[] | undefined): RfqWorkspaceStage {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === 'quotation' || raw === 'order' || raw === 'request') return raw;
  return 'request';
}

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
      initialStage={parseStage(stage)}
      initialQuoteId={quoteId ? String(quoteId) : undefined}
    />
  );
}
