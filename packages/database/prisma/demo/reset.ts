import { PrismaClient } from '@prisma/client';
import { assertDemoEnvironment } from './env-guard';
import { demoAsOf } from './clock';
import { runDemoReset } from './factory-world';
import { releaseFabricUatSubject } from './release-fabric-uat';
import { validateDemoFactory } from './validate';
import { seedMonthInbox } from './month-inbox';
import { writeFatherWalkthrough } from './write-walkthrough';

/** Domain events during seed/release must not leave a stale inbox for UAT. */
async function clearDemoNotificationState(prisma: PrismaClient): Promise<void> {
  await prisma.notificationOutbox.deleteMany({});
  await prisma.notification.deleteMany({});
  await prisma.devicePushToken.deleteMany({});
  await prisma.userNotificationPreference.deleteMany({});
  await prisma.userPushSettings.deleteMany({});
}

async function main() {
  const target = assertDemoEnvironment();
  console.log(`demo:reset starting against ${target.host}/${target.database} as of ${demoAsOf().toISOString()}`);
  const prisma = new PrismaClient();
  try {
    await runDemoReset(prisma);
    console.log('Releasing the SO-FB1042 fabric UAT order through the canonical release…');
    releaseFabricUatSubject();
    console.log('Clearing notification / push state left by release…');
    await clearDemoNotificationState(prisma);
    console.log('Seeding role inbox and AI…');
    const admin = await prisma.user.findUniqueOrThrow({ where: { username: 'admin' }, select: { id: true } });
    await seedMonthInbox(prisma, admin.id);
    await validateDemoFactory(prisma);
    await writeFatherWalkthrough(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
