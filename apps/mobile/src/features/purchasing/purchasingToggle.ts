export function toggleIdInRecord<T>(
  current: Record<string, T>,
  id: string,
  create: () => T,
): Record<string, T> {
  if (current[id]) {
    const next = { ...current };
    delete next[id];
    return next;
  }
  return { ...current, [id]: create() };
}

export function toggleIdInSet(current: Set<string>, id: string): Set<string> {
  const next = new Set(current);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

export function toggleExclusiveValue<T extends string>(
  current: T,
  next: T,
  idle: T,
): T {
  return current === next ? idle : next;
}

export function toggleArrayValue<T>(current: T[], value: T): T[] {
  return current.includes(value)
    ? current.filter((item) => item !== value)
    : [...current, value];
}
