import { rolesOmitDepartment, stageSkillsForAssignedRoles } from './employee-assignment';

describe('employee assignment', () => {
  it('clears stage skills when assigning a staff role', () => {
    expect(stageSkillsForAssignedRoles(['STAFF'], ['stage-1'])).toEqual([]);
    expect(stageSkillsForAssignedRoles(['STAFF'], undefined)).toEqual([]);
  });

  it('keeps stage skills for production workers', () => {
    expect(stageSkillsForAssignedRoles(['PRODUCTION_WORKER'], ['stage-1'])).toEqual(['stage-1']);
    expect(stageSkillsForAssignedRoles(['PRODUCTION_WORKER'], undefined)).toBeUndefined();
  });

  it('clears skills for customer and admin', () => {
    expect(stageSkillsForAssignedRoles(['CUSTOMER'], ['stage-1'])).toEqual([]);
    expect(stageSkillsForAssignedRoles(['ADMIN'], ['stage-1'])).toEqual([]);
  });

  it('hides department for identity and staff roles', () => {
    expect(rolesOmitDepartment(['STAFF'])).toBe(true);
    expect(rolesOmitDepartment(['PRODUCTION_WORKER'])).toBe(true);
    expect(rolesOmitDepartment(['ADMIN'])).toBe(true);
  });
});
