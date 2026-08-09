import { useAuth } from '@/auth/AuthProvider';
import { PermissionGate } from '@/navigation/PermissionGate';
import { AiIntakeListScreen } from '@/features/ai-intake/AiIntakeListScreen';

export default function AdminAiIntakeListRoute() {
  const { user } = useAuth();
  return (
    <PermissionGate user={user} require="ai-intake.read" mode="all">
      <AiIntakeListScreen />
    </PermissionGate>
  );
}
