import { useLocalSearchParams } from 'expo-router';
import { PermissionGate } from '@/navigation/PermissionGate';
import { useAuth } from '@/auth/AuthProvider';
import { ProductWorkflowTimesScreen } from '@/features/workflow/ProductWorkflowTimesScreen';

function firstParam(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw?.trim() ?? '';
}

export default function ProductWorkflowTimesRoute() {
  const { user } = useAuth();
  const { id, workflowId } = useLocalSearchParams<{ id: string; workflowId?: string }>();
  const productId = firstParam(id);
  const wfId = firstParam(workflowId);

  return (
    <PermissionGate user={user} require="catalog.manage" mode="all">
      <ProductWorkflowTimesScreen
        productId={productId}
        workflowId={wfId}
        backFallback={`/(app)/(admin)/products/${productId}`}
      />
    </PermissionGate>
  );
}
