import type { DeliveryLoadProduct, DeliveryLoadSheet } from '@/api/modules/deliveries';

/** Match FIN lot QR to next unchecked package on this load (checklist packages; lot QR is the scan key). */
export function nextUnloadPieceForLotQr(
  sheet: Pick<DeliveryLoadSheet, 'products'>,
  rawCode: string,
): { pieceId: string; product: DeliveryLoadProduct } | 'unknown' | 'already_loaded' {
  const code = rawCode.trim().toUpperCase();
  if (!code) return 'unknown';
  const product = sheet.products.find(
    (p) => (p.lotQrCode ?? '').trim().toUpperCase() === code,
  );
  if (!product) return 'unknown';
  const next = product.pieces
    .slice()
    .sort((a, b) => a.pieceIndex - b.pieceIndex)
    .find((p) => !p.loadedAt);
  if (!next) return 'already_loaded';
  return { pieceId: next.id, product };
}
