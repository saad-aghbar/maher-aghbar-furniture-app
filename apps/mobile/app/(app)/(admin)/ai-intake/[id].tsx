import { useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/auth/AuthProvider';
import { PermissionGate } from '@/navigation/PermissionGate';
import { AiReviewScreen } from '@/features/ai-intake/AiReviewScreen';

export default function AdminAiIntakeDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  return (
    <PermissionGate user={user} require="ai-intake.read" mode="all">
      <AiReviewScreen jobId={String(id ?? '')} />
    </PermissionGate>
  );
}
