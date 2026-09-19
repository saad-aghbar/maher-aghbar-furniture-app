import { Redirect, useLocalSearchParams } from 'expo-router';
import {
  customizeVariantHref,
  parseDeepLinkQty,
  parseDeepLinkText,
  parseDeepLinkVariantId,
  resolveCustomizeProductId,
} from '@/features/catalog/newOrderDeepLink';

/** Legacy nested path — Expo often treated `customize` as `catalog/[id]`. */
export default function LegacyCustomerCustomizeVariantRoute() {
  const { id, productId, variantId, qty, lineId } = useLocalSearchParams<{
    id?: string;
    productId?: string;
    variantId?: string;
    qty?: string;
    lineId?: string;
  }>();
  const resolved = resolveCustomizeProductId(id, productId);
  return (
    <Redirect
      href={customizeVariantHref(
        resolved,
        parseDeepLinkVariantId(variantId),
        Number(parseDeepLinkQty(qty)),
        { lineId: parseDeepLinkText(lineId) },
      )}
    />
  );
}
