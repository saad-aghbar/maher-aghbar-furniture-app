import { useState } from 'react';
import { Image, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme';

type ProductThumbProps = {
  uri?: string | null;
  size?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
  /** Wider card media — keeps consistent aspect without stretching. */
  aspectRatio?: number;
  width?: number | `${number}%`;
};

/**
 * First-class product photography for desk cards.
 * Consistent crop/radius; warm placeholder when missing or failed.
 */
export function ProductThumb({
  uri,
  size = 88,
  radius,
  style,
  aspectRatio,
  width,
}: ProductThumbProps) {
  const { colors, theme } = useTheme();
  const [failed, setFailed] = useState(false);
  const r = radius ?? theme.radius.md;
  const showImage = Boolean(uri?.trim()) && !failed;

  const boxStyle: ViewStyle = aspectRatio
    ? {
        width: width ?? '100%',
        aspectRatio,
        borderRadius: r,
        overflow: 'hidden',
        backgroundColor: colors.surfaceSecondary,
        borderWidth: 1,
        borderColor: colors.borderMuted,
      }
    : {
        width: size,
        height: size,
        borderRadius: r,
        overflow: 'hidden',
        backgroundColor: colors.surfaceSecondary,
        borderWidth: 1,
        borderColor: colors.borderMuted,
      };

  return (
    <View style={[boxStyle, style]}>
      {showImage ? (
        <Image
          source={{ uri: uri! }}
          style={{ width: '100%', height: '100%' }}
          resizeMode="cover"
          onError={() => setFailed(true)}
          accessibilityIgnoresInvertColors
        />
      ) : (
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.brandSoft,
          }}
          accessibilityLabel="Product image unavailable"
        >
          <Ionicons name="cube-outline" size={Math.min(28, size * 0.36)} color={colors.brand} />
        </View>
      )}
    </View>
  );
}
