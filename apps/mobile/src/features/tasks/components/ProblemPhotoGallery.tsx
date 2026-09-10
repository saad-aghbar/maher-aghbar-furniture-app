import { useEffect, useState } from 'react';
import { Image, Pressable, View } from 'react-native';
import { resolveDocumentUrl } from '@/api/modules/uploads';
import { AppText } from '@/components/AppText';
import { ImageViewer } from '@/components/media/ImageViewer';
import { useLocale } from '@/i18n';
import { haptics } from '@/motion';
import { useTheme } from '@/theme';

type Props = {
  documentIds?: string[] | null;
  title?: string;
};

/**
 * Compact thumbs for problem report / answer photos (document IDs).
 */
export function ProblemPhotoGallery({ documentIds, title }: Props) {
  const { t, isRTL } = useLocale();
  const { colors, theme } = useTheme();
  const ids = (documentIds ?? []).filter(Boolean);
  const [uris, setUris] = useState<Record<string, string>>({});
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const next: Record<string, string> = {};
      for (const id of ids) {
        try {
          next[id] = await resolveDocumentUrl(id);
        } catch {
          /* leave missing */
        }
      }
      if (!cancelled) setUris(next);
    }
    if (ids.length) void load();
    else setUris({});
    return () => {
      cancelled = true;
    };
  }, [ids.join('|')]);

  if (!ids.length) return null;

  const galleryUris = ids.map((id) => uris[id]).filter((uri): uri is string => Boolean(uri));

  return (
    <View style={{ gap: theme.spacing.xs }}>
      {title ? (
        <AppText variant="caption" color="secondary">
          {title}
        </AppText>
      ) : null}
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          flexWrap: 'wrap',
          gap: theme.spacing.sm,
        }}
      >
        {ids.map((id) => {
          const uri = uris[id];
          return (
            <Pressable
              key={id}
              accessibilityRole="imagebutton"
              accessibilityLabel={t('mobile.tasks.problemPhoto')}
              onPress={() => {
                if (!uri) return;
                void haptics.selection();
                const next = galleryUris.indexOf(uri);
                setViewerIndex(next >= 0 ? next : 0);
              }}
              style={{
                width: 72,
                height: 72,
                borderRadius: theme.radius.lg,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.surfaceSecondary,
                overflow: 'hidden',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {uri ? (
                <Image
                  source={{ uri }}
                  style={{ width: '100%', height: '100%' }}
                  resizeMode="cover"
                  accessibilityIgnoresInvertColors
                />
              ) : (
                <AppText variant="caption" color="muted">
                  …
                </AppText>
              )}
            </Pressable>
          );
        })}
      </View>
      <ImageViewer
        open={viewerIndex != null}
        uris={galleryUris}
        index={viewerIndex ?? 0}
        onIndexChange={setViewerIndex}
        onClose={() => setViewerIndex(null)}
      />
    </View>
  );
}
