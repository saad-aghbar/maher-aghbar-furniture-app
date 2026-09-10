/** Content-Type from a storage key / filename. Audio must be honest for iOS playback. */
export function mimeFromKey(key: string): string {
  const ext = key.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    case 'gif':
      return 'image/gif';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'pdf':
      return 'application/pdf';
    case 'm4a':
    case 'mp4':
      return 'audio/mp4';
    case 'aac':
      return 'audio/aac';
    case 'mp3':
    case 'mpeg':
      return 'audio/mpeg';
    case 'wav':
      return 'audio/wav';
    case 'webm':
      return 'audio/webm';
    case 'ogg':
    case 'oga':
      return 'audio/ogg';
    default:
      return 'application/octet-stream';
  }
}

/** Inline for types a player or browser should render, not download. */
export function dispositionFor(mime: string): 'inline' | 'attachment' {
  if (mime.startsWith('image/') || mime.startsWith('audio/')) return 'inline';
  return 'attachment';
}
