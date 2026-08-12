import { useLocalSearchParams } from 'expo-router';
import type { Href } from 'expo-router';
import { PermissionGate } from '@/navigation/PermissionGate';
import { useAuth } from '@/auth/AuthProvider';
import { WorkflowDetailScreen } from '@/features/workflow/WorkflowDetailScreen';

export default function AdminWorkflowDetailRoute() {
  const { user } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <PermissionGate
      user={user}
      require={['production.workflow.read', 'production-order.update']}
      mode="any"
    >
      <WorkflowDetailScreen
        workflowId={String(id)}
        backFallback={'/(app)/(admin)/production/workflow' as Href}
      />
    </PermissionGate>
  );
}
