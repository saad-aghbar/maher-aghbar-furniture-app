import { revokeUserInteractiveAccess, roleCodesFingerprint, roleIdsChanged } from './user-access';

describe('user interactive access', () => {
  it('detects staff-type / role id replacement', () => {
    expect(roleIdsChanged(['a', 'b'], ['b', 'a'])).toBe(false);
    expect(roleIdsChanged(['a'], ['b'])).toBe(true);
    expect(roleIdsChanged(['a'], undefined)).toBe(false);
  });

  it('fingerprints role codes stably for eventId', () => {
    expect(roleCodesFingerprint(['FINANCE', 'WAREHOUSE_MANAGEMENT'])).toBe(
      roleCodesFingerprint(['WAREHOUSE_MANAGEMENT', 'FINANCE']),
    );
    expect(roleCodesFingerprint(['WAREHOUSE_MANAGEMENT'])).not.toBe(roleCodesFingerprint(['FINANCE']));
  });

  it('revokes open sessions and disables push tokens', async () => {
    const session = { updateMany: jest.fn().mockResolvedValue({ count: 1 }) };
    const devicePushToken = { updateMany: jest.fn().mockResolvedValue({ count: 1 }) };
    await revokeUserInteractiveAccess({ session, devicePushToken }, 'user-1');
    expect(session.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-1', revokedAt: null },
      }),
    );
    expect(devicePushToken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-1', disabledAt: null },
      }),
    );
  });
});
