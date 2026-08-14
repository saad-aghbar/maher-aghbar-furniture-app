import {
  namesFromUsername,
  roleCodeForSegment,
  roleKindForSegment,
  identityFromSegment,
  SEGMENT_ROLE_KIND,
} from '../segment';
import {
  isCustomerUser,
  localizedDepartmentName,
  roleUsesDepartment,
  userDisplayName,
  userRoleLabels,
  userShowsDepartment,
} from '../display';
import type { UserRow } from '@/api/modules/users';

describe('users segment helpers', () => {
  it('maps worker/staff segments to role kinds', () => {
    expect(roleKindForSegment('workers')).toBe(SEGMENT_ROLE_KIND.workers);
    expect(roleKindForSegment('staff')).toBe(SEGMENT_ROLE_KIND.staff);
    expect(roleKindForSegment('customers')).toBe('CUSTOMER');
    expect(roleKindForSegment('admins')).toBe('ADMIN');
    expect(roleKindForSegment('all')).toBeUndefined();
  });

  it('keeps customer/admin identity codes for chips', () => {
    expect(roleCodeForSegment('staff')).toBeUndefined();
    expect(roleCodeForSegment('workers')).toBeUndefined();
    expect(roleCodeForSegment('customers')).toBe('CUSTOMER');
    expect(roleCodeForSegment('admins')).toBe('SYSTEM_ADMINISTRATOR');
    expect(roleCodeForSegment('all')).toBeUndefined();
  });

  it('prefills identity from the list segment', () => {
    expect(identityFromSegment('workers').employeeType).toBe('WORKER');
    expect(identityFromSegment('staff').employeeType).toBe('STAFF');
    expect(identityFromSegment('customers').identityRoleCode).toBe('CUSTOMER');
    expect(identityFromSegment('admins').identityRoleCode).toBe('SYSTEM_ADMINISTRATOR');
  });

  it('derives first/last name from username', () => {
    expect(namesFromUsername('anas.freijat')).toEqual({
      firstName: 'Anas',
      lastName: 'Freijat',
    });
    expect(namesFromUsername('driver2')).toEqual({
      firstName: 'Driver2',
      lastName: 'Driver2',
    });
  });
});

describe('users display helpers', () => {
  const base: UserRow = {
    id: '1',
    username: 'driver2',
    email: null,
    phone: null,
    firstName: 'Anas',
    lastName: 'Freijat',
    preferredLanguage: 'ar',
    isActive: true,
    lastLoginAt: null,
    customerId: null,
    department: {
      id: 'd1',
      code: 'DEL',
      nameEn: 'Delivery',
      nameAr: 'التوصيل',
    },
    roles: [
      {
        role: {
          id: 'r1',
          code: 'PRODUCTION_WORKER',
          nameEn: 'Worker',
          nameAr: 'عامل',
          kind: 'PRODUCTION_WORKER',
        },
      },
    ],
  };

  it('formats display name and roles', () => {
    expect(userDisplayName(base)).toBe('Anas Freijat');
    expect(userRoleLabels(base, 'en')).toBe('Worker');
    expect(userRoleLabels(base, 'ar')).toBe('عامل');
    expect(localizedDepartmentName(base.department, 'en')).toBe('Delivery');
    expect(isCustomerUser(base)).toBe(false);
  });

  it('detects customer role', () => {
    const customer: UserRow = {
      ...base,
      roles: [{ role: { id: 'c', code: 'CUSTOMER', nameEn: 'Customer', nameAr: 'عميل', kind: 'CUSTOMER' } }],
    };
    expect(isCustomerUser(customer)).toBe(true);
  });

  it('hides department for worker, staff, and admin roles', () => {
    expect(userShowsDepartment(base)).toBe(false);
    const admin: UserRow = {
      ...base,
      roles: [
        {
          role: {
            id: 'a',
            code: 'SYSTEM_ADMINISTRATOR',
            nameEn: 'Admin',
            nameAr: 'مسؤول',
            kind: 'ADMIN',
          },
        },
      ],
    };
    expect(userShowsDepartment(admin)).toBe(false);
    const staff: UserRow = {
      ...base,
      roles: [
        {
          role: {
            id: 'w',
            code: 'WAREHOUSE_MANAGEMENT',
            nameEn: 'Warehouse Management',
            nameAr: 'إدارة المستودعات',
            kind: 'STAFF',
          },
        },
      ],
    };
    expect(userShowsDepartment(staff)).toBe(false);
    expect(roleUsesDepartment('PRODUCTION_WORKER')).toBe(false);
    expect(roleUsesDepartment('SYSTEM_ADMINISTRATOR')).toBe(false);
    expect(roleUsesDepartment('CUSTOMER')).toBe(false);
    expect(roleUsesDepartment('WAREHOUSE_MANAGEMENT', 'STAFF')).toBe(false);
  });
});
