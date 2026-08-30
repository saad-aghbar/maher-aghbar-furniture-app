import { useEffect } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useAuth } from '@/auth/AuthProvider';
import { AppScreen } from '@/components/layout/AppScreen';
import { InventoryGroupListScreen } from '@/features/inventory/InventoryGroupListScreen';
import { InventoryGroupLoadError } from '@/features/inventory/components/InventoryGroupLoadError';
import { INVENTORY_COMPOSITION } from '@/features/inventory/inventoryComposition';
import {
  inventoryGroupRouteTitle,
  isValidCategoryGroup,
} from '@/features/inventory/selectInventory';
import { useLocale } from '@/i18n';
import { PermissionGate } from '@/navigation/PermissionGate';

/**
 * Deep-link / classic group route.
 * Signature composition redirects into the Inventory tab with `?group=`.
 */
export default function AdminInventoryGroupRoute() {
  const { group } = useLocalSearchParams<{ group: string }>();
  const { user } = useAuth();
  const { t } = useLocale();
  const router = useRouter();
  const value = String(group ?? '');
  const groupTitle = inventoryGroupRouteTitle(value, t);

  useEffect(() => {
    if (INVENTORY_COMPOSITION !== 'signature') return;
    if (!isValidCategoryGroup(value)) return;
    router.replace(`/(app)/(admin)/(tabs)/inventory?group=${value}` as Href);
  }, [router, value]);

  if (!isValidCategoryGroup(value)) {
    return (
      <AppScreen>
        <InventoryGroupLoadError
          groupTitle={groupTitle}
          onRetry={() => {
            router.replace('/(app)/(admin)/(tabs)/inventory' as Href);
          }}
        />
      </AppScreen>
    );
  }

  if (INVENTORY_COMPOSITION === 'signature') {
    return <View />;
  }

  return (
    <PermissionGate user={user} require="inventory.read" mode="all">
      <InventoryGroupListScreen categoryGroup={value} />
    </PermissionGate>
  );
}
