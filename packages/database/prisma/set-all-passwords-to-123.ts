/**
 * One-off: set every user's password to `123` (bcrypt cost 12) and revoke sessions.
 * Also stores the encrypted dealer portal password for customer-linked users.
 * Does not wipe operational data (unlike full seed).
 *
 * Run: pnpm --filter @maher/database exec dotenv -e ../../.env -- tsx prisma/set-all-passwords-to-123.ts
 */
import { PrismaClient } from '@prisma/client';
import { hashSync } from 'bcryptjs';
import { encryptPortalPassword } from './seed/secret-box';

const prisma = new PrismaClient();
const DEMO_PASSWORD = '123';

async function main() {
  const passwordHash = hashSync(DEMO_PASSWORD, 12);
  const portalPasswordEnc = encryptPortalPassword(DEMO_PASSWORD);
  const users = await prisma.user.updateMany({
    data: {
      passwordHash,
      failedLoginAttempts: 0,
      lockedUntil: null,
    },
  });
  const dealers = await prisma.user.updateMany({
    where: { customerId: { not: null } },
    data: { portalPasswordEnc },
  });
  const staff = await prisma.user.updateMany({
    where: { customerId: null },
    data: { portalPasswordEnc: null },
  });
  const sessions = await prisma.session.updateMany({
    where: { revokedAt: null },
    data: { revokedAt: new Date() },
  });
  console.log(
    `Updated ${users.count} users to password "123"; ${dealers.count} dealer portal passwords stored; ${staff.count} staff blobs cleared; revoked ${sessions.count} sessions.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
