/** Reject Expo / URL-shaped values so printed QR stays a plain inventory code. */
const MOCK_SCAN_CODE = /^(exp:|https?:|file:)/i;

/**
 * Normalize a stored scan string for labels and lookup.
 * Empty or URL-shaped values become `fallback` (default em dash).
 */
export function printableScanCode(value?: string | null, fallback = '—'): string {
  const v = String(value ?? '').trim();
  if (!v || MOCK_SCAN_CODE.test(v)) return fallback;
  return v;
}

/**
 * Authoritative printed QR payload for an inventory item.
 * Prefer a real `qrCode`; otherwise the SKU. Never encode stock or URLs.
 */
export function inventoryScanPayload(item: {
  sku: string;
  qrCode?: string | null;
}): string {
  return printableScanCode(item.qrCode, '') || item.sku;
}

/** Prefixes for factory-floor WIP scan payloads (not URLs). */
export const WIP_KIT_QR_PREFIX = 'WIPKIT:';
export const WIP_PIECE_QR_PREFIX = 'WIPPIECE:';

export function wipKitScanPayload(kit: { qrCode: string; id?: string }): string {
  const code = printableScanCode(kit.qrCode, '');
  if (code) return code;
  return kit.id ? `${WIP_KIT_QR_PREFIX}${kit.id}` : '—';
}

export function wipPieceScanPayload(piece: { qrCode?: string | null; id: string }): string {
  const code = printableScanCode(piece.qrCode, '');
  if (code) return code;
  return `${WIP_PIECE_QR_PREFIX}${piece.id}`;
}

export function parseWipScanCode(raw: string): {
  kind: 'kit' | 'piece' | 'unknown';
  idOrCode: string;
} {
  const v = String(raw ?? '').trim();
  if (v.startsWith(WIP_KIT_QR_PREFIX)) {
    return { kind: 'kit', idOrCode: v.slice(WIP_KIT_QR_PREFIX.length) };
  }
  if (v.startsWith(WIP_PIECE_QR_PREFIX)) {
    return { kind: 'piece', idOrCode: v.slice(WIP_PIECE_QR_PREFIX.length) };
  }
  return { kind: 'unknown', idOrCode: v };
}
