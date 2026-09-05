import { localizedName } from '@maher/i18n';

const MACHINE_CODE = /^[A-Z0-9]+(?:[_-][A-Z0-9]+)+$/;
const ALL_CAPS_TOKEN = /^[A-Z0-9_]{4,}$/;
const RTL_SCRIPT = /[\u0600-\u06FF\u0750-\u077F\u0590-\u05FF]/;

type NamedWorkflow = {
  code?: string | null;
  nameEn?: string | null;
  nameAr?: string | null;
  nameHe?: string | null;
};

export function isMachineWorkflowCode(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  return MACHINE_CODE.test(trimmed) || ALL_CAPS_TOKEN.test(trimmed);
}

/** SNAKE_CODE → "Snake code" — sentence case, never shouty. */
export function humanizeWorkflowCode(code: string): string {
  const words = code
    .trim()
    .replace(/[_-]+/g, ' ')
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  const [first, ...rest] = words;
  if (!first) return '';
  return [first.charAt(0).toUpperCase() + first.slice(1), ...rest].join(' ');
}

export function toSentenceCaseName(value: string): string {
  const trimmed = value.trim();
  if (!trimmed || RTL_SCRIPT.test(trimmed)) return trimmed;
  const lower = trimmed.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

/**
 * Floor-facing workflow title. Never returns an ALL-CAPS machine code.
 */
function isMissingName(value: string): boolean {
  return !value || value === '—' || value === '-';
}

export function workflowDisplayName(locale: string, row: NamedWorkflow): string {
  const raw = localizedName(locale, row, '').trim();
  const code = String(row.code ?? '').trim();
  if (
    isMissingName(raw) ||
    isMachineWorkflowCode(raw) ||
    (code && raw === code)
  ) {
    return humanizeWorkflowCode(code || raw);
  }
  return toSentenceCaseName(raw);
}
