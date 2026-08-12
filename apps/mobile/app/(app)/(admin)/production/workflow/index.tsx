import { PermissionGate } from '@/navigation/PermissionGate';
import { useAuth } from '@/auth/AuthProvider';
import { WorkflowListScreen } from '@/features/workflow/WorkflowListScreen';

export default function AdminWorkflowListRoute() {
  const { user } = useAuth();
  return (
    <PermissionGate
      user={user}
      require={['production.workflow.read', 'production-order.update']}
      mode="any"
    >
      <WorkflowListScreen />
    </PermissionGate>
  );
}
