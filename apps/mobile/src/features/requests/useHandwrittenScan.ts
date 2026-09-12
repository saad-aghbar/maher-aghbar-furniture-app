import { useCallback, useRef, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { extractPreview } from '@/api/modules/ai-intake';
import { uploadFile } from '@/api/modules/uploads';
import { useToast, toastCopy } from '@/components/feedback/Toast';
import { useAccessoryCamera } from '@/features/inventory/components/AccessoryCameraProvider';
import { useLocale } from '@/i18n';
import { haptics } from '@/motion';
import {
  type DealerAiIntakeState,
} from './aiIntakeHumanState';
import {
  newAttachmentId,
  type PendingAttachment,
} from './pendingAttachment';
import { normalizeUploadMime, presentAfterUiSettle } from './presentAfterUiSettle';
import {
  previewHasLowConfidence,
  previewItemsToScanLines,
  scanLinesToBasket,
  type CatalogNameHit,
  type ScanReviewLine,
} from './scanReview';
import type { NewOrderLine } from './newOrderLine';

type Args = {
  enabled: boolean;
  catalogHits: CatalogNameHit[];
  onLines: (lines: NewOrderLine[]) => void;
};

function toHandwritten(asset: {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
}): PendingAttachment {
  const mime = normalizeUploadMime(asset.mimeType, asset.uri, asset.fileName);
  return {
    id: newAttachmentId(),
    uri: asset.uri,
    fileName: asset.fileName?.includes('.') ? asset.fileName : `handwritten-${Date.now()}.jpg`,
    mimeType: mime,
    category: 'HANDWRITTEN_ORDER',
    kind: 'handwritten',
    status: 'ready',
    progress: 0,
  };
}

export function useHandwrittenScan({ enabled, catalogHits, onLines }: Args) {
  const { t } = useLocale();
  const { showToast } = useToast();
  const { openAccessoryCamera } = useAccessoryCamera();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [aiState, setAiState] = useState<DealerAiIntakeState>('idle');
  const [uploading, setUploading] = useState(false);
  const [scanReviewOpen, setScanReviewOpen] = useState(false);
  const [scanLines, setScanLines] = useState<ScanReviewLine[]>([]);
  const [scanPhotoUri, setScanPhotoUri] = useState<string | null>(null);
  const [cropPreviewOpen, setCropPreviewOpen] = useState(false);
  const picking = useRef(false);

  const failPick = (detail?: string) => {
    void haptics.error();
    showToast({
      variant: 'error',
      message: detail?.trim() || t('mobile.newOrder.pickFailed'),
    });
  };

  const runExtract = async (file: PendingAttachment) => {
    if (!file.storageKey) return;
    setAiState('reading');
    try {
      await new Promise((r) => setTimeout(r, 280));
      setAiState('understanding');
      const res = await extractPreview({
        storageKey: file.storageKey,
        mimeHint: file.mimeType,
        sourceType: 'IMAGE',
      });
      setAiState('preparing');
      const preview = res.preview ?? {};
      const items = preview.items?.length
        ? preview.items
        : preview.productName
          ? [
              {
                productName: preview.productName,
                quantity: preview.quantity,
                fabric: preview.fabric,
                material: preview.material,
                width: preview.width,
                height: preview.height,
                depth: preview.depth,
                notes: preview.notes,
                variantLabel: undefined,
                woodType: undefined,
                woodColor: undefined,
                foamDensity: undefined,
                finish: undefined,
                confidence: 0.8,
                lowConfidenceFields: [],
              },
            ]
          : [];
      if (items.length) {
        setScanLines(previewItemsToScanLines(items, catalogHits));
        setScanPhotoUri(file.uri);
        setScanReviewOpen(true);
        setAiState(previewHasLowConfidence(items) ? 'needsInfo' : 'ready');
      } else {
        setAiState('needsInfo');
      }
    } catch {
      setAiState('failed');
    }
  };

  const uploadAndRead = async (file: PendingAttachment) => {
    setUploading(true);
    setAiState('uploading');
    try {
      const uploaded = await uploadFile({
        uri: file.uri,
        fileName: file.fileName,
        mimeType: file.mimeType,
        category: file.category,
      });
      await runExtract({
        ...file,
        status: 'uploaded',
        progress: 1,
        storageKey: uploaded.document.storageKey,
        documentId: uploaded.document.id,
      });
    } catch (err) {
      setAiState('failed');
      failPick(err instanceof Error ? err.message : undefined);
    } finally {
      setUploading(false);
    }
  };

  const pickGallery = async () => {
    if (picking.current) return;
    picking.current = true;
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        showToast({
          variant: 'warning',
          message: toastCopy(t('mobile.newOrder.permissionTitle'), t('mobile.newOrder.permissionBody')),
        });
        return;
      }
      const result = await presentAfterUiSettle(() =>
        ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          quality: 0.85,
          allowsEditing: false,
          exif: false,
        }),
      );
      if (result.canceled || !result.assets?.[0]) return;
      await uploadAndRead(toHandwritten(result.assets[0]));
    } catch (err) {
      failPick(err instanceof Error ? err.message : undefined);
    } finally {
      picking.current = false;
    }
  };

  const pickCamera = async () => {
    if (picking.current) return;
    picking.current = true;
    try {
      const uri = await presentAfterUiSettle(() =>
        openAccessoryCamera({
          title: t('mobile.newOrder.handwrittenTakeTitle'),
          hint: t('mobile.newOrder.handwrittenTakeHint'),
          aspectRatio: 4 / 3,
        }),
      );
      if (!uri) return;
      await uploadAndRead(
        toHandwritten({
          uri,
          fileName: `handwritten-${Date.now()}.jpg`,
          mimeType: 'image/jpeg',
        }),
      );
    } catch (err) {
      failPick(err instanceof Error ? err.message : undefined);
    } finally {
      picking.current = false;
    }
  };

  const openPicker = useCallback(() => {
    if (!enabled || uploading) return;
    void haptics.selection();
    setPickerOpen(true);
  }, [enabled, uploading]);

  const confirmScan = () => {
    const scanned = scanLinesToBasket(scanLines);
    onLines(scanned);
    setScanReviewOpen(false);
    setAiState('ready');
    void haptics.confirmMedium();
  };

  return {
    pickerOpen,
    setPickerOpen,
    pickCamera,
    pickGallery,
    aiState,
    uploading,
    scanReviewOpen,
    setScanReviewOpen,
    scanLines,
    setScanLines,
    scanPhotoUri,
    cropPreviewOpen,
    setCropPreviewOpen,
    confirmScan,
    openPicker,
  };
}
