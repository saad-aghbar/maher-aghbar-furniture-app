/**
 * QR session id helper. Logging is intentionally silent — keep call sites
 * cheap to re-enable for a handset debug pass if needed.
 */
let nextSession = 1;

export function beginQrSession(_label = 'scan'): number {
  return nextSession++;
}

export function qrLog(_session: number, _message: string): void {}

export function qrWarn(_session: number, _message: string): void {}
