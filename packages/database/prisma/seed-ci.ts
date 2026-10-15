import { PrismaClient } from '@prisma/client';
import { runDemoReset } from './demo/factory-world';

async function main(): Promise<void> {
  const target = new URL(process.env.DATABASE_URL ?? '');
  if (
    process.env.CI_E2E !== '1' ||
    process.env.NODE_ENV === 'production' ||
    !['localhost', '127.0.0.1', '[::1]'].includes(target.hostname) ||
    target.pathname !== '/maher_ci'
  ) {
    throw new Error('CI fixtures require CI_E2E=1 and a dedicated loopback maher_ci database.');
  }

  const prisma = new PrismaClient();
  try {
    await runDemoReset(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'CI fixture seed failed.');
  process.exitCode = 1;
});
