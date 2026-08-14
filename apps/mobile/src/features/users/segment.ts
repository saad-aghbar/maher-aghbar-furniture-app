import type { UserIdentityForm } from '@maher/permissions';

export type UsersSegment = 'workers' | 'staff' | 'customers' | 'admins' | 'all';

export const SEGMENT_ROLE_KIND: Record<Exclude<UsersSegment, 'all'>, string> = {
  workers: 'PRODUCTION_WORKER',
  staff: 'STAFF',
  customers: 'CUSTOMER',
  admins: 'ADMIN',
};

/** Identity role codes for Customer / Admin chips. */
export const SEGMENT_ROLE_CODE: Record<'customers' | 'admins', string> = {
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

export function roleKindForSegment(segment: UsersSegment): string | undefined {
  if (segment === 'all') return undefined;
  return SEGMENT_ROLE_KIND[segment];
}

export function roleCodeForSegment(segment: UsersSegment): string | undefined {
  if (segment === 'customers') return 'CUSTOMER';
  if (segment === 'admins') return 'SYSTEM_ADMINISTRATOR';
  return undefined;
}

export function identityFromSegment(segment: UsersSegment): UserIdentityForm {
  if (segment === 'workers') {
    return {
      identityRoleCode: 'PRODUCTION_WORKER',
      employeeType: 'WORKER',
      staffTypeId: '',
      stageDefinitionIds: [],
    };
  }
  if (segment === 'staff') {
    return {
      identityRoleCode: 'PRODUCTION_WORKER',
      employeeType: 'STAFF',
      staffTypeId: '',
      stageDefinitionIds: [],
    };
  }
  if (segment === 'customers') {
    return {
      identityRoleCode: 'CUSTOMER',
      employeeType: '',
      staffTypeId: '',
      stageDefinitionIds: [],
    };
  }
  if (segment === 'admins') {
    return {
      identityRoleCode: 'SYSTEM_ADMINISTRATOR',
      employeeType: '',
      staffTypeId: '',
      stageDefinitionIds: [],
    };
  }
  return {
    identityRoleCode: '',
    employeeType: '',
    staffTypeId: '',
    stageDefinitionIds: [],
  };
}
