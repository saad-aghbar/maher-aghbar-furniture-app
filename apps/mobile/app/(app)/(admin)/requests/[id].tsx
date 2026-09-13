import { useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/auth/AuthProvider';
import { AdminRequestDetailScreen } from '@/features/requests/AdminRequestDetailScreen';
import { parseRfqWorkspaceStage } from '@/features/requests/rfqWorkspaceStage';
import { PermissionGate } from '@/navigation/PermissionGate';

/** Admin opens unapproved orders from Orders — single RFQ workspace. */
export default function AdminRequestDetailRoute() {
  const { user } = useAuth();
  const { id, stage, quoteId } = useLocalSearchParams<{
    id: string;
    stage?: string;
    quoteId?: string;
  }>();
  return (
    <PermissionGate user={user} require="request.read" mode="all">
      <AdminRequestDetailScreen
        requestId={String(id)}
        initialStage={parseRfqWorkspaceStage(stage)}
        initialQuoteId={quoteId ? String(quoteId) : undefined}
      />
    </PermissionGate>
  );
}
