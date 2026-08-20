import { PrismaClient } from '@prisma/client';
import { assertDemoEnvironment } from './env-guard';
import { demoAsOf } from './clock';
import { runDemoReset } from './factory-world';
import { validateDemoFactory } from './validate';
import { writeFatherWalkthrough } from './write-walkthrough';

async function main() {
  const target = assertDemoEnvironment();
  console.log(`demo:reset starting against ${target.host}/${target.database} as of ${demoAsOf().toISOString()}`);
  const prisma = new PrismaClient();
  try {
    await runDemoReset(prisma);
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
