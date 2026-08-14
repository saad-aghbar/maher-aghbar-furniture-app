import { Ionicons } from '@expo/vector-icons';

type IconName = keyof typeof Ionicons.glyphMap;

const FALLBACK: IconName = 'people-outline';

const KNOWN: Record<string, IconName> = {
  'cube-outline': 'cube-outline',
  'cart-outline': 'cart-outline',
  'clipboard-outline': 'clipboard-outline',
  'construct-outline': 'construct-outline',
  'shield-checkmark-outline': 'shield-checkmark-outline',
  'people-outline': 'people-outline',
  'business-outline': 'business-outline',
  'car-outline': 'car-outline',
  'cash-outline': 'cash-outline',
  'document-text-outline': 'document-text-outline',
};

export function staffTypeIcon(iconKey?: string | null): IconName {
  if (!iconKey) return FALLBACK;
  return KNOWN[iconKey] ?? FALLBACK;
}
