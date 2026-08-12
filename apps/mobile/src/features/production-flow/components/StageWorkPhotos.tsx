import { useEffect, useState } from 'react';
import { Image, Pressable, View } from 'react-native';
import { resolveDocumentUrl } from '@/api/modules/uploads';
import { AppText } from '@/components/AppText';
import { ImageViewer } from '@/components/media/ImageViewer';
import { useLocale } from '@/i18n';
import { haptics } from '@/motion';
import { useTheme } from '@/theme';
import type { ProductionFlowStage } from '../selectProductionFlow';

type Photo = ProductionFlowStage['photos'][number];

type Props = {
  photos: Photo[];
  stageCompleted: boolean;
  /** When embedded in a section card that already shows the title. */
  hideTitle?: boolean;
};

export function StageWorkPhotos({ photos, stageCompleted, hideTitle }: Props) {
  const { t, isRTL } = useLocale();
  const { colors, theme } = useTheme();
  const [uris, setUris] = useState<Record<string, string>>({});
  const [failed, setFailed] = useState<Record<string, boolean>>({});
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const next: Record<string, string> = {};
      for (const photo of photos) {
        try {
          next[photo.id] = await resolveDocumentUrl(photo.id);
        } catch {
          // leave missing — show placeholder tile
        }
      }
      if (!cancelled) setUris(next);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [photos]);

  const title = hideTitle ? null : (
    <AppText variant="caption" color="muted">
      {t('mobile.productionFlow.workPhotos')}
    </AppText>
  );

  if (!stageCompleted && photos.length === 0) {
    return (
      <View style={{ gap: theme.spacing['2xs'] }}>
        {title}
        <AppText variant="body" color="muted">
          {t('mobile.productionFlow.workPhotosPending')}
        </AppText>
      </View>
    );
  }

  if (stageCompleted && photos.length === 0) {
    return (
      <View style={{ gap: theme.spacing['2xs'] }}>
        {title}
        <AppText variant="body" color="muted">
          {t('mobile.productionFlow.workPhotosEmpty')}
        </AppText>
      </View>
    );
  }

  if (photos.length === 0) return null;

  const galleryUris = photos
    .map((photo) => (failed[photo.id] ? undefined : uris[photo.id]))
    .filter((uri): uri is string => Boolean(uri));

  return (
    <View style={{ gap: theme.spacing.sm }}>
      {title}
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          flexWrap: 'wrap',
          gap: theme.spacing.sm,
        }}
      >
        {photos.map((photo) => {
          const uri = uris[photo.id];
          const broken = failed[photo.id];
          return (
            <Pressable
              key={photo.id}
              accessibilityRole="imagebutton"
              accessibilityLabel={photo.fileName}
              onPress={() => {
                void haptics.selection();
                if (!uri || broken) return;
                const next = galleryUris.indexOf(uri);
                setViewerIndex(next >= 0 ? next : 0);
              }}
              style={{
                width: '100%',
                maxWidth: 320,
                borderRadius: theme.radius.lg,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.surface,
                overflow: 'hidden',
                minHeight: 160,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {uri && !broken ? (
                <Image
                  source={{ uri }}
                  style={{ width: '100%', height: 200 }}
                  resizeMode="cover"
                  accessibilityIgnoresInvertColors
                  onError={() => setFailed((prev) => ({ ...prev, [photo.id]: true }))}
                />
              ) : (
                <AppText variant="caption" color="muted" style={{ padding: theme.spacing.md }}>
                  {photo.fileName}
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

export function isStageStatusComplete(status: string): boolean {
  const s = status.toUpperCase();
  return s === 'COMPLETED' || s === 'SKIPPED' || s === 'DONE';
}
