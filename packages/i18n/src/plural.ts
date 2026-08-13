/**
 * Arabic plural selection (0 / 1 / 2 / 3–10 / 11+).
 * Pass fully formed phrases, e.g. { zero: 'لا طلبيات', one: 'طلبية واحدة', two: 'طلبيتان', few: '{n} طلبيات', many: '{n} طلبية' }.
 */
export type ArabicPluralForms = {
  zero: string;
  one: string;
  two: string;
  few: string;
  many: string;
};

export function arabicPluralCategory(count: number): keyof ArabicPluralForms {
  const n = Math.abs(Math.trunc(count));
  if (n === 0) return 'zero';
  if (n === 1) return 'one';
  if (n === 2) return 'two';
  if (n >= 3 && n <= 10) return 'few';
  return 'many';
}

export function pluralAr(count: number, forms: ArabicPluralForms): string {
  const phrase = forms[arabicPluralCategory(count)];
  return phrase.replace(/\{n\}/g, String(count)).replace(/\{count\}/g, String(count));
}

const PLURAL_SUFFIX: Record<keyof ArabicPluralForms, string> = {
  zero: 'Zero',
  one: 'One',
  two: 'Two',
  few: 'Few',
  many: 'Many',
};

/**
 * Resolve `baseKey` + Zero/One/Two/Few/Many for the Arabic category.
 * English/Hebrew still benefit (day vs days) when those sibling keys exist.
 * Falls back to `baseKey` when a specific form is missing.
 */
export function pickPluralKey(baseKey: string, count: number): string {
  return `${baseKey}${PLURAL_SUFFIX[arabicPluralCategory(count)]}`;
}
