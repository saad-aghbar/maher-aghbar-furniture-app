/**
 * Pull a late / not-started status fragment out of line-item copy so the
 * order-detail row can render it as a pill. Text is preserved as-is.
 */

const FRAGMENT =
  '((?:LATE|Late)\\s+not\\s+started|not\\s+started|NOT_STARTED|LATE|Late)';
const TRAILING = new RegExp(`(?:\\s*[—–·|]\\s*|\\s+)${FRAGMENT}$`, 'i');
const WHOLE = new RegExp(`^${FRAGMENT}$`, 'i');

export function splitLineStatusFragment(raw: string | null | undefined): {
  text: string;
  fragment: string | null;
} {
  const text = raw?.trim() ?? '';
  if (!text) return { text: '', fragment: null };

  const whole = text.match(WHOLE);
  if (whole?.[1]) return { text: '', fragment: whole[1] };

  const trailing = text.match(TRAILING);
  if (trailing?.[1] && trailing.index != null && trailing.index > 0) {
    return {
      text: text.slice(0, trailing.index).trim(),
      fragment: trailing[1],
    };
  }

  return { text, fragment: null };
}

/** StatusBadge key — meaning unchanged; LATE reads amber/warn. */
export function lineStatusBadgeStatus(fragment: string): string {
  return /late/i.test(fragment) ? 'LATE' : 'NOT_STARTED';
}
