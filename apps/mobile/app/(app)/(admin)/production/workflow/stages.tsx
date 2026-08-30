import { PermissionGate } from '@/navigation/PermissionGate';
import { useAuth } from '@/auth/AuthProvider';
import { StageLibraryScreen } from '@/features/workflow/StageLibraryScreen';

export default function AdminWorkflowStagesRoute() {
  const { user } = useAuth();
  return (
    <PermissionGate
      user={user}
      require={[
        'production.workflow.read',
        'production-order.update',
        'production.workflow.manage',
        'production.workflow.stage.manage',
      ]}
      mode="any"
    >
      <StageLibraryScreen />
    </PermissionGate>
  );
}
