import { Alert, Image, Pressable, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { AppText } from '@/components/AppText';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { useLocale } from '@/i18n';
import { ProgressBar, haptics } from '@/motion';
import { useTheme } from '@/theme';
import {
  isImageMime,
  isPdfMime,
  newAttachmentId,
  type AttachmentKind,
  type PendingAttachment,
} from '../pendingAttachment';

type UploadsStepProps = {
  attachments: PendingAttachment[];
  onChange: (next: PendingAttachment[]) => void;
  canUpload: boolean;
  aiBanner?: string | null;
  aiBusy?: boolean;
  error?: string | null;
  overallProgress: number;
  uploading: boolean;
  onUploadAll: () => void;
  onCancelUploads: () => void;
  onRetry: (id: string) => void;
  onBack: () => void;
  onNext: () => void;
};

async function ensureLibraryPermission(t: (k: string) => string) {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    Alert.alert(t('mobile.newOrder.permissionTitle'), t('mobile.newOrder.permissionBody'));
    return false;
  }
  return true;
}

async function ensureCameraPermission(t: (k: string) => string) {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) {
    Alert.alert(
      t('mobile.newOrder.cameraPermissionTitle'),
      t('mobile.newOrder.cameraPermissionBody'),
    );
    return false;
  }
  return true;
}

function toAttachment(
  asset: {
    uri: string;
    fileName?: string | null;
    mimeType?: string | null;
    fileSize?: number | null;
  },
  kind: AttachmentKind,
): PendingAttachment {
  const mime = asset.mimeType ?? (kind === 'pdf' ? 'application/pdf' : 'image/jpeg');
  const category =
    kind === 'handwritten'
      ? 'HANDWRITTEN_ORDER'
      : kind === 'pdf' || isPdfMime(mime)
        ? 'ORDER_DOCUMENT'
        : 'ORDER_IMAGE';
  return {
    id: newAttachmentId(),
    uri: asset.uri,
    fileName: asset.fileName ?? `file-${Date.now()}`,
    mimeType: mime,
    category,
    kind: kind === 'pdf' || isPdfMime(mime) ? 'pdf' : kind,
    status: 'ready',
    progress: 0,
    sizeBytes: asset.fileSize ?? undefined,
  };
}

export function UploadsStep({
  attachments,
  onChange,
  canUpload,
  aiBanner,
  aiBusy,
  error,
  overallProgress,
  uploading,
  onUploadAll,
  onCancelUploads,
  onRetry,
  onBack,
  onNext,
}: UploadsStepProps) {
  const { t, isRTL } = useLocale();
  const { colors, theme } = useTheme();

  const add = (items: PendingAttachment[]) => {
    if (!items.length) return;
    onChange([...attachments, ...items]);
    void haptics.selection();
  };

  const remove = (id: string) => {
    onChange(attachments.filter((a) => a.id !== id));
    void haptics.selection();
  };

  const pickGallery = async (kind: AttachmentKind, multi: boolean) => {
    if (!(await ensureLibraryPermission(t))) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
      allowsMultipleSelection: multi,
      selectionLimit: multi ? 8 : 1,
    });
    if (result.canceled || !result.assets?.length) return;
    add(result.assets.map((a) => toAttachment(a, kind)));
  };

  const pickCamera = async (kind: AttachmentKind) => {
    if (!(await ensureCameraPermission(t))) return;
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.85,
    });
    if (result.canceled || !result.assets[0]) return;
    add([toAttachment(result.assets[0], kind)]);
  };

  const pickDocument = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'image/*'],
      multiple: true,
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets?.length) return;
    add(
      result.assets.map((a) =>
        toAttachment(
          {
            uri: a.uri,
            fileName: a.name,
            mimeType: a.mimeType,
            fileSize: a.size,
          },
          isPdfMime(a.mimeType ?? '') || a.name.toLowerCase().endsWith('.pdf')
            ? 'pdf'
            : 'gallery',
        ),
      ),
    );
  };

  const modelFiles = attachments.filter((a) => a.kind === 'model');
  const galleryFiles = attachments.filter((a) => a.kind === 'gallery');
  const pdfFiles = attachments.filter((a) => a.kind === 'pdf');
  const handwrittenFiles = attachments.filter((a) => a.kind === 'handwritten');

  const renderTile = (file: PendingAttachment) => {
    const isImg = isImageMime(file.mimeType);
    return (
      <View
        key={file.id}
        style={{
          width: '47%',
          aspectRatio: 1,
          borderRadius: theme.radius.md,
          borderWidth: 1,
          borderColor:
            file.status === 'error'
              ? colors.error
              : file.status === 'uploaded'
                ? colors.success
                : colors.border,
          overflow: 'hidden',
          backgroundColor: colors.surface,
        }}
      >
        {isImg ? (
          <Image source={{ uri: file.uri }} style={{ flex: 1 }} resizeMode="cover" />
        ) : (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: theme.spacing.sm }}>
            <AppText variant="caption" weight="semibold" style={{ textAlign: 'center' }}>
              PDF
            </AppText>
            <AppText variant="caption" color="muted" numberOfLines={2} style={{ textAlign: 'center' }}>
              {file.fileName}
            </AppText>
          </View>
        )}
        {(file.status === 'uploading' || file.status === 'error' || file.status === 'uploaded') && (
          <View
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              padding: theme.spacing.xs,
              backgroundColor: 'rgba(30,26,27,0.55)',
              gap: 4,
            }}
          >
            {file.status === 'uploading' ? (
              <ProgressBar progress={file.progress} />
            ) : null}
            <AppText variant="caption" style={{ color: '#fff' }}>
              {file.status === 'uploading'
                ? `${Math.round(file.progress * 100)}%`
                : file.status === 'uploaded'
                  ? t('mobile.newOrder.uploadDone')
                  : file.status === 'error'
                    ? t('mobile.newOrder.uploadFailed')
                    : ''}
            </AppText>
          </View>
        )}
        <View
          style={{
            position: 'absolute',
            top: theme.spacing.xs,
            ...(isRTL ? { left: theme.spacing.xs } : { right: theme.spacing.xs }),
            flexDirection: isRTL ? 'row-reverse' : 'row',
            gap: theme.spacing.xs,
          }}
        >
          {file.status === 'error' ? (
            <Pressable
              onPress={() => onRetry(file.id)}
              style={{
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderRadius: theme.radius.sm,
                backgroundColor: colors.surface,
              }}
            >
              <AppText variant="caption" weight="semibold" color="brand">
                {t('mobile.newOrder.retry')}
              </AppText>
            </Pressable>
          ) : null}
          <Pressable
            onPress={() => remove(file.id)}
            accessibilityLabel={t('mobile.newOrder.removeAttachment')}
            style={{
              paddingHorizontal: 8,
              paddingVertical: 4,
              borderRadius: theme.radius.sm,
              backgroundColor: colors.surface,
            }}
          >
            <AppText variant="caption" weight="semibold" color="error">
              {t('mobile.newOrder.remove')}
            </AppText>
          </Pressable>
        </View>
      </View>
    );
  };

  const section = (
    title: string,
    hint: string,
    files: PendingAttachment[],
    actions: { label: string; onPress: () => void }[],
  ) => (
    <View style={{ gap: theme.spacing.sm }}>
      <AppText variant="label" weight="semibold">
        {title}
      </AppText>
      <AppText variant="caption" color="muted">
        {hint}
      </AppText>
      <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
        {actions.map((a) => (
          <SecondaryButton
            key={a.label}
            label={a.label}
            onPress={a.onPress}
            disabled={!canUpload || uploading}
            style={{ flexGrow: 1, minWidth: '40%' }}
          />
        ))}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
        {files.map(renderTile)}
      </View>
    </View>
  );

  return (
    <View style={{ gap: theme.spacing.lg }}>
      <AppText variant="title" weight="semibold">
        {t('mobile.newOrder.step5Title')}
      </AppText>
      <AppText variant="body" color="secondary">
        {t('mobile.newOrder.step5Body')}
      </AppText>

      {!canUpload ? (
        <AppText variant="caption" color="muted">
          {t('mobile.newOrder.uploadsUnavailable')}
        </AppText>
      ) : (
        <>
          {section(t('mobile.newOrder.modelImage'), t('mobile.newOrder.modelImageHint'), modelFiles, [
            {
              label: t('mobile.newOrder.camera'),
              onPress: () => void pickCamera('model'),
            },
            {
              label: t('mobile.newOrder.gallery'),
              onPress: () => void pickGallery('model', false),
            },
          ])}

          {section(
            t('mobile.newOrder.moreImages'),
            t('mobile.newOrder.moreImagesHint'),
            galleryFiles,
            [
              {
                label: t('mobile.newOrder.camera'),
                onPress: () => void pickCamera('gallery'),
              },
              {
                label: t('mobile.newOrder.gallery'),
                onPress: () => void pickGallery('gallery', true),
              },
            ],
          )}

          {section(t('mobile.newOrder.pdfDocs'), t('mobile.newOrder.pdfDocsHint'), pdfFiles, [
            {
              label: t('mobile.newOrder.pickDocument'),
              onPress: () => void pickDocument(),
            },
          ])}

          {section(
            t('mobile.newOrder.handwritten'),
            t('mobile.newOrder.handwrittenHint'),
            handwrittenFiles,
            [
              {
                label: t('mobile.newOrder.camera'),
                onPress: () => void pickCamera('handwritten'),
              },
              {
                label: t('mobile.newOrder.gallery'),
                onPress: () => void pickGallery('handwritten', false),
              },
            ],
          )}
        </>
      )}

      {aiBanner ? (
        <AppText variant="caption" color="brand">
          {aiBusy ? t('mobile.newOrder.aiReviewing') : aiBanner}
        </AppText>
      ) : null}

      {attachments.length > 0 ? (
        <View style={{ gap: theme.spacing.sm }}>
          <AppText variant="label" color="secondary">
            {t('mobile.newOrder.overallProgress')}
          </AppText>
          <ProgressBar progress={overallProgress} />
          <AppText variant="caption" color="muted">
            {Math.round(overallProgress * 100)}%
          </AppText>
          <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', gap: theme.spacing.sm }}>
            {uploading ? (
              <SecondaryButton
                label={t('mobile.newOrder.cancelUploads')}
                onPress={onCancelUploads}
                style={{ flex: 1 }}
              />
            ) : (
              <SecondaryButton
                label={t('mobile.newOrder.uploadAll')}
                onPress={onUploadAll}
                style={{ flex: 1 }}
              />
            )}
          </View>
        </View>
      ) : null}

      {error ? (
        <AppText variant="caption" color="error">
          {error}
        </AppText>
      ) : null}

      <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', gap: theme.spacing.sm }}>
        <SecondaryButton label={t('mobile.newOrder.back')} onPress={onBack} style={{ flex: 1 }} />
        <PrimaryButton
          label={t('mobile.newOrder.continue')}
          onPress={onNext}
          disabled={uploading}
          style={{ flex: 1 }}
        />
      </View>
    </View>
  );
}
