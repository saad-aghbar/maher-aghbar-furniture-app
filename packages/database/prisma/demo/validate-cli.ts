import { PrismaClient } from '@prisma/client';
import { validateDemoFactory } from './validate';

async function main() {
  const prisma = new PrismaClient();
  try {
    await validateDemoFactory(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
