import {
  namesFromUsername,
  roleCodeForSegment,
  SEGMENT_ROLE_CODE,
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
  it('maps segments to role codes like admin-web', () => {
    expect(roleCodeForSegment('staff')).toBe(SEGMENT_ROLE_CODE.staff);
    expect(roleCodeForSegment('customers')).toBe('CUSTOMER');
    expect(roleCodeForSegment('admins')).toBe('SYSTEM_ADMINISTRATOR');
    expect(roleCodeForSegment('all')).toBeUndefined();
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
      roles: [{ role: { id: 'c', code: 'CUSTOMER', nameEn: 'Customer', nameAr: 'عميل' } }],
    };
    expect(isCustomerUser(customer)).toBe(true);
  });

  it('hides department for worker and admin roles', () => {
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
          },
        },
      ],
    };
    expect(userShowsDepartment(admin)).toBe(false);
    expect(roleUsesDepartment('PRODUCTION_WORKER')).toBe(false);
    expect(roleUsesDepartment('SYSTEM_ADMINISTRATOR')).toBe(false);
    expect(roleUsesDepartment('CUSTOMER')).toBe(false);
  });
});
