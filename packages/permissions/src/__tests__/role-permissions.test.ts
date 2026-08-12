import { ROLE_PERMISSIONS } from '../catalog';

describe('ROLE_PERMISSIONS', () => {
  it('grants CUSTOMER schedule.*own permissions for dealer scheduling', () => {
    const customer = ROLE_PERMISSIONS.CUSTOMER;
    expect(customer).toEqual(expect.arrayContaining([
      'schedule.availability.own',
      'schedule.read.own',
      'schedule.request-change.own',
    ]));
    expect(customer).not.toEqual(expect.arrayContaining([
      'schedule.manage',
      'schedule.approve',
      'schedule.settings.manage',
    ]));
  });

  it('does not grant PRODUCTION_WORKER any schedule.* codes', () => {
    const worker = ROLE_PERMISSIONS.PRODUCTION_WORKER;
    expect(worker.filter((p) => p.startsWith('schedule.'))).toEqual([]);
  });
});
