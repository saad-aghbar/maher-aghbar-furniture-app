/**
 * Parse free-text order search into a calendar day or month window (UTC).
 * Supports ISO dates, English month names, and common numeric forms.
 */
export type SearchDateWindow = { gte: Date; lte: Date };

const MONTHS: Array<{ keys: string[]; month: number }> = [
  { keys: ['jan', 'january'], month: 0 },
  { keys: ['feb', 'february'], month: 1 },
  { keys: ['mar', 'march'], month: 2 },
  { keys: ['apr', 'april'], month: 3 },
  { keys: ['may'], month: 4 },
  { keys: ['jun', 'june'], month: 5 },
  { keys: ['jul', 'july'], month: 6 },
  { keys: ['aug', 'august'], month: 7 },
  { keys: ['sep', 'sept', 'september'], month: 8 },
  { keys: ['oct', 'october'], month: 9 },
  { keys: ['nov', 'november'], month: 10 },
  { keys: ['dec', 'december'], month: 11 },
];

function utcDay(year: number, month: number, day: number): SearchDateWindow {
  return {
    gte: new Date(Date.UTC(year, month, day, 0, 0, 0, 0)),
    lte: new Date(Date.UTC(year, month, day, 23, 59, 59, 999)),
  };
}

function utcMonth(year: number, month: number): SearchDateWindow {
  return {
    gte: new Date(Date.UTC(year, month, 1, 0, 0, 0, 0)),
    lte: new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999)),
  };
}

function findMonth(token: string): number | null {
  const t = token.toLowerCase();
  for (const m of MONTHS) {
    if (m.keys.includes(t)) return m.month;
  }
  return null;
}

/** Returns a day or month window when `q` looks date-like; otherwise null. */
export function tryParseSearchDateWindow(
  q: string,
  now = new Date(),
): SearchDateWindow | null {
  const raw = q.trim().replace(/\s+/g, ' ');
  if (!raw) return null;

  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (iso) {
    return utcDay(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  }

  const numeric = /^(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?$/.exec(raw);
  if (numeric) {
    const a = Number(numeric[1]);
    const b = Number(numeric[2]);
    let year = numeric[3] ? Number(numeric[3]) : now.getUTCFullYear();
    if (year < 100) year += 2000;
    // Prefer D/M when first part > 12; otherwise treat as D/M (app locale JO).
    const day = a;
    const month = b - 1;
    if (month < 0 || month > 11 || day < 1 || day > 31) return null;
    return utcDay(year, month, day);
  }

  const tokens = raw.toLowerCase().split(' ').filter(Boolean);
  if (tokens.length === 1) {
    const monthOnly = findMonth(tokens[0]!);
    if (monthOnly != null) return utcMonth(now.getUTCFullYear(), monthOnly);
    return null;
  }

  if (tokens.length === 2 || tokens.length === 3) {
    let day: number | null = null;
    let month: number | null = null;
    let year = now.getUTCFullYear();
    for (const tok of tokens) {
      const m = findMonth(tok);
      if (m != null) {
        month = m;
        continue;
      }
      if (/^\d{4}$/.test(tok)) {
        year = Number(tok);
        continue;
      }
      if (/^\d{1,2}$/.test(tok)) {
        day = Number(tok);
      }
    }
    if (month != null && day != null) return utcDay(year, month, day);
    if (month != null && day == null && tokens.length <= 2) {
      return utcMonth(year, month);
    }
  }

  return null;
}
