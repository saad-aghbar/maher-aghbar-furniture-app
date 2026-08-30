/**
 * Display-only helpers for admin dealer chrome (list + detail). No API / count changes.
 */

const BLANK_CONTACT = new Set(['', '-', '—', '–', '−']);

/** True when a contact field has a real value (not empty or a dash placeholder). */
export function hasVisibleContact(value: string | null | undefined): boolean {
  return !BLANK_CONTACT.has((value ?? '').trim());
}

/**
 * Subtitle under the dealer name. Drop it when company name repeats the title.
 * With no company name, fall back to the dealer-type label.
 */
export function dealerIdentitySubtitle(
  name: string,
  companyName: string | null | undefined,
  typeLabel: string,
): string | null {
  const company = companyName?.trim() ?? '';
  if (!company) return typeLabel || null;
  if (company === name.trim()) return null;
  return company;
}
