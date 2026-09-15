/** Interactive access teardown after password change, deactivation, or archive. */

export function roleIdsChanged(previous: readonly string[], next: readonly string[] | undefined): boolean {
  if (next === undefined) return false;
  return [...previous].sort().join(',') !== [...next].sort().join(',');
}

export function roleCodesFingerprint(codes: readonly string[]): string {
  return [...codes].map((c) => c.trim()).filter(Boolean).sort().join(',');
}

type AccessPrisma = {
  session: {
    updateMany: (args: {
      where: { userId: string; revokedAt: null };
      data: { revokedAt: Date };
    }) => Promise<unknown>;
  };
  devicePushToken: {
    updateMany: (args: {
      where: { userId: string; disabledAt: null };
      data: { disabledAt: Date };
    }) => Promise<unknown>;
  };
};

export async function revokeUserInteractiveAccess(prisma: AccessPrisma, userId: string) {
  const now = new Date();
  await prisma.session.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: now },
  });
  await prisma.devicePushToken.updateMany({
    where: { userId, disabledAt: null },
    data: { disabledAt: now },
  });
}
