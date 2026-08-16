import * as ImagePicker from 'expo-image-picker';
import { uploadFile } from '@/api/modules/uploads';
import { getApiBaseUrl } from '@/api/config';
import { emitToast, toastCopy } from '@/components/feedback/Toast';

/** Matches the product media board on admin PDP (`aspectRatio: 1.2`). */
export const PRODUCT_PHOTO_ASPECT_RATIO = 1.2;

export type PickedProductPhoto = {
  uri: string;
  fileName: string;
  mimeType: string;
};

type Translate = (key: string) => string;

async function ensureLibraryPermission(t: Translate) {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    emitToast({
      variant: 'warning',
      message: toastCopy(
        t('catalog.productPhotoPermissionTitle'),
        t('catalog.productPhotoPermissionBody'),
      ),
    });
    return false;
  }
  return true;
}

/** Normalize MIME types iOS / Expo sometimes return that the API rejects. */
function normalizeMime(mimeType: string | null | undefined, uri: string): string {
  const raw = (mimeType ?? '').trim().toLowerCase();
  if (raw === 'image/jpg' || raw === 'image/pjpeg') return 'image/jpeg';
  if (raw === 'image/x-png') return 'image/png';
  if (
    raw === 'image/jpeg' ||
    raw === 'image/png' ||
    raw === 'image/webp' ||
    raw === 'image/heic'
  ) {
    return raw;
  }
  const lower = uri.toLowerCase();
  if (lower.includes('.png')) return 'image/png';
  if (lower.includes('.webp')) return 'image/webp';
  if (lower.includes('.heic')) return 'image/heic';
  return 'image/jpeg';
}

function fileNameFor(uri: string, mimeType: string, preferred?: string | null): string {
  if (preferred?.trim() && preferred.includes('.')) return preferred.trim();
  const ext =
    mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : mimeType === 'image/heic' ? 'heic' : 'jpg';
  return `product-${Date.now()}.${ext}`;
}

function absoluteDownloadUrl(downloadPath: string): string {
  if (downloadPath.startsWith('http')) return downloadPath;
  return `${getApiBaseUrl()}${downloadPath.startsWith('/') ? downloadPath : `/${downloadPath}`}`;
}

export async function uploadProductImage(
  uri: string,
  fileName: string,
  mimeType: string,
): Promise<string> {
  const normalizedMime = normalizeMime(mimeType, uri);
  const res = await uploadFile({
    uri,
    fileName: fileNameFor(uri, normalizedMime, fileName),
    mimeType: normalizedMime,
    category: 'PRODUCT_IMAGE',
  });
  const path = res.downloadPath?.trim() ?? '';
  if (!path) throw new Error('Missing download path');
  return absoluteDownloadUrl(path);
}

/** Upload a local camera / library URI as a product image. */
export async function uploadProductPhotoUri(uri: string): Promise<string> {
  const mimeType = normalizeMime(undefined, uri);
  return uploadProductImage(uri, fileNameFor(uri, mimeType), mimeType);
}

/**
 * Opens the photo library and returns a local asset (or null if cancelled).
 * Does not upload — call {@link uploadProductImage} after the picker dismisses.
 *
 * Note: `allowsEditing` is off. The in-picker crop UI + a dismissing RN Modal
 * is a common cause of the library flashing open then vanishing on iOS.
 */
export async function pickProductPhotoFromLibrary(t: Translate): Promise<PickedProductPhoto | null> {
  const picked = await pickProductPhotosFromLibrary(t, { selectionLimit: 1 });
  return picked[0] ?? null;
}

/**
 * Multi-select from the photo library (does not upload).
 */
export async function pickProductPhotosFromLibrary(
  t: Translate,
  options?: { selectionLimit?: number },
): Promise<PickedProductPhoto[]> {
  if (!(await ensureLibraryPermission(t))) return [];
  const limit = Math.max(1, options?.selectionLimit ?? 12);
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.85,
    allowsEditing: false,
    allowsMultipleSelection: limit > 1,
    selectionLimit: limit,
    exif: false,
  });
  if (result.canceled || !result.assets?.length) return [];
  return result.assets.map((asset) => {
    const mimeType = normalizeMime(asset.mimeType, asset.uri);
    return {
      uri: asset.uri,
      fileName: fileNameFor(asset.uri, mimeType, asset.fileName),
      mimeType,
    };
  });
}
