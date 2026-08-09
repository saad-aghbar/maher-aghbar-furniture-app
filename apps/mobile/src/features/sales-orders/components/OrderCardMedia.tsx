import { useEffect, useMemo, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getApiBaseUrl } from '@/api/config';
import { useTheme } from '@/theme';

type OrderCardMediaProps = {
  imageUrl: string | null;
  size?: number;
};

/** Turn relative `/api/v1/...` download paths into absolute Image URIs. */
export function resolveOrderMediaUri(url: string | null | undefined): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (/^(https?:|data:|file:)/i.test(trimmed)) return trimmed;
  const base = getApiBaseUrl().replace(/\/$/, '');
  return `${base}${trimmed.startsWith('/') ? trimmed : `/${trimmed}`}`;
}

export function OrderCardMedia({ imageUrl, size = 64 }: OrderCardMediaProps) {
  const { colors, theme } = useTheme();
  const [failed, setFailed] = useState(false);
  const uri = useMemo(() => resolveOrderMediaUri(imageUrl), [imageUrl]);

  useEffect(() => {
    setFailed(false);
  }, [uri]);

  const showImage = Boolean(uri) && !failed;

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: theme.radius.lg,
        backgroundColor: colors.surfaceSecondary,
        overflow: 'hidden',
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: colors.border,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {showImage ? (
        <Image
          source={{ uri: uri! }}
          style={{ width: size, height: size }}
          resizeMode="cover"
          accessibilityIgnoresInvertColors
          onError={() => setFailed(true)}
        />
      ) : (
        <Ionicons name="cube-outline" size={Math.round(size * 0.32)} color={colors.brand} />
      )}
    </View>
  );
}
