import {
  defaultLocale,
  getMessages,
  pickPluralKey,
  type MessageNamespace,
  type MessageValue,
} from '@maher/i18n';
import type { Locale } from '@maher/types';

function lookupPath(root: MessageValue, parts: string[]): string | undefined {
  let cur: MessageValue | undefined = root;
  for (const part of parts) {
    if (cur == null || typeof cur === 'string') return undefined;
    cur = cur[part];
  }
  return typeof cur === 'string' ? cur : undefined;
}

/**
 * Translate `namespace.key` or `namespace.nested.path`.
 * Falls back to English, then the key itself.
 */
export function translate(locale: Locale, key: string, vars?: Record<string, string | number>): string {
  const dot = key.indexOf('.');
  if (dot <= 0) return key;
  const ns = key.slice(0, dot) as MessageNamespace;
  const path = key.slice(dot + 1);
  const parts = path.split('.');

  const primary = getMessages(locale)[ns];
  let raw =
    primary != null ? lookupPath(primary as MessageValue, parts) : undefined;

  if (raw == null && locale !== 'en') {
    const en = getMessages('en')[ns];
    raw = en != null ? lookupPath(en as MessageValue, parts) : undefined;
  }

  if (raw == null && locale !== defaultLocale) {
    const def = getMessages(defaultLocale)[ns];
    raw = def != null ? lookupPath(def as MessageValue, parts) : undefined;
  }

  if (raw == null) return key;

  if (!vars) return raw;
  return raw.replace(/\{(\w+)\}/g, (_, name: string) =>
    vars[name] != null ? String(vars[name]) : `{${name}}`,
  );
}

/**
 * Count-aware lookup: tries `baseKeyZero|One|Two|Few|Many`, then `baseKey`.
 * `countVar` is interpolated as both `{n}` and `{count}` when present.
 */
export function translatePlural(
  locale: Locale,
  baseKey: string,
  count: number,
  extra?: Record<string, string | number>,
): string {
  const vars = { n: count, count, ...extra };
  const specificKey = pickPluralKey(baseKey, count);
  const specific = translate(locale, specificKey, vars);
  if (specific !== specificKey) return specific;
  return translate(locale, baseKey, vars);
}
