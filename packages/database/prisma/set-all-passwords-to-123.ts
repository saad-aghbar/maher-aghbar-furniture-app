/**
 * One-off: set every user's password to `123` (bcrypt cost 12) and revoke sessions.
 * Also stores the encrypted assigned password so workers, staff, and dealers can view it.
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
      portalPasswordEnc,
      failedLoginAttempts: 0,
      lockedUntil: null,
    },
  });
  const sessions = await prisma.session.updateMany({
    where: { revokedAt: null },
    data: { revokedAt: new Date() },
  });
  console.log(
    `Updated ${users.count} users to password "123" with a viewable assigned password; revoked ${sessions.count} sessions.`,
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
