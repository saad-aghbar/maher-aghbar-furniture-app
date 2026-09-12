/** Arabic-first factory instructions shared across every stage of one order item. */

export function joinTrilingualNotes(
  ar?: string | null,
  en?: string | null,
  he?: string | null,
): string | null {
  return (
    [ar, en, he]
      .map((value) => String(value ?? '').trim())
      .filter(Boolean)
      .join('\n') || null
  );
}

export function pickLocalizedInstruction(
  locale: string | undefined,
  ar?: string | null,
  en?: string | null,
  he?: string | null,
): string {
  const arT = String(ar ?? '').trim();
  const enT = String(en ?? '').trim();
  const heT = String(he ?? '').trim();
  const code = String(locale ?? '').toLowerCase();
  if (code.startsWith('ar')) return arT || enT || heT;
  if (code.startsWith('he')) return heT || arT || enT;
  return enT || arT || heT;
}
