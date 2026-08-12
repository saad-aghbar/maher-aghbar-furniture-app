import { ROLE_PERMISSIONS, PERMISSIONS } from '../catalog';

describe('workflow permissions', () => {
  const workflowPerms = [
    'production.workflow.read',
    'production.workflow.manage',
    'production.workflow.publish',
    'production.workflow.stage.manage',
    'production.workflow.order.customize',
    'production.workflow.order.read.own',
  ] as const;

  it('includes all workflow permissions in catalog', () => {
    for (const p of workflowPerms) {
      expect(PERMISSIONS).toContain(p);
    }
  });

  it('grants workflow manage/publish to SYSTEM_ADMINISTRATOR', () => {
    const admin = ROLE_PERMISSIONS.SYSTEM_ADMINISTRATOR;
    expect(admin).toEqual(expect.arrayContaining([...workflowPerms]));
  });

  it('grants dealer order.read.own but not manage/publish', () => {
    const customer = ROLE_PERMISSIONS.CUSTOMER;
    expect(customer).toContain('production.workflow.order.read.own');
    expect(customer).not.toContain('production.workflow.manage');
    expect(customer).not.toContain('production.workflow.publish');
  });

  it('does not grant workflow graph permissions to PRODUCTION_WORKER', () => {
    const worker = ROLE_PERMISSIONS.PRODUCTION_WORKER;
    expect(worker).not.toContain('production.workflow.read');
    expect(worker).not.toContain('production.workflow.manage');
    expect(worker).not.toContain('production.workflow.order.read.own');
  });
});
