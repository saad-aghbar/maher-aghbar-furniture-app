export type IncomingWipScanKind = 'match' | 'raw' | 'wrong_kit' | 'unknown';

type EligibleKit = {
  kitId?: string;
  qrCode: string | null;
};

function normalizeCode(value: string): string {
  return value.trim().toUpperCase();
}

/**
 * Local preview of a WIP take-in scan so the worker sees match / raw / wrong-kit
 * before confirming receive (which is the mutating API).
 */
export function classifyIncomingWipScan(
  code: string,
  eligible: EligibleKit[],
): IncomingWipScanKind {
  const needle = normalizeCode(code);
  if (!needle) return 'unknown';

  const match = eligible.find((kit) => {
    const qr = kit.qrCode ? normalizeCode(kit.qrCode) : '';
    return Boolean(qr) && qr === needle;
  });
  if (match) return 'match';

  if (/^(MAT-|BIN-)/.test(needle)) return 'raw';
  if (/^WIP-/.test(needle)) return 'wrong_kit';
  return 'unknown';
}

export function matchedEligibleKit<T extends EligibleKit>(
  code: string,
  eligible: T[],
): T | undefined {
  const needle = normalizeCode(code);
  if (!needle) return undefined;
  return eligible.find((kit) => {
    const qr = kit.qrCode ? normalizeCode(kit.qrCode) : '';
    return Boolean(qr) && qr === needle;
  });
}
