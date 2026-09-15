/** Browser BarcodeDetector format names aligned with the mobile camera scanner. */
export const BARCODE_FORMATS = [
  'qr_code',
  'ean_13',
  'ean_8',
  'upc_a',
  'upc_e',
  'code_128',
  'code_39',
  'code_93',
  'itf',
  'codabar',
] as const;

export type BarcodeFormat = (typeof BARCODE_FORMATS)[number];

export function normalizeScanCode(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim();
}

export function isScanWorthy(raw: string): boolean {
  return normalizeScanCode(raw).length >= 1;
}

export type UsbWedgeState = {
  buffer: string;
  lastAt: number;
};

export const USB_WEDGE_IDLE_MS = 80;

/**
 * USB / keyboard-wedge scanners type the payload then send Enter.
 * Idle gaps reset the buffer so ordinary typing in other fields is ignored
 * when this helper is only fed while the scanner modal is open.
 */
export function applyUsbWedgeChar(
  state: UsbWedgeState,
  key: string,
  now: number,
  idleMs = USB_WEDGE_IDLE_MS,
): { state: UsbWedgeState; complete: string | null } {
  if (now - state.lastAt > idleMs) {
    state = { buffer: '', lastAt: now };
  }
  if (key === 'Enter') {
    const complete = normalizeScanCode(state.buffer);
    return { state: { buffer: '', lastAt: now }, complete: complete || null };
  }
  if (key.length === 1) {
    return { state: { buffer: state.buffer + key, lastAt: now }, complete: null };
  }
  if (key === 'Backspace') {
    return {
      state: { buffer: state.buffer.slice(0, -1), lastAt: now },
      complete: null,
    };
  }
  return { state: { ...state, lastAt: now }, complete: null };
}

export function emptyUsbWedge(now = 0): UsbWedgeState {
  return { buffer: '', lastAt: now };
}
