import { Image, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme';

type Props = {
  uri?: string | null;
  size?: number;
  fallback?: keyof typeof Ionicons.glyphMap;
  rounded?: 'full' | 'lg';
};

/** Compact SKU photo. Does not mirror in RTL. Missing URI uses the icon fallback. */
export function InventorySkuThumb({
  uri,
  size = 40,
  fallback = 'cube-outline',
  rounded = 'lg',
}: Props) {
  const { colors, theme } = useTheme();
  const radius = rounded === 'full' ? size / 2 : theme.radius.lg;
  const trimmed = uri?.trim() || null;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        backgroundColor: colors.surfaceSecondary,
        borderWidth: 1,
        borderColor: colors.border,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {trimmed ? (
        <Image
          source={{ uri: trimmed }}
          style={{ width: size, height: size }}
          resizeMode="cover"
          accessibilityIgnoresInvertColors
        />
      ) : (
        <Ionicons name={fallback} size={Math.round(size * 0.45)} color={colors.textMuted} />
      )}
    </View>
  );
}
