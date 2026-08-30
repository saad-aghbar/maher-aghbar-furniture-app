import { useLocalSearchParams } from 'expo-router';
import { can } from '@maher/permissions';
import { useAuth } from '@/auth/AuthProvider';
import { EmptyState } from '@/components/feedback/EmptyState';
import { AppScreen } from '@/components/layout/AppScreen';
import { useLocale } from '@/i18n';
import { InventorySignatureHome } from './components/InventorySignatureHome';
import { INVENTORY_COMPOSITION } from './inventoryComposition';
import { isValidCategoryGroup } from './selectInventory';
import { InventoryGroupsClassicScreen } from './InventoryGroupsClassicScreen';
import type { InventoryCategoryGroup } from './api';
import type { InventoryLifecycle } from './preferWarehouseForReceive';
import type { FinishedBoardScope } from './selectFinishedOrders';

const LIFECYCLES = new Set<InventoryLifecycle>(['materials', 'semiFinished', 'finished']);
const SCOPES = new Set<FinishedBoardScope>(['inWarehouse', 'history']);

export function InventoryGroupsScreen() {
  const { user } = useAuth();
  const { t } = useLocale();
  const params = useLocalSearchParams<{
    group?: string;
    lifecycle?: string;
    scope?: string;
    lowStock?: string;
    handoff?: string;
    tab?: string;
  }>();
  const allowed = can(user, 'inventory.read');

  const initialGroup: InventoryCategoryGroup | undefined =
    typeof params.group === 'string' && isValidCategoryGroup(params.group)
      ? params.group
      : undefined;

  const initialLifecycle: InventoryLifecycle | undefined =
    typeof params.lifecycle === 'string' && LIFECYCLES.has(params.lifecycle as InventoryLifecycle)
      ? (params.lifecycle as InventoryLifecycle)
      : undefined;

  const initialScope: FinishedBoardScope | undefined =
    typeof params.scope === 'string' && SCOPES.has(params.scope as FinishedBoardScope)
      ? (params.scope as FinishedBoardScope)
      : undefined;

  const initialLowStock = params.lowStock === 'true';
  const initialHandoff = params.handoff === 'true';
  const initialTab = typeof params.tab === 'string' ? params.tab : undefined;

  if (!allowed) {
    return (
      <AppScreen>
        <EmptyState title={t('mobile.noModules')} description={t('mobile.noModulesHint')} />
      </AppScreen>
    );
  }

  if (INVENTORY_COMPOSITION === 'signature') {
    return (
      <InventorySignatureHome
        initialGroup={initialGroup}
        initialLifecycle={initialLifecycle}
        initialScope={initialScope}
        initialLowStock={initialLowStock}
        initialHandoff={initialHandoff}
        initialTab={initialTab}
      />
    );
  }

  return <InventoryGroupsClassicScreen />;
}
