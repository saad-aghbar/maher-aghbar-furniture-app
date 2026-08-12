import { Linking, Platform, Share } from 'react-native';
import { File, Paths } from 'expo-file-system';
import { getAccessToken } from '@/storage/tokens';
import { getApiV1Url } from './config';
import {
  pdfQuery,
  type PdfDownloadOptions,
} from '@/features/pdf/pdfDownloadTypes';

function fileNameFromPath(pathWithQuery: string): string {
  const path = pathWithQuery.split('?')[0] ?? pathWithQuery;
  const parts = path.split('/').filter(Boolean);
  const id = parts.find((p) => p !== 'pdf' && p.length > 0) ?? 'document';
  const safe = id.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40) || 'document';
  return `maher-${safe}-${Date.now()}.pdf`;
}

/** Fetch an authed PDF path (with lang/theme) and open / share. */
export async function openAuthedPdf(
  pathWithQuery: string,
  failLabel: string,
  shareMessage: string,
): Promise<void> {
  const token = await getAccessToken();
  const url = `${getApiV1Url()}${pathWithQuery}`;
  const res = await fetch(url, {
    headers: {
      Accept: 'application/pdf',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) {
    throw new Error(`${failLabel} (${res.status})`);
  }
  const buf = await res.arrayBuffer();
  const bytes = new Uint8Array(buf);
  if (bytes.byteLength === 0) {
    throw new Error(failLabel);
  }

  const file = new File(Paths.cache, fileNameFromPath(pathWithQuery));
  file.create({ overwrite: true });
  file.write(bytes);

  try {
    // iOS: share the file URL only (message alone can drop the attachment).
    if (Platform.OS === 'ios') {
      await Share.share({ url: file.uri });
    } else {
      await Share.share({
        url: file.uri,
        message: shareMessage,
        title: shareMessage,
      });
    }
    return;
  } catch {
    // Fall through to Linking if the share sheet is unavailable.
  }

  const canOpen = await Linking.canOpenURL(file.uri);
  if (canOpen) {
    await Linking.openURL(file.uri);
    return;
  }

  throw new Error(failLabel);
}

export function withPdfOptions(
  path: string,
  opts?: PdfDownloadOptions,
): string {
  if (!opts) return path;
  return `${path}${pdfQuery(opts)}`;
}
