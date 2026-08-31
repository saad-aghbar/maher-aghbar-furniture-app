import { Redirect, useLocalSearchParams, type Href } from 'expo-router';
import { useProductionOrderQuery } from '@/features/production/query';
import { ProductionListSkeleton } from '@/features/production/components/ProductionSkeleton';
import { AppScreen } from '@/components/layout/AppScreen';
import { can } from '@maher/permissions';
import { useAuth } from '@/auth/AuthProvider';

/**
 * Legacy PO setup deep link:
 * - Pre–Release to factory → SO production-plan (Orders Preparing)
 * - Post-release → Production detail (locked plan + execution)
 */
export default function AdminProductionSetupRedirect() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const canRead = can(user, 'production-order.read');
  const query = useProductionOrderQuery(String(id ?? ''), canRead && Boolean(id));

  if (query.isLoading) {
    return (
      <AppScreen>
        <ProductionListSkeleton />
      </AppScreen>
    );
  }

  const po = query.data;
  const soId = po?.salesOrder?.id;
  const released = Boolean(
    po?.releasedToFactoryAt ||
      po?.actualStartDate ||
      ['IN_PROGRESS', 'ON_HOLD', 'QUALITY_CHECK', 'READY_FOR_PACKAGING', 'READY_FOR_DELIVERY', 'COMPLETED'].includes(
        String(po?.status ?? '').toUpperCase(),
      ),
  );

  if (!released && soId) {
    return (
      <Redirect href={`/(app)/(admin)/orders/${soId}/production-plan` as Href} />
    );
  }

  return (
    <Redirect href={`/(app)/(admin)/production/${String(id ?? '')}` as Href} />
  );
}
