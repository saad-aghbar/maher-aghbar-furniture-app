import { useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/auth/AuthProvider';
import { DealerModifyVariantScreen } from '@/features/catalog/DealerModifyVariantScreen';
import {
  parseDeepLinkQty,
  parseDeepLinkText,
  parseDeepLinkVariantId,
  resolveCustomizeProductId,
} from '@/features/catalog/newOrderDeepLink';
import { PermissionGate } from '@/navigation/PermissionGate';

export default function CustomerModifyCatalogItemRoute() {
  const { user } = useAuth();
  const { id, productId, variantId, qty, lineId } = useLocalSearchParams<{
    id?: string;
    productId?: string;
    variantId?: string;
    qty?: string;
    lineId?: string;
  }>();
  return (
    <PermissionGate user={user} require="catalog.read" mode="all">
      <DealerModifyVariantScreen
        productId={resolveCustomizeProductId(id, productId)}
        variantId={parseDeepLinkVariantId(variantId)}
        qty={parseDeepLinkQty(qty)}
        lineId={parseDeepLinkText(lineId)}
      />
    </PermissionGate>
  );
}
