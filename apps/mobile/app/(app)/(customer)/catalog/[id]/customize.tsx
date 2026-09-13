import { useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/auth/AuthProvider';
import { DealerModifyVariantScreen } from '@/features/catalog/DealerModifyVariantScreen';
import {
  parseDeepLinkQty,
  parseDeepLinkText,
  parseDeepLinkVariantId,
} from '@/features/catalog/newOrderDeepLink';
import { PermissionGate } from '@/navigation/PermissionGate';

export default function CustomerCustomizeVariantRoute() {
  const { user } = useAuth();
  const { id, variantId, qty, lineId } = useLocalSearchParams<{
    id: string;
    variantId?: string;
    qty?: string;
    lineId?: string;
  }>();
  return (
    <PermissionGate user={user} require="catalog.read" mode="all">
      <DealerModifyVariantScreen
        productId={String(id ?? '')}
        variantId={parseDeepLinkVariantId(variantId)}
        qty={parseDeepLinkQty(qty)}
        lineId={parseDeepLinkText(lineId)}
      />
    </PermissionGate>
  );
}
