export type UsersSegment = 'staff' | 'customers' | 'admins' | 'all';

export const SEGMENT_ROLE_CODE: Record<Exclude<UsersSegment, 'all'>, string> = {
  staff: 'PRODUCTION_WORKER',
  customers: 'CUSTOMER',
  admins: 'SYSTEM_ADMINISTRATOR',
};

/** Derive first/last name from username (matches admin-web create flow). */
export function namesFromUsername(username: string): { firstName: string; lastName: string } {
  const normalized = username.trim().toLowerCase();
  const parts = normalized.split(/[._-]+/).filter(Boolean);
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  if (parts.length >= 2) {
    return {
      firstName: cap(parts[0] ?? normalized),
      lastName: cap(parts.slice(1).join(' ')),
    };
  }
  const single = cap(normalized || 'User');
  return { firstName: single, lastName: single };
}

export function roleCodeForSegment(segment: UsersSegment): string | undefined {
  if (segment === 'all') return undefined;
  return SEGMENT_ROLE_CODE[segment];
}
