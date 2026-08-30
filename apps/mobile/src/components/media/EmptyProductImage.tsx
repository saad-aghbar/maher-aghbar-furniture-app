import { StyleSheet, View } from 'react-native';
import { BrandMark } from '@/components/BrandMark';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';

/**
 * Sell-ready empty product photo — muted brand wash + monogram, not a raw label.
 */
export function EmptyProductImage() {
  const { colors, colorScheme } = useTheme();
  const { t } = useLocale();
  const dark = colorScheme === 'dark';
  const ring = dark ? colors.brand : colors.brandActive;

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={t('mobile.catalog.noImage')}
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.brandSoft,
        overflow: 'hidden',
      }}
    >
      <View
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{
          position: 'absolute',
          width: '118%',
          aspectRatio: 1,
          borderRadius: 999,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: ring,
          opacity: dark ? 0.28 : 0.12,
        }}
      />
      <View
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{
          position: 'absolute',
          width: '72%',
          aspectRatio: 1,
          borderRadius: 999,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.brand,
          opacity: dark ? 0.34 : 0.16,
        }}
      />
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{
          width: 56,
          height: 56,
          borderRadius: 18,
          backgroundColor: colors.surface,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <BrandMark variant="monogram" size="md" style={{ height: 28, width: 32, opacity: 0.72 }} />
      </View>
    </View>
  );
}
