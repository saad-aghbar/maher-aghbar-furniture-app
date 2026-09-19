import type { AuthUser } from '@maher/types';
import { ROLE_PERMISSIONS } from '@maher/permissions';
import {
  buildUnavailableContext,
  buildWatchUserContext,
  filterWatchCapabilities,
  surfaceFromAppSurface,
  watchSurfaceLabel,
} from '../context';

const baseUser: AuthUser = {
  id: 'u-1',
  username: 'khaled',
  email: 'khaled@maher.local',
  name: 'Khaled',
  roles: [],
  permissions: [],
  preferredLanguage: 'ar',
};

describe('Watch context derivation', () => {
  it('maps employee surface to worker', () => {
    const worker: AuthUser = {
      ...baseUser,
      roles: ['PRODUCTION_WORKER'],
      permissions: [...ROLE_PERMISSIONS.PRODUCTION_WORKER],
    };
    const ctx = buildWatchUserContext({
      user: worker,
      sessionEpoch: 2,
      apiBaseUrl: 'http://10.0.0.2:4000',
    });
    expect(ctx).toMatchObject({
      state: 'active',
      sessionEpoch: 2,
      userId: 'u-1',
      displayName: 'Khaled',
      surface: 'worker',
      locale: 'ar',
    });
    expect(watchSurfaceLabel(ctx!.surface)).toBe('Worker');
    expect(ctx!.capabilities).toEqual(
      expect.arrayContaining([
        'production-task.read',
        'production-task.update-own',
        'production-task.complete',
        'quality-inspection.perform',
        'notification.read',
        'sales-order.read',
      ]),
    );
    expect(ctx!.capabilities).not.toContain('production-order.read');
    expect(ctx!.capabilities).not.toContain('user.manage');
  });

  it('maps admin surface to admin', () => {
    const admin: AuthUser = {
      ...baseUser,
      id: 'u-saad',
      username: 'saad',
      name: 'Saad',
      roles: ['SYSTEM_ADMINISTRATOR'],
      permissions: [...ROLE_PERMISSIONS.SYSTEM_ADMINISTRATOR],
      preferredLanguage: 'en',
    };
    const ctx = buildWatchUserContext({
      user: admin,
      sessionEpoch: 3,
      apiBaseUrl: 'http://10.0.0.2:4000',
    });
    expect(ctx?.surface).toBe('admin');
    expect(watchSurfaceLabel(ctx!.surface)).toBe('Admin');
    expect(ctx!.capabilities).toEqual(
      expect.arrayContaining(['report.sales.read', 'notification.read']),
    );
    expect(ctx!.capabilities.every((code) => !code.includes('quotation'))).toBe(true);
  });

  it('maps customer surface to dealer', () => {
    const dealer: AuthUser = {
      ...baseUser,
      id: 'u-nile',
      username: 'nile',
      name: 'Nile',
      roles: ['CUSTOMER'],
      customerId: 'cust-1',
      permissions: [...ROLE_PERMISSIONS.CUSTOMER],
      preferredLanguage: 'en',
    };
    const ctx = buildWatchUserContext({
      user: dealer,
      sessionEpoch: 4,
      apiBaseUrl: 'http://10.0.0.2:4000',
    });
    expect(ctx?.surface).toBe('dealer');
    expect(watchSurfaceLabel(ctx!.surface)).toBe('Dealer');
    expect(ctx!.capabilities).toEqual(
      expect.arrayContaining(['sales-order.read', 'delivery.confirm-own-receipt', 'notification.read']),
    );
    expect(ctx!.capabilities).not.toContain('production-task.complete');
  });

  it('returns null when there is no authenticated user', () => {
    expect(
      buildWatchUserContext({ user: null, sessionEpoch: 1, apiBaseUrl: 'http://localhost:4000' }),
    ).toBeNull();
  });

  it('drops permissions that are not on the Watch allowlist', () => {
    expect(
      filterWatchCapabilities(['user.manage', 'production-task.read', 'invoice.create']),
    ).toEqual(['production-task.read']);
  });

  it('maps AppSurface values without inventing a parallel role system', () => {
    expect(surfaceFromAppSurface('employee')).toBe('worker');
    expect(surfaceFromAppSurface('admin')).toBe('admin');
    expect(surfaceFromAppSurface('customer')).toBe('dealer');
  });

  it('builds an unavailable context for logout', () => {
    expect(buildUnavailableContext(9)).toEqual({ state: 'unavailable', sessionEpoch: 9 });
  });
});
