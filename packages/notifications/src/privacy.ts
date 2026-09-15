const SENSITIVE_KEY =
  /^(?:.*(?:cost|margin|price|rate|secret|password|amount|total|salary|wage|unitCost|unit_cost|supplierPrice|privateNote|internalNote|note|reason|resolution).*)$/i;

/** Vars allowed on the lock-screen banner. */
export const SAFE_PUSH_VAR_KEYS = new Set([
  'number',
  'orderNumber',
  'taskName',
  'stage',
  'nextStage',
  'date',
  'sku',
  'jobNumber',
  'count',
  'customerName',
  'delivery',
  'invoice',
  'items',
  'model',
  'productName',
]);

export function isSensitivePushKey(key: string): boolean {
  if (SAFE_PUSH_VAR_KEYS.has(key)) return false;
  return SENSITIVE_KEY.test(key);
}

export function sanitizePushVars(
  vars: Record<string, string | number | null | undefined> | undefined,
): Record<string, string> {
  const out: Record<string, string> = {};
  if (!vars) return out;
  for (const [key, value] of Object.entries(vars)) {
    if (!SAFE_PUSH_VAR_KEYS.has(key)) continue;
    if (value == null) continue;
    const text = String(value).trim();
    if (!text) continue;
    out[key] = text;
  }
  return out;
}

function fill(template: string, vars: Record<string, string>): string {
  return template
    .replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key: string) => vars[key] ?? '')
    .replace(/\{(\w+)\}/g, (_, key: string) => vars[key] ?? '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .trim();
}

export function renderSafePushText(
  template: string,
  vars: Record<string, string | number | null | undefined> | Record<string, string>,
): string {
  const safe = sanitizePushVars(vars);
  return fill(template, safe);
}

/** Used in tests to prove money / notes never survive onto the lock screen. */
export function pushPayloadLooksSensitive(text: string): boolean {
  const hay = text.toLowerCase();
  if (/\b(margin|unit cost|supplier price|hourly rate|ils|₪|شيكل)\b/.test(hay)) return true;
  if (/\b(password|secret|api[_-]?key)\b/.test(hay)) return true;
  if (/\{\{\s*(amount|total|cost|margin|rate|note|reason|resolution)\s*\}\}/i.test(text)) {
    return true;
  }
  return false;
}
