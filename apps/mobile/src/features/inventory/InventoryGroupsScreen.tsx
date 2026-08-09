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

export function InventoryGroupsScreen() {
  const { user } = useAuth();
  const { t } = useLocale();
  const params = useLocalSearchParams<{ group?: string }>();
  const allowed = can(user, 'inventory.read');

  const initialGroup: InventoryCategoryGroup | undefined =
    typeof params.group === 'string' && isValidCategoryGroup(params.group)
      ? params.group
      : undefined;

  if (!allowed) {
    return (
      <AppScreen>
        <EmptyState title={t('mobile.noModules')} description={t('mobile.noModulesHint')} />
      </AppScreen>
    );
  }

  if (INVENTORY_COMPOSITION === 'signature') {
    return <InventorySignatureHome initialGroup={initialGroup} />;
  }

  return <InventoryGroupsClassicScreen />;
}
