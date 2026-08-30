import { StyleSheet, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { BrandMark } from '@/components/BrandMark';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';

type EmptyProductImageProps = {
  /** Optional muted caption under the mark — never a raw debug string. */
  caption?: string;
};

/**
 * Honest empty product photo — cream canvas + quiet monogram, not a grey void or label.
 */
export function EmptyProductImage({ caption }: EmptyProductImageProps = {}) {
  const { colors, colorScheme, theme } = useTheme();
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
        width: '100%',
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.background,
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
        style={{ alignItems: 'center' }}
      >
        <View
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
        {caption ? (
          <AppText
            variant="caption"
            color="muted"
            align="center"
            style={{ marginTop: theme.spacing.sm, fontSize: 12, lineHeight: 16 }}
          >
            {caption}
          </AppText>
        ) : null}
      </View>
    </View>
  );
}
