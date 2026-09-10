import { Image, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { useToast } from '@/components/feedback/Toast';
import { DealerBoard } from '@/features/dealers/components/DealerBoard';
import { useAccessoryCamera } from '@/features/inventory/components/AccessoryCameraProvider';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';

export const PROBLEM_PHOTO_MAX = 8;

type Props = {
  uris: string[];
  onUris: (next: string[] | ((prev: string[]) => string[])) => void;
  /**
   * Yield the host BottomSheet Modal before gallery / camera presentation
   * (required inside report/answer sheets — nested Modals never appear on iOS).
   */
  onHostYieldChange?: (yielding: boolean) => void;
};

/**
 * Take / choose photos for a problem report or answer (local URIs until submit).
 * Inline actions — never nest another sheet Modal inside the report sheet.
 */
export function ProblemPhotoBar({ uris, onUris, onHostYieldChange }: Props) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme } = useTheme();
  const { showToast } = useToast();
  const { openAccessoryCamera } = useAccessoryCamera();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const full = uris.length >= PROBLEM_PHOTO_MAX;

  async function withHostYield<T>(run: () => Promise<T>): Promise<T> {
    onHostYieldChange?.(true);
    await new Promise<void>((resolve) => setTimeout(resolve, 140));
    try {
      return await run();
    } finally {
      onHostYieldChange?.(false);
    }
  }

  async function pickGallery() {
    try {
      await withHostYield(async () => {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
          showToast({ variant: 'warning', message: t('mobile.tasks.galleryPermission') });
          return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          quality: 0.8,
          allowsEditing: false,
          exif: false,
          allowsMultipleSelection: false,
        });
        if (result.canceled || !result.assets?.length) return;
        const uri = result.assets[0]!.uri;
        if (!uri) return;
        void haptics.selection();
        onUris((prev) => [...prev, uri].slice(0, PROBLEM_PHOTO_MAX));
      });
    } catch {
      void haptics.error();
      showToast({ variant: 'error', message: t('mobile.tasks.uploadFailed') });
    }
  }

  async function pickCamera() {
    try {
      // Accessory camera Modal needs the host sheet to yield first.
      await withHostYield(async () => {
        const uri = await openAccessoryCamera({
          title: t('mobile.tasks.takePhoto'),
          hint: t('mobile.tasks.problemPhotoHint'),
          aspectRatio: 4 / 3,
        });
        if (!uri) return;
        void haptics.selection();
        onUris((prev) => [...prev, uri].slice(0, PROBLEM_PHOTO_MAX));
      });
    } catch {
      void haptics.error();
      showToast({ variant: 'error', message: t('mobile.tasks.uploadFailed') });
    }
  }

  return (
    <DealerBoard title={t('mobile.tasks.problemPhotosTitle')} titleWeight={titleWeight}>
      <AppText variant="caption" color="muted">
        {t('mobile.tasks.problemPhotosHint')}
      </AppText>
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          flexWrap: 'wrap',
          gap: theme.spacing.sm,
          alignItems: 'center',
        }}
      >
        {uris.map((uri) => (
          <View
            key={uri}
            style={{
              width: 72,
              height: 72,
              borderRadius: theme.radius.lg,
              borderWidth: 1,
              borderColor: colors.border,
              overflow: 'hidden',
              backgroundColor: colors.surfaceSecondary,
            }}
          >
            <Image
              source={{ uri }}
              style={{ width: '100%', height: '100%' }}
              resizeMode="cover"
              accessibilityIgnoresInvertColors
            />
            <AnimatedPressable
              variant="button"
              accessibilityRole="button"
              accessibilityLabel={t('mobile.tasks.removePhoto')}
              onPress={() => {
                void haptics.selection();
                onUris((prev) => prev.filter((u) => u !== uri));
              }}
              style={{
                position: 'absolute',
                top: 4,
                ...(isRTL ? { left: 4 } : { right: 4 }),
                width: 24,
                height: 24,
                borderRadius: 12,
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.borderStrong,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="close" size={14} color={colors.textPrimary} />
            </AnimatedPressable>
          </View>
        ))}
      </View>

      {!full ? (
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            gap: theme.spacing.sm,
          }}
        >
          <AnimatedPressable
            variant="button"
            accessibilityRole="button"
            accessibilityLabel={t('mobile.tasks.takePhoto')}
            onPress={() => {
              void haptics.selection();
              void pickCamera();
            }}
            style={{
              flex: 1,
              minHeight: theme.sizes.touch.min,
              borderRadius: theme.radius.lg,
              borderWidth: 1.5,
              borderColor: colors.brand,
              backgroundColor: colors.brandSoft,
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: theme.spacing.sm,
              paddingHorizontal: theme.spacing.md,
            }}
          >
            <Ionicons name="camera-outline" size={20} color={colors.brand} />
            <AppText variant="label" weight={titleWeight} style={{ color: colors.brand }}>
              {t('mobile.tasks.takePhoto')}
            </AppText>
          </AnimatedPressable>
          <AnimatedPressable
            variant="button"
            accessibilityRole="button"
            accessibilityLabel={t('mobile.tasks.choosePhoto')}
            onPress={() => {
              void haptics.selection();
              void pickGallery();
            }}
            style={{
              flex: 1,
              minHeight: theme.sizes.touch.min,
              borderRadius: theme.radius.lg,
              borderWidth: 1,
              borderColor: colors.borderStrong,
              backgroundColor: colors.surfaceSecondary,
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: theme.spacing.sm,
              paddingHorizontal: theme.spacing.md,
            }}
          >
            <Ionicons name="images-outline" size={20} color={colors.textPrimary} />
            <AppText variant="label" weight="medium">
              {t('mobile.tasks.choosePhoto')}
            </AppText>
          </AnimatedPressable>
        </View>
      ) : null}
    </DealerBoard>
  );
}

export async function uploadProblemPhotos(input: {
  uris: string[];
  taskId: string;
  uploadFile: (args: {
    uri: string;
    fileName: string;
    mimeType: string;
    category: string;
    taskId: string;
  }) => Promise<{ document: { id: string } }>;
}): Promise<string[]> {
  const ids: string[] = [];
  for (let i = 0; i < input.uris.length; i += 1) {
    const uri = input.uris[i]!;
    const uploaded = await input.uploadFile({
      uri,
      fileName: `blocker-photo-${input.taskId}-${i + 1}.jpg`,
      mimeType: 'image/jpeg',
      category: `BLOCKER_PHOTO:${input.taskId}`,
      taskId: input.taskId,
    });
    ids.push(uploaded.document.id);
  }
  return ids;
}
