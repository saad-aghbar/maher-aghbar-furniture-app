import { PrismaClient } from '@prisma/client';
import { hashSync } from 'bcryptjs';
import { seedDemoWorld, wipeOperationalData } from './seed-demo-world';
import { preservedRoleCodes, seedFoundation } from './seed/foundation';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Maher Al-Aghbar ERP…');

  await seedFoundation(prisma);

  // Wipe operational rows (keeps foundation tables above).
  console.log('Wiping operational data…');
  await wipeOperationalData(prisma);

  // Drop legacy roles that are no longer in the three-account model.
  // Keep system staff presets (e.g. WAREHOUSE_MANAGEMENT) — full demo people need them.
  const keepRoles = preservedRoleCodes();
  await prisma.rolePermission.deleteMany({
    where: { role: { code: { notIn: keepRoles } } },
  });
  await prisma.role.deleteMany({
    where: { code: { notIn: keepRoles } },
  });

  const passwordHash = hashSync('123', 12);
  await seedDemoWorld(prisma, passwordHash);

  if (process.env.SEED_FACTORY_UAT === '1') {
    const { seedFactoryUat } = await import('./seed/factory-uat');
    await seedFactoryUat(prisma);
  }

  console.log('Seed complete.');
  if (process.env.SEED_FULL_DEMO === '1') {
    console.log('Full demo logins (password: 123): admin | nile | oasis | balqis | cutter | carpenter | …');
  } else {
    console.log('Launch logins (password: 123): admin | nile | oasis | balqis');
    console.log('  Empty catalog, inventory, orders, and invoices. Presentation dataset: pnpm demo:reset');
    console.log('  (pnpm db:seed:demo is a legacy 14-day world — do not use for owner demos)');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
