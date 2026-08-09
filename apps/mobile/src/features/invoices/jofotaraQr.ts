/** Normalize JoFotara QR payload into an Image-compatible URI when possible. */
export function qrImageSrc(qr: string): string | null {
  if (qr.startsWith('data:image/')) return qr;
  if (/^[A-Za-z0-9+/=]+$/.test(qr) && qr.length > 100) {
    return `data:image/png;base64,${qr}`;
  }
  return null;
}
