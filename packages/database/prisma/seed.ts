import { PrismaClient } from '@prisma/client';
import { hashSync } from 'bcryptjs';
import { seedDemoWorld, wipeOperationalData } from './seed-demo-world';
import { preservedRoleCodes, seedFoundation } from './seed/foundation';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Maher Al-Aghbar ERP (launch / empty ops)…');

  await seedFoundation(prisma);

  console.log('Wiping operational data…');
  await wipeOperationalData(prisma);

  const keepRoles = preservedRoleCodes();
  await prisma.rolePermission.deleteMany({
    where: { role: { code: { notIn: keepRoles } } },
  });
  await prisma.role.deleteMany({
    where: { code: { notIn: keepRoles } },
  });

  const passwordHash = hashSync('123', 12);
  // Launch world only — presentation factory is `pnpm demo:reset`.
  await seedDemoWorld(prisma, passwordHash);

  console.log('Seed complete.');
  console.log('Launch logins (password: 123): admin | nile | oasis | balqis | warehouse | floor');
  console.log('  Empty catalog / orders. For the clean deterministic factory: pnpm demo:reset');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
