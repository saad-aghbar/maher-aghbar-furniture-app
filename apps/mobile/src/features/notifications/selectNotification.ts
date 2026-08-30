import type { AppNotification } from './api';

export type NotificationCardModel = {
  id: string;
  type: string;
  title: string;
  body: string;
  unread: boolean;
  createdAt: string;
  linkUrl: string | null;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HUMAN_ORDER_CODE_RE = /^(?:[A-Za-z]{1,8}-?\d[\w-]*|[A-Z]{2,}\d+)$/;

const VAR_KEYS = [
  'orderNumber',
  'orderCode',
  'orderNo',
  'number',
  'orderId',
  'version',
  'date',
  'reason',
  'total',
  'taskName',
  'amount',
  'jobNumber',
] as const;

function asTrimmedString(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function collectVars(source: Record<string, unknown>, into: Record<string, string>) {
  for (const key of VAR_KEYS) {
    const value = asTrimmedString(source[key]);
    if (value && into[key] == null) into[key] = value;
  }
}

function orderCodeFromLink(linkUrl?: string | null): string | null {
  if (!linkUrl) return null;
  const last = linkUrl.split('/').filter(Boolean).pop() ?? '';
  let decoded = last.split('?')[0] ?? '';
  try {
    decoded = decodeURIComponent(decoded);
  } catch {
    // keep raw segment
  }
  decoded = decoded.trim();
  if (!decoded || UUID_RE.test(decoded)) return null;
  return HUMAN_ORDER_CODE_RE.test(decoded) ? decoded : null;
}

/**
 * Pull interpolation values from the notification payload when the API includes them.
 * Never invents ids — empty when the row has none.
 */
export function notificationTemplateVars(row: AppNotification): Record<string, string> {
  const vars: Record<string, string> = {};
  const rec = row as AppNotification & Record<string, unknown>;
  collectVars(rec, vars);
  for (const nestedKey of ['vars', 'data', 'metadata', 'payload'] as const) {
    const nested = rec[nestedKey];
    if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
      collectVars(nested as Record<string, unknown>, vars);
    }
  }
  const fromLink = orderCodeFromLink(row.linkUrl);
  if (fromLink) {
    if (!vars.orderNumber) vars.orderNumber = fromLink;
    if (!vars.number) vars.number = fromLink;
  }
  if (vars.orderNumber && !vars.number) vars.number = vars.orderNumber;
  if (vars.number && !vars.orderNumber) vars.orderNumber = vars.number;
  if (vars.version && vars.v == null) vars.v = vars.version;
  else if (!vars.version && vars.orderNumber && vars.v == null) vars.v = vars.orderNumber;
  return vars;
}

function insertOrderRef(text: string, orderRef: string): string {
  let out = text;
  out = out.replace(/\bfor order(?=\s+is\b)/i, `for order ${orderRef}`);
  out = out.replace(/لأمر الإنتاج(?=\s+وينتظر)/, `لأمر الإنتاج ${orderRef}`);
  out = out.replace(/להזמנה(?=\s+ממתין)/, `להזמנה ${orderRef}`);
  return out;
}

/**
 * Fill leftover `{{var}}` / `{var}` tokens, drop raw `(v)` / missing i18n holes,
 * and surface a real order code when the payload has one.
 */
export function polishNotificationCopy(text: string, vars: Record<string, string>): string {
  if (!text) return '';
  let out = text.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key: string) => vars[key] ?? '');
  out = out.replace(/\{(\w+)\}/g, (_, key: string) => vars[key] ?? '');
  out = out.replace(/\(\s*(?:v|version|نسخة|גרסה)\s*\)/gi, '');
  out = out.replace(/\(\s*\)/g, '');
  out = out.replace(/[ \t]{2,}/g, ' ');
  out = out.replace(/\s+([,.;:!?])/g, '$1');

  const orderRef = vars.orderNumber || vars.number || vars.orderCode || null;
  if (orderRef) {
    out = insertOrderRef(out, orderRef);
  } else {
    out = out.replace(/\s+for order(?=\s+is\b)/i, '');
  }

  out = out.replace(/[ \t]{2,}/g, ' ');
  return out.trim();
}

export type NotificationDaySection = {
  key: string;
  label: string;
  data: NotificationCardModel[];
};

/** Ionicons glyph keys used by notification boards. */
export type NotificationIconName =
  | 'notifications-outline'
  | 'cube-outline'
  | 'receipt-outline'
  | 'construct-outline'
  | 'return-down-back-outline'
  | 'sparkles-outline'
  | 'clipboard-outline'
  | 'document-text-outline'
  | 'wallet-outline';

export function selectNotificationCard(
  row: AppNotification,
  locale: string,
): NotificationCardModel {
  const ar = locale === 'ar' || locale === 'he';
  const vars = notificationTemplateVars(row);
  const rawTitle = ar
    ? row.titleAr || row.titleEn || row.type
    : row.titleEn || row.titleAr || row.type;
  const rawBody = ar ? row.bodyAr || row.bodyEn || '' : row.bodyEn || row.bodyAr || '';
  return {
    id: row.id,
    type: row.type,
    title: polishNotificationCopy(rawTitle, vars),
    body: polishNotificationCopy(rawBody, vars),
    unread: !row.readAt,
    createdAt: row.createdAt,
    linkUrl: row.linkUrl ?? null,
  };
}

/** Normalize API list (array or paginated) into a flat list. */
export function normalizeNotificationList(
  payload: AppNotification[] | { data?: AppNotification[] } | undefined,
): AppNotification[] {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  return payload.data ?? [];
}

export function unreadCount(rows: AppNotification[]): number {
  return rows.filter((r) => !r.readAt).length;
}

function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

/** Group cards by calendar day (newest first). */
export function groupNotificationsByDay(
  items: NotificationCardModel[],
  formatDayLabel: (isoDate: string) => string,
): NotificationDaySection[] {
  const map = new Map<string, NotificationCardModel[]>();
  for (const item of items) {
    const key = dayKey(item.createdAt) || 'unknown';
    const bucket = map.get(key) ?? [];
    bucket.push(item);
    map.set(key, bucket);
  }
  return [...map.entries()]
    .sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0))
    .map(([key, data]) => ({
      key,
      label: key === 'unknown' ? key : formatDayLabel(key),
      data,
    }));
}

/**
 * Pick a board icon from notification type and/or deep-link path.
 */
export function notificationIconFor(
  type: string,
  linkUrl?: string | null,
): NotificationIconName {
  const hay = `${type} ${linkUrl ?? ''}`.toLowerCase();

  if (/invoice|payment|statement|wallet|receivable/.test(hay)) return 'receipt-outline';
  if (/return/.test(hay)) return 'return-down-back-outline';
  if (/ai[-_]?intake|spark|ocr|intake/.test(hay)) return 'sparkles-outline';
  if (/task|assign|worker|production/.test(hay)) return 'construct-outline';
  if (/request|rfq|quotation|quote/.test(hay)) return 'document-text-outline';
  if (/order|sales[-_]?order|so[-_]/.test(hay)) return 'cube-outline';
  if (/clipboard|note/.test(hay)) return 'clipboard-outline';
  if (/pay|money|balance/.test(hay)) return 'wallet-outline';
  return 'notifications-outline';
}
