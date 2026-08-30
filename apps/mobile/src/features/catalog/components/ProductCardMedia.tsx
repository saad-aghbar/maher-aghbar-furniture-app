import { useEffect, useMemo, useState } from 'react';
import { Image, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { AppText } from '@/components/AppText';
import { EmptyProductImage } from '@/components/media/EmptyProductImage';
import { resolveOrderMediaUri } from '@/features/sales-orders/components/OrderCardMedia';
import { useReducedMotion } from '@/motion';
import { useTheme } from '@/theme';

type ProductCardMediaProps = {
  /** All product photos — auto-scrolls when more than one. */
  imageUrls?: string[];
  /** @deprecated Prefer imageUrls. */
  imageUrl?: string | null;
  width: number;
  aspectRatio?: number;
  galleryCount?: number;
};

const AUTO_MS = 3000;

function resolveMediaUris(imageUrls?: string[], imageUrl?: string | null): string[] {
  const raw =
    imageUrls && imageUrls.length
      ? imageUrls.filter((u) => Boolean(u?.trim()))
      : imageUrl
        ? [imageUrl]
        : [];
  const out: string[] = [];
  for (const u of raw) {
    const resolved = resolveOrderMediaUri(u);
    if (resolved && !out.includes(resolved)) out.push(resolved);
  }
  return out;
}

/** Edge-to-edge media band — cream empty chrome until a photo actually loads. */
export function ProductCardMedia({
  imageUrls,
  imageUrl,
  width,
  aspectRatio = 4 / 5,
  galleryCount = 0,
}: ProductCardMediaProps) {
  const { colors, theme } = useTheme();
  const reduce = useReducedMotion();
  const uris = useMemo(() => resolveMediaUris(imageUrls, imageUrl), [imageUrls, imageUrl]);
  const [index, setIndex] = useState(0);
  const [loaded, setLoaded] = useState<Record<string, boolean>>({});
  const [failed, setFailed] = useState<Record<string, boolean>>({});
  const height = Math.round(width / aspectRatio);
  const displayable = uris.filter((u) => !failed[u]);
  const multi = displayable.length > 1;
  const safeIndex = displayable.length ? index % displayable.length : 0;
  const current = displayable[safeIndex] ?? null;
  const showingPhoto = Boolean(current && loaded[current]);
  const uriKey = uris.join('|');

  useEffect(() => {
    setIndex(0);
    setLoaded({});
    setFailed({});
  }, [uriKey]);

  useEffect(() => {
    if (!multi || reduce) return;
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % displayable.length);
    }, AUTO_MS);
    return () => clearInterval(id);
  }, [multi, reduce, displayable.length, uriKey]);

  return (
    <View
      style={{
        width,
        height,
        backgroundColor: colors.background,
        overflow: 'hidden',
      }}
    >
      {showingPhoto ? null : <EmptyProductImage />}

      {current ? (
        <>
          <Animated.View
            key={current}
            entering={reduce ? undefined : FadeIn.duration(420)}
            style={{ position: 'absolute', width, height, opacity: showingPhoto ? 1 : 0 }}
          >
            <Image
              source={{ uri: current }}
              style={{ width, height }}
              resizeMode="cover"
              onLoad={() => setLoaded((prev) => ({ ...prev, [current]: true }))}
              onError={() => setFailed((prev) => ({ ...prev, [current]: true }))}
              accessibilityIgnoresInvertColors
            />
          </Animated.View>
          {displayable.map((uri, i) =>
            i === safeIndex ? null : (
              <Image
                key={`preload-${uri}-${i}`}
                source={{ uri }}
                style={{ width: 1, height: 1, position: 'absolute', opacity: 0 }}
                onLoad={() => setLoaded((prev) => ({ ...prev, [uri]: true }))}
                onError={() => setFailed((prev) => ({ ...prev, [uri]: true }))}
              />
            ),
          )}
        </>
      ) : null}

      {showingPhoto && multi ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            bottom: theme.spacing.sm,
            left: 0,
            right: 0,
            flexDirection: 'row',
            justifyContent: 'center',
            gap: 5,
          }}
        >
          {displayable.map((_, i) => {
            const active = i === safeIndex;
            return (
              <View
                key={`dot-${i}`}
                style={{
                  width: active ? 14 : 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: active ? '#fff' : 'rgba(255,255,255,0.45)',
                }}
              />
            );
          })}
        </View>
      ) : showingPhoto && galleryCount > 1 ? (
        <View
          style={{
            position: 'absolute',
            bottom: theme.spacing.sm,
            right: theme.spacing.sm,
            paddingHorizontal: 8,
            paddingVertical: 3,
            borderRadius: theme.radius.full,
            backgroundColor: 'rgba(30,26,27,0.72)',
          }}
        >
          <AppText
            variant="caption"
            weight="semibold"
            dir="ltr"
            style={{ color: '#fff', fontSize: 11, lineHeight: 14 }}
          >
            {galleryCount}
          </AppText>
        </View>
      ) : null}
    </View>
  );
}
