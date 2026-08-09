import { useState } from 'react';
import { Alert, Image, Pressable, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { useLocale } from '@/i18n';
import { haptics } from '@/motion';
import { useTheme } from '@/theme';
import {
  pickAccessoryPhotoFromLibrary,
  uploadAccessoryImage,
  uploadAccessoryPhotoUri,
} from '../accessoryPhotoUpload';
import { useAccessoryCamera } from './AccessoryCameraProvider';
import { AccessoryPhotoSourceSheet } from './AccessoryPhotoSourceSheet';

type Props = {
  /** Existing remote URL (edit) or local preview while picking. */
  previewUri: string | null;
  onChange: (next: { localUri: string | null; remoteUrl: string | null }) => void;
  uploading?: boolean;
  onUploadingChange?: (busy: boolean) => void;
};

/** Optional accessory photo picker — branded camera or library; uploads to INVENTORY_IMAGE. */
export function AccessoryPhotoField({
  previewUri,
  onChange,
  uploading,
  onUploadingChange,
}: Props) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme } = useTheme();
  const { openAccessoryCamera } = useAccessoryCamera();
  const [busyLocal, setBusyLocal] = useState(false);
  const [sourceOpen, setSourceOpen] = useState(false);
  const busy = uploading || busyLocal;

  async function runCamera() {
    try {
      const localUri = await openAccessoryCamera();
      if (!localUri) return;
      setBusyLocal(true);
      onUploadingChange?.(true);
      try {
        const remoteUrl = await uploadAccessoryPhotoUri(localUri);
        onChange({ localUri, remoteUrl });
        void haptics.selection();
      } finally {
        setBusyLocal(false);
        onUploadingChange?.(false);
      }
    } catch {
      void haptics.error();
      Alert.alert(t('mobile.inventory.photoUploadFailed'));
      setBusyLocal(false);
      onUploadingChange?.(false);
    }
  }

  async function runLibrary() {
    // Sheet Modal is already dismissed via onClosed before this runs.
    try {
      const picked = await pickAccessoryPhotoFromLibrary(t);
      if (!picked) return;
      setBusyLocal(true);
      onUploadingChange?.(true);
      try {
        const remoteUrl = await uploadAccessoryImage(picked.uri, picked.fileName, picked.mimeType);
        onChange({ localUri: picked.uri, remoteUrl });
        void haptics.selection();
      } finally {
        setBusyLocal(false);
        onUploadingChange?.(false);
      }
    } catch {
      void haptics.error();
      Alert.alert(t('mobile.inventory.photoUploadFailed'));
      setBusyLocal(false);
      onUploadingChange?.(false);
    }
  }

  return (
    <View style={{ gap: theme.spacing.sm }}>
      <AppText variant="caption" color="secondary" weight={locale === 'ar' ? 'regular' : 'medium'}>
        {t('mobile.inventory.accessoryPhoto')}
      </AppText>
      <AppText variant="caption" color="muted">
        {t('mobile.inventory.accessoryPhotoOptional')}
      </AppText>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('mobile.inventory.accessoryPhoto')}
        disabled={busy}
        onPress={() => setSourceOpen(true)}
        style={{
          alignSelf: isRTL ? 'flex-end' : 'flex-start',
          width: 96,
          height: 96,
          borderRadius: theme.radius.xl,
          borderWidth: 1,
          borderColor: colors.borderStrong,
          backgroundColor: colors.surface,
          overflow: 'hidden',
          opacity: busy ? 0.6 : 1,
          alignItems: 'center',
          justifyContent: 'center',
          ...theme.elevation.card,
        }}
      >
        {previewUri ? (
          <Image
            source={{ uri: previewUri }}
            style={{ width: 96, height: 96 }}
            resizeMode="cover"
            accessibilityIgnoresInvertColors
          />
        ) : (
          <AppText variant="caption" color="muted" align="center">
            {busy ? t('mobile.inventory.photoUploading') : t('mobile.inventory.addPhoto')}
          </AppText>
        )}
      </Pressable>

      <AccessoryPhotoSourceSheet
        open={sourceOpen}
        onClose={() => setSourceOpen(false)}
        hasPhoto={Boolean(previewUri)}
        onTakePhoto={() => void runCamera()}
        onChoosePhoto={() => void runLibrary()}
        onRemovePhoto={
          previewUri
            ? () => onChange({ localUri: null, remoteUrl: null })
            : undefined
        }
      />
    </View>
  );
}
