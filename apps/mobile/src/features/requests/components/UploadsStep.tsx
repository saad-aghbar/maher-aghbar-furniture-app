import { Alert, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { AppText } from '@/components/AppText';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { DealerUploadGrid, type DealerUploadItem } from '@/features/dealer-ui/DealerUploadGrid';
import { useLocale } from '@/i18n';
import { ProgressBar, haptics } from '@/motion';
import { useTheme } from '@/theme';
import type { DealerAiIntakeState } from '../aiIntakeHumanState';
import { aiStateMessageKey } from '../aiIntakeHumanState';
import {
  isPdfMime,
  newAttachmentId,
  type AttachmentKind,
  type PendingAttachment,
} from '../pendingAttachment';

type UploadsStepProps = {
  attachments: PendingAttachment[];
  onChange: (next: PendingAttachment[]) => void;
  canUpload: boolean;
  aiState?: DealerAiIntakeState;
  error?: string | null;
  overallProgress: number;
  uploading: boolean;
  onUploadAll: () => void;
  onCancelUploads: () => void;
  onRetry: (id: string) => void;
  /** When false, omit section title (parent provides combined step title). */
  showTitle?: boolean;
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

function toDealerItem(file: PendingAttachment): DealerUploadItem {
  const kind: DealerUploadItem['kind'] =
    file.kind === 'pdf' ? 'pdf' : file.kind === 'handwritten' ? 'handwritten' : 'image';
  const status: DealerUploadItem['status'] =
    file.status === 'uploading'
      ? 'uploading'
      : file.status === 'error'
        ? 'failed'
        : 'ready';
  return {
    id: file.id,
    uri: file.uri,
    name: file.fileName,
    kind,
    status,
    progress: file.progress,
  };
}

export function UploadsStep({
  attachments,
  onChange,
  canUpload,
  aiState = 'idle',
  error,
  overallProgress,
  uploading,
  onUploadAll,
  onCancelUploads,
  onRetry,
  showTitle = true,
}: UploadsStepProps) {
  const { t, isRTL } = useLocale();
  const { theme } = useTheme();

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

  const pickHandwritten = async () => {
    Alert.alert(t('mobile.newOrder.handwritten'), t('mobile.newOrder.handwrittenHint'), [
      {
        text: t('mobile.newOrder.camera'),
        onPress: () => void pickCamera('handwritten'),
      },
      {
        text: t('mobile.newOrder.gallery'),
        onPress: () => void pickGallery('handwritten', false),
      },
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  };

  const aiKey = aiStateMessageKey(aiState);
  const gridItems = attachments.map(toDealerItem);

  return (
    <View style={{ gap: theme.spacing.lg }}>
      {showTitle ? (
        <>
          <AppText variant="title" weight="semibold">
            {t('mobile.newOrder.step4Title')}
          </AppText>
          <AppText variant="body" color="secondary">
            {t('mobile.newOrder.step4Body')}
          </AppText>
        </>
      ) : null}

      {!canUpload ? (
        <AppText variant="caption" color="muted">
          {t('mobile.newOrder.uploadsUnavailable')}
        </AppText>
      ) : (
        <View style={{ gap: theme.spacing.sm }}>
          <AppText variant="label" weight="semibold">
            {t('mobile.newOrder.attachmentsSection')}
          </AppText>
          <AppText variant="caption" color="muted">
            {t('mobile.newOrder.attachmentsSectionHint')}
          </AppText>
          <DealerUploadGrid
            items={gridItems}
            onAddCamera={() => void pickCamera('gallery')}
            onAddGallery={() => void pickGallery('gallery', true)}
            onAddPdf={() => void pickDocument()}
            onAddHandwritten={() => void pickHandwritten()}
            onRetry={onRetry}
            onRemove={remove}
            addLabels={{
              camera: t('mobile.newOrder.camera'),
              gallery: t('mobile.newOrder.gallery'),
              pdf: t('mobile.newOrder.pickDocument'),
              handwritten: t('mobile.newOrder.handwritten'),
            }}
          />
        </View>
      )}

      {aiKey ? (
        <AppText variant="caption" color="brand">
          {t(aiKey)}
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
    </View>
  );
}
