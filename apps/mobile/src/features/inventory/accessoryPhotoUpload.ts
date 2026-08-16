import * as ImagePicker from 'expo-image-picker';
import { uploadFile } from '@/api/modules/uploads';
import { getApiBaseUrl } from '@/api/config';
import { emitToast, toastCopy } from '@/components/feedback/Toast';

type Translate = (key: string) => string;

async function ensureLibraryPermission(t: Translate) {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    emitToast({
      variant: 'warning',
      message: toastCopy(
        t('mobile.inventory.photoPermissionTitle'),
        t('mobile.inventory.photoPermissionBody'),
      ),
    });
    return false;
  }
  return true;
}

export async function uploadAccessoryImage(
  uri: string,
  fileName: string,
  mimeType: string,
): Promise<string> {
  const res = await uploadFile({
    uri,
    fileName,
    mimeType,
    category: 'INVENTORY_IMAGE',
  });
  const path = res.downloadPath ?? '';
  if (path.startsWith('http')) return path;
  return `${getApiBaseUrl()}${path.startsWith('/') ? path : `/${path}`}`;
}

/** Upload a local camera/library URI as an inventory accessory image. */
export async function uploadAccessoryPhotoUri(uri: string): Promise<string> {
  const lower = uri.toLowerCase();
  const mimeType = lower.includes('.png')
    ? 'image/png'
    : lower.includes('.webp')
      ? 'image/webp'
      : 'image/jpeg';
  const ext = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';
  return uploadAccessoryImage(uri, `accessory-${Date.now()}.${ext}`, mimeType);
}

/** Opens the library and returns a local asset (or null if cancelled). Does not upload. */
export async function pickAccessoryPhotoFromLibrary(
  t: Translate,
): Promise<{ uri: string; fileName: string; mimeType: string } | null> {
  if (!(await ensureLibraryPermission(t))) return null;
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.75,
    // Editing while another Modal is dismissing flashes/closes the picker on iOS.
    allowsEditing: false,
    exif: false,
  });
  if (result.canceled || !result.assets[0]) return null;
  const asset = result.assets[0];
  return {
    uri: asset.uri,
    fileName: asset.fileName ?? `accessory-${Date.now()}.jpg`,
    mimeType: asset.mimeType ?? 'image/jpeg',
  };
}
