import { useEffect, useState } from 'react';
import {
  Image,
  Linking,
  ScrollView,
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getApiBaseUrl } from '@/api/config';
import { resolveDocumentUrl } from '@/api/modules/uploads';
import { AppText } from '@/components/AppText';
import { ImageViewer } from '@/components/media/ImageViewer';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';
import type { TaskFile } from '../api';

type TaskFilePreviewProps = {
  files: TaskFile[];
  title: string;
  emptyLabel?: string;
  /** Board header icon. */
  icon?: keyof typeof Ionicons.glyphMap;
  /** Prefer image tiles (shop-floor photos). */
  preferImages?: boolean;
};

function absoluteDownload(path: string | undefined): string | null {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  const base = getApiBaseUrl();
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

function isImage(file: TaskFile): boolean {
  const mime = file.mimeType?.toLowerCase() ?? '';
  if (mime.startsWith('image/')) return true;
  return /\.(png|jpe?g|gif|webp|heic)$/i.test(file.fileName);
}

/**
 * Floor media board — header stamp, cover tiles, lightbox.
 */
export function TaskFilePreview({
  files,
  title,
  emptyLabel,
  icon = 'images-outline',
  preferImages = false,
}: TaskFilePreviewProps) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const { width } = useWindowDimensions();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const [uris, setUris] = useState<Record<string, string>>({});
  const [failed, setFailed] = useState<Record<string, boolean>>({});
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  const thumb = Math.min(
    132,
    Math.round((width - theme.spacing.lg * 2 - theme.spacing.md * 2 - theme.spacing.sm) / 2.15),
  );

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const next: Record<string, string> = {};
      for (const file of files) {
        const direct = absoluteDownload(file.downloadPath);
        if (direct) {
          next[file.id] = direct;
          continue;
        }
        try {
          next[file.id] = await resolveDocumentUrl(file.id);
        } catch {
          // leave missing — empty tile
        }
      }
      if (!cancelled) setUris(next);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [files]);

  const imageFiles = files.filter(isImage);
  const otherFiles = files.filter((f) => !isImage(f));
  const mediaFiles = preferImages ? imageFiles : files;
  const showAsGallery = preferImages || imageFiles.length === files.length;
  const galleryUris = imageFiles
    .map((file) => uris[file.id])
    .filter((uri): uri is string => Boolean(uri));

  const openImage = (file: TaskFile) => {
    const uri = uris[file.id];
    if (!uri) return;
    const next = galleryUris.indexOf(uri);
    setViewerIndex(next >= 0 ? next : 0);
  };

  return (
    <View
      style={{
        borderRadius: theme.radius.xl,
        borderWidth: 1,
        borderColor: colors.borderStrong,
        backgroundColor: colors.surface,
        overflow: 'hidden',
        ...orderBoardShadow(colorScheme),
      }}
    >
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          ...(isRTL ? { right: 0 } : { left: 0 }),
          width: 3,
          backgroundColor: colors.brand,
          opacity: 0.5,
        }}
      />

      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: theme.spacing.sm,
          paddingHorizontal: theme.spacing.md,
          paddingVertical: theme.spacing.sm + 2,
          ...(isRTL
            ? { paddingRight: theme.spacing.md + 4 }
            : { paddingLeft: theme.spacing.md + 4 }),
          backgroundColor: colors.surfaceSecondary,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            gap: theme.spacing.sm,
            flex: 1,
            minWidth: 0,
          }}
        >
          <View
            style={{
              width: 28,
              height: 28,
              borderRadius: 14,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors.brandSoft,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Ionicons name={icon} size={14} color={colors.brand} />
          </View>
          <AppText
            variant="caption"
            weight="semibold"
            style={{
              flex: 1,
              textTransform: locale === 'ar' ? 'none' : 'uppercase',
              letterSpacing: locale === 'ar' ? 0 : 0.55,
              fontSize: 11,
              color: colors.brand,
              textAlign: isRTL ? 'right' : 'left',
            }}
          >
            {title}
          </AppText>
        </View>
        <View
          style={{
            paddingHorizontal: 8,
            paddingVertical: 3,
            borderRadius: theme.radius.full,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <AppText variant="caption" color="muted" dir="ltr" style={{ fontSize: 11 }}>
            {String(files.length)}
          </AppText>
        </View>
      </View>

      {files.length === 0 ? (
        <View
          style={{
            paddingVertical: theme.spacing.xl,
            paddingHorizontal: theme.spacing.lg,
            alignItems: 'center',
            gap: theme.spacing.sm,
          }}
        >
          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: 24,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors.surfaceSecondary,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Ionicons name={icon} size={22} color={colors.textMuted} />
          </View>
          <AppText
            variant="caption"
            color="muted"
            style={{ textAlign: 'center' }}
          >
            {emptyLabel ?? t('mobile.tasks.noAttachments')}
          </AppText>
        </View>
      ) : showAsGallery && imageFiles.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            padding: theme.spacing.md,
            ...(isRTL
              ? { paddingRight: theme.spacing.md + 2 }
              : { paddingLeft: theme.spacing.md + 2 }),
            gap: theme.spacing.sm,
            flexDirection: isRTL ? 'row-reverse' : 'row',
          }}
        >
          {imageFiles.map((file, index) => {
            const uri = uris[file.id];
            const broken = failed[file.id];
            return (
              <AnimatedPressable
                key={file.id}
                variant="card"
                accessibilityRole="imagebutton"
                accessibilityLabel={file.fileName}
                onPress={() => {
                  void haptics.selection();
                  if (uri && !broken) openImage(file);
                  else if (uri) void Linking.openURL(uri);
                }}
                style={{
                  width: thumb,
                  height: thumb * 1.15,
                  borderRadius: theme.radius.lg,
                  overflow: 'hidden',
                  borderWidth: 1,
                  borderColor: colors.borderStrong,
                  backgroundColor: colors.surfaceSecondary,
                }}
              >
                {uri && !broken ? (
                  <Image
                    source={{ uri }}
                    style={{ width: '100%', height: '100%' }}
                    resizeMode="cover"
                    accessibilityIgnoresInvertColors
                    onError={() =>
                      setFailed((prev) => ({ ...prev, [file.id]: true }))
                    }
                  />
                ) : (
                  <View
                    style={{
                      flex: 1,
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: theme.spacing.sm,
                      gap: 6,
                    }}
                  >
                    <Ionicons name="image-outline" size={22} color={colors.textMuted} />
                    <AppText variant="caption" color="muted" numberOfLines={2} align="center">
                      {file.fileName}
                    </AppText>
                  </View>
                )}
                <View
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: 36,
                    backgroundColor: 'rgba(20,16,12,0.45)',
                  }}
                />
                <View
                  style={{
                    position: 'absolute',
                    bottom: 8,
                    ...(isRTL ? { left: 8 } : { right: 8 }),
                    paddingHorizontal: 7,
                    paddingVertical: 2,
                    borderRadius: theme.radius.sm,
                    backgroundColor: 'rgba(20,16,12,0.72)',
                  }}
                >
                  <AppText variant="caption" dir="ltr" style={{ color: '#fff', fontSize: 10 }}>
                    {`${index + 1}/${imageFiles.length}`}
                  </AppText>
                </View>
              </AnimatedPressable>
            );
          })}
        </ScrollView>
      ) : (
        <View
          style={{
            padding: theme.spacing.md,
            ...(isRTL
              ? { paddingRight: theme.spacing.md + 2 }
              : { paddingLeft: theme.spacing.md + 2 }),
            gap: theme.spacing.sm,
          }}
        >
          {(preferImages ? otherFiles : mediaFiles).map((file) => {
            const uri = uris[file.id];
            const image = isImage(file);
            return (
              <AnimatedPressable
                key={file.id}
                variant="button"
                accessibilityRole="button"
                accessibilityLabel={file.fileName}
                onPress={() => {
                  void haptics.selection();
                  if (image && uri) openImage(file);
                  else if (uri) void Linking.openURL(uri);
                }}
                style={{
                  minHeight: theme.sizes.touch.min,
                  borderRadius: theme.radius.lg,
                  borderWidth: 1,
                  borderColor: colors.borderStrong,
                  backgroundColor: colors.surfaceSecondary,
                  paddingHorizontal: theme.spacing.md,
                  paddingVertical: theme.spacing.sm,
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  alignItems: 'center',
                  gap: theme.spacing.sm,
                }}
              >
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: theme.radius.md,
                    overflow: 'hidden',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: colors.surface,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  {image && uri ? (
                    <Image
                      source={{ uri }}
                      style={{ width: 40, height: 40 }}
                      resizeMode="cover"
                    />
                  ) : (
                    <Ionicons name="document-outline" size={18} color={colors.brand} />
                  )}
                </View>
                <AppText
                  variant="label"
                  weight={titleWeight}
                  numberOfLines={2}
                  style={{ flex: 1, textAlign: isRTL ? 'right' : 'left' }}
                >
                  {file.fileName}
                </AppText>
                <Ionicons
                  name={isRTL ? 'chevron-back' : 'chevron-forward'}
                  size={16}
                  color={colors.textMuted}
                />
              </AnimatedPressable>
            );
          })}
        </View>
      )}

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
