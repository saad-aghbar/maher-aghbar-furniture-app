import { useRef, useState } from 'react';
import { View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { AppText } from '@/components/AppText';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { useToast, toastCopy } from '@/components/feedback/Toast';
import { ActionSheet, type ActionSheetItem } from '@/components/sheets/ActionSheet';
import { DealerUploadGrid, type DealerUploadItem } from '@/features/dealer-ui/DealerUploadGrid';
import { useAccessoryCamera } from '@/features/inventory/components/AccessoryCameraProvider';
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
import { normalizeUploadMime, presentAfterUiSettle } from '../presentAfterUiSettle';

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
  /** Called after new local files are queued — parent can start upload immediately. */
  onAttachmentsQueued?: () => void;
  /** When false, omit section title (parent provides combined step title). */
  showTitle?: boolean;
};

async function ensureLibraryPermission(
  t: (k: string) => string,
  showToast: (input: { variant?: 'warning' | 'error' | 'success' | 'info'; message: string }) => void,
) {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    showToast({
      variant: 'warning',
      message: toastCopy(t('mobile.newOrder.permissionTitle'), t('mobile.newOrder.permissionBody')),
    });
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
  const mime = normalizeUploadMime(asset.mimeType, asset.uri, asset.fileName);
  const category =
    kind === 'handwritten'
      ? 'HANDWRITTEN_ORDER'
      : kind === 'pdf' || isPdfMime(mime)
        ? 'ORDER_DOCUMENT'
        : 'ORDER_IMAGE';
  const ext =
    mime === 'application/pdf'
      ? 'pdf'
      : mime === 'image/png'
        ? 'png'
        : mime === 'image/webp'
          ? 'webp'
          : mime === 'image/heic'
            ? 'heic'
            : 'jpg';
  return {
    id: newAttachmentId(),
    uri: asset.uri,
    fileName: asset.fileName?.includes('.') ? asset.fileName : `file-${Date.now()}.${ext}`,
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
        : file.status === 'uploaded'
          ? 'uploaded'
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
  onAttachmentsQueued,
  showTitle = true,
}: UploadsStepProps) {
  const { t, isRTL } = useLocale();
  const { theme } = useTheme();
  const { showToast } = useToast();
  const { openAccessoryCamera } = useAccessoryCamera();
  const [handwrittenSheetOpen, setHandwrittenSheetOpen] = useState(false);
  const [picking, setPicking] = useState(false);
  const attachmentsRef = useRef(attachments);
  attachmentsRef.current = attachments;

  const add = (items: PendingAttachment[]) => {
    if (!items.length) return;
    const next = [...attachmentsRef.current, ...items];
    attachmentsRef.current = next;
    onChange(next);
    void haptics.selection();
    onAttachmentsQueued?.();
  };

  const remove = (id: string) => {
    const next = attachmentsRef.current.filter((a) => a.id !== id);
    attachmentsRef.current = next;
    onChange(next);
    void haptics.selection();
  };

  const failPick = (detail?: string) => {
    void haptics.error();
    showToast({
      variant: 'error',
      message: detail?.trim() || t('mobile.newOrder.pickFailed'),
    });
  };

  const pickGallery = async (kind: AttachmentKind, multi: boolean) => {
    if (picking) return;
    setPicking(true);
    try {
      if (!(await ensureLibraryPermission(t, showToast))) return;
      const result = await presentAfterUiSettle(() =>
        ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          quality: 0.85,
          // Editing + scroll/modal hosts often flash-dismiss the library on iOS.
          allowsEditing: false,
          exif: false,
          allowsMultipleSelection: multi,
          selectionLimit: multi ? 8 : 1,
        }),
      );
      if (result.canceled || !result.assets?.length) return;
      add(result.assets.map((a) => toAttachment(a, kind)));
    } catch (err) {
      failPick(err instanceof Error ? err.message : undefined);
    } finally {
      setPicking(false);
    }
  };

  /** Branded in-app camera — same AccessoryCamera flow as admin inventory / products. */
  const pickCamera = async (kind: AttachmentKind) => {
    if (picking) return;
    setPicking(true);
    try {
      const handwritten = kind === 'handwritten';
      const uri = await presentAfterUiSettle(() =>
        openAccessoryCamera({
          title: handwritten
            ? t('mobile.newOrder.handwrittenTakeTitle')
            : t('mobile.newOrder.takePhotoTitle'),
          hint: handwritten
            ? t('mobile.newOrder.handwrittenTakeHint')
            : t('mobile.newOrder.takePhotoHint'),
          aspectRatio: 4 / 3,
        }),
      );
      if (!uri) return;
      add([
        toAttachment(
          {
            uri,
            fileName: `${handwritten ? 'handwritten' : 'order'}-${Date.now()}.jpg`,
            mimeType: 'image/jpeg',
          },
          kind,
        ),
      ]);
    } catch (err) {
      failPick(err instanceof Error ? err.message : undefined);
    } finally {
      setPicking(false);
    }
  };

  const pickDocument = async () => {
    if (picking) return;
    setPicking(true);
    try {
      const result = await presentAfterUiSettle(async () => {
        try {
          return await DocumentPicker.getDocumentAsync({
            type: ['application/pdf', 'image/*'],
            multiple: true,
            copyToCacheDirectory: true,
          });
        } catch {
          // Some platforms reject multi-select — fall back to a single file.
          return DocumentPicker.getDocumentAsync({
            type: ['application/pdf', 'image/*'],
            multiple: false,
            copyToCacheDirectory: true,
          });
        }
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
    } catch (err) {
      failPick(err instanceof Error ? err.message : undefined);
    } finally {
      setPicking(false);
    }
  };

  const handwrittenActions: ActionSheetItem[] = [
    {
      label: t('mobile.newOrder.camera'),
      icon: 'camera-outline',
      deferUntilClosed: true,
      onPress: () => void pickCamera('handwritten'),
    },
    {
      label: t('mobile.newOrder.gallery'),
      icon: 'images-outline',
      deferUntilClosed: true,
      onPress: () => void pickGallery('handwritten', false),
    },
  ];

  const aiKey = aiStateMessageKey(aiState);
  const gridItems = attachments.map(toDealerItem);
  const pendingCount = attachments.filter(
    (a) => a.status === 'ready' || a.status === 'error' || a.status === 'cancelled',
  ).length;
  const uploadedCount = attachments.filter((a) => a.status === 'uploaded').length;
  const allUploaded = attachments.length > 0 && pendingCount === 0 && !uploading;
  const showUploadControls = attachments.length > 0 && (uploading || pendingCount > 0);

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
            onAddHandwritten={() => setHandwrittenSheetOpen(true)}
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

      {showUploadControls ? (
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

      {allUploaded ? (
        <AppText variant="caption" color="brand" weight="medium">
          {t('mobile.newOrder.attachmentsUploaded', { count: uploadedCount })}
        </AppText>
      ) : null}

      {error ? (
        <AppText variant="caption" color="error">
          {error}
        </AppText>
      ) : null}

      <ActionSheet
        open={handwrittenSheetOpen}
        onClose={() => setHandwrittenSheetOpen(false)}
        title={t('mobile.newOrder.handwritten')}
        actions={handwrittenActions}
        cancelLabel={t('common.cancel')}
      />
    </View>
  );
}
