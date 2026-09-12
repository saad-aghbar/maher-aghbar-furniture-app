export function parseHourlyRateInput(value: string): number | undefined {
  const trimmed = value.trim().replace(',', '.');
  if (!trimmed) return undefined;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 0) return undefined;
  return n;
}

export function hourlyRateDisplay(value: number | null | undefined): string {
  if (value == null) return '';
  return String(value);
}
