import type { AuthUser } from '@maher/types';
import { isDeliveryFloorWorker } from '../isDeliveryFloorWorker';

describe('isDeliveryFloorWorker', () => {
  function user(partial: Partial<AuthUser>): AuthUser {
    return {
      id: 'u1',
      username: 'driver',
      email: 'd@test.com',
      name: 'Driver',
      roles: ['PRODUCTION_WORKER'],
      permissions: ['delivery.read', 'delivery.update', 'production-task.read'],
      preferredLanguage: 'en',
      ...partial,
    };
  }

  it('true when only DELIVERY skill', () => {
    expect(isDeliveryFloorWorker(user({ stageSkillCodes: ['DELIVERY'] }))).toBe(true);
  });

  it('false when other production skills present', () => {
    expect(
      isDeliveryFloorWorker(user({ stageSkillCodes: ['DELIVERY', 'PACKAGING'] })),
    ).toBe(false);
    expect(isDeliveryFloorWorker(user({ stageSkillCodes: ['CARPENTRY'] }))).toBe(false);
  });

  it('false without skills or delivery permission', () => {
    expect(isDeliveryFloorWorker(user({ stageSkillCodes: [] }))).toBe(false);
    expect(
      isDeliveryFloorWorker(
        user({ stageSkillCodes: ['DELIVERY'], permissions: ['production-task.read'] }),
      ),
    ).toBe(false);
  });
});
