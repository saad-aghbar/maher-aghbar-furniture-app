import {
  applyEmployeeTypeChange,
  applyIdentityChange,
  emptyUserIdentityForm,
  generateStaffTypeCode,
  hydrateUserIdentityForm,
  submittedRoleId,
  submittedStageDefinitionIds,
} from '../staff';

const roles = [
  { id: 'cust', code: 'CUSTOMER', kind: 'CUSTOMER' },
  { id: 'worker', code: 'PRODUCTION_WORKER', kind: 'PRODUCTION_WORKER' },
  { id: 'admin', code: 'SYSTEM_ADMINISTRATOR', kind: 'ADMIN' },
  { id: 'wh', code: 'WAREHOUSE_MANAGEMENT', kind: 'STAFF' },
  { id: 'purch', code: 'PURCHASING', kind: 'STAFF' },
];

describe('user identity form', () => {
  it('customer and admin skip employee type and skills', () => {
    let form = applyIdentityChange(emptyUserIdentityForm(), 'CUSTOMER');
    expect(submittedRoleId(form, roles)).toBe('cust');
    expect(submittedStageDefinitionIds(form)).toEqual([]);
    expect(form.staffTypeId).toBe('');

    form = applyIdentityChange(form, 'SYSTEM_ADMINISTRATOR');
    expect(submittedRoleId(form, roles)).toBe('admin');
    expect(form.employeeType).toBe('');
  });

  it('worker identity with worker type keeps stage skills', () => {
    let form = applyIdentityChange(emptyUserIdentityForm(), 'PRODUCTION_WORKER');
    form = applyEmployeeTypeChange(form, 'WORKER');
    form = { ...form, stageDefinitionIds: ['s1'] };
    expect(submittedRoleId(form, roles)).toBe('worker');
    expect(submittedStageDefinitionIds(form)).toEqual(['s1']);
  });

  it('switching worker to staff clears skills and requires a staff type', () => {
    let form = applyIdentityChange(emptyUserIdentityForm(), 'PRODUCTION_WORKER');
    form = applyEmployeeTypeChange({ ...form, stageDefinitionIds: ['s1'] }, 'STAFF');
    expect(form.stageDefinitionIds).toEqual([]);
    expect(submittedRoleId(form, roles)).toBeNull();
    form = { ...form, staffTypeId: 'wh' };
    expect(submittedRoleId(form, roles)).toBe('wh');
    expect(submittedStageDefinitionIds(form)).toEqual([]);
  });

  it('switching staff back to worker clears staff type', () => {
    let form = applyIdentityChange(emptyUserIdentityForm(), 'PRODUCTION_WORKER');
    form = applyEmployeeTypeChange(form, 'STAFF');
    form = { ...form, staffTypeId: 'purch' };
    form = applyEmployeeTypeChange(form, 'WORKER');
    expect(form.staffTypeId).toBe('');
    expect(submittedRoleId(form, roles)).toBe('worker');
  });

  it('hydrates an existing warehouse staff user', () => {
    const form = hydrateUserIdentityForm({
      id: 'wh',
      code: 'WAREHOUSE_MANAGEMENT',
      kind: 'STAFF',
    });
    expect(form.identityRoleCode).toBe('PRODUCTION_WORKER');
    expect(form.employeeType).toBe('STAFF');
    expect(form.staffTypeId).toBe('wh');
  });
});

describe('generateStaffTypeCode', () => {
  it('slugifies English names and avoids collisions', () => {
    expect(generateStaffTypeCode('Purchasing')).toBe('PURCHASING');
    expect(generateStaffTypeCode('Warehouse Management', ['WAREHOUSE_MANAGEMENT'])).toBe(
      'WAREHOUSE_MANAGEMENT_2',
    );
  });
});
