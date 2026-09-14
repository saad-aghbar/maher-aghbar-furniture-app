export type FloorNoteTranslate = (
  key: string,
  vars?: Record<string, string | number>,
) => string;

const ARABIC = /[\u0600-\u06FF]/;
const HEBREW = /[\u0590-\u05FF]/;
const I18N_KEY = /^(mobile|common|statuses|catalog|navigation|production)\.[a-zA-Z0-9.]+$/;

export function hasRtlScript(text: string): boolean {
  return ARABIC.test(text) || HEBREW.test(text);
}

export function looksLikeI18nKey(text: string): boolean {
  return I18N_KEY.test(text.trim());
}

export function extractLeadingRef(text: string): { ref: string; rest: string } | null {
  const match = text.trim().match(/^([A-Z0-9][A-Z0-9._/-]{1,24})\s*:\s*(.+)$/);
  if (!match?.[1] || !match[2]) return null;
  return { ref: match[1], rest: match[2] };
}

function resolved(t: FloorNoteTranslate, key: string, vars?: Record<string, string | number>): string | null {
  const value = vars ? t(key, vars) : t(key);
  if (!value || value === key) return null;
  return value;
}

function matchSeedBlocker(body: string): 'missingPackaging' | 'semiHandoff' | null {
  const n = body.toLowerCase();
  if (/missing.+packag/.test(n) || /back package/.test(n)) return 'missingPackaging';
  if (/semi\s+handoff/.test(n)) return 'semiHandoff';
  return null;
}

/**
 * Shop-floor free text: translate catalog keys and known demo English,
 * keep worker Arabic/Hebrew, keep English in the English UI.
 */
export function localizeFloorNote(
  t: FloorNoteTranslate,
  locale: string,
  raw: string | null | undefined,
): string {
  const text = raw?.trim() ?? '';
  if (!text) return '';

  if (looksLikeI18nKey(text)) {
    return resolved(t, text) ?? text;
  }

  const split = extractLeadingRef(text);
  const body = split?.rest ?? text;
  const seedKey = matchSeedBlocker(body) ?? matchSeedBlocker(text);
  if (seedKey) {
    if (split) {
      const withRef = resolved(t, `mobile.tasks.seedBlockers.${seedKey}WithRef`, {
        ref: split.ref,
      });
      if (withRef) return withRef;
    }
    const plain = resolved(t, `mobile.tasks.seedBlockers.${seedKey}`);
    if (plain) return plain;
  }

  if (hasRtlScript(text) || locale === 'en') return text;

  if (/seed\s+(blocker|p\d)/i.test(text)) {
    if (split) {
      const withRef = resolved(t, 'mobile.tasks.seedBlockers.genericWithRef', {
        ref: split.ref,
      });
      if (withRef) return withRef;
    }
    return resolved(t, 'mobile.tasks.seedBlockers.generic') ?? text;
  }

  return text;
}
