/**
 * Re-seed unique-floor worker test orders (inspector / packer / recovery1 / driver).
 * Does not wipe P8–P11. Password for all demo workers is 123.
 */
import { PrismaClient } from '@prisma/client';
import { seedUniqueFloorWorkerExamples } from './unique-floor-workers';

async function main() {
  const prisma = new PrismaClient();
  const dealers = await prisma.customer.findMany({
    where: { archivedAt: null },
    take: 10,
    select: {
      id: true,
      code: true,
      name: true,
      nameEn: true,
      addresses: {
        where: { archivedAt: null },
        take: 1,
        select: {
          street: true,
          area: true,
          city: true,
          latitude: true,
          longitude: true,
        },
      },
    },
  });
  const users = await prisma.user.findMany({
    where: {
      username: {
        in: [
          'oasis',
          'nile',
          'balqis',
          'admin',
          'inspector',
          'packer',
          'driver',
          'recovery1',
          'carpenter',
          'assembler',
          'upholsterer',
        ],
      },
    },
    select: { id: true, username: true, customerId: true },
  });
  const admin = users.find((u) => u.username === 'admin');
  const driver = users.find((u) => u.username === 'driver');
  const workers = users.filter((u) =>
    ['inspector', 'packer', 'driver', 'recovery1', 'carpenter', 'assembler', 'upholsterer'].includes(
      u.username ?? '',
    ),
  );
  const dealerRefs = dealers.map((d) => {
    const u = users.find((x) => x.customerId === d.id);
    const addr = d.addresses[0];
    return {
      id: d.id,
      code: d.code,
      name: d.name,
      nameEn: d.nameEn ?? undefined,
      username: u?.username,
      street: addr?.street ?? undefined,
      area: addr?.area ?? undefined,
      city: addr?.city ?? undefined,
      lat: addr?.latitude != null ? Number(addr.latitude) : undefined,
      lng: addr?.longitude != null ? Number(addr.longitude) : undefined,
    };
  });
  const products = await prisma.product.findMany({
    where: { archivedAt: null, isActive: true },
    take: 20,
    select: {
      id: true,
      sku: true,
      nameEn: true,
      basePrice: true,
      width: true,
      height: true,
      depth: true,
    },
  });
  if (!admin) throw new Error('admin user missing');
  console.log('Re-seeding unique-floor worker orders…');
  await seedUniqueFloorWorkerExamples(prisma, {
    dealers: dealerRefs,
    products,
    adminUserId: admin.id,
    workers,
    driverId: driver?.id ?? admin.id,
  });

  const pos = await prisma.productionOrder.findMany({
    where: { number: { startsWith: 'PO-UF-' } },
    select: { number: true, status: true },
    orderBy: { number: 'asc' },
  });
  const dlvs = await prisma.delivery.findMany({
    where: { number: { startsWith: 'DLV-UF-' } },
    select: { number: true, status: true },
    orderBy: { number: 'asc' },
  });
  console.log(
    'UF production orders:',
    pos.map((p) => `${p.number} ${p.status}`).join(', ') || '(none)',
  );
  console.log(
    'UF deliveries:',
    dlvs.map((d) => `${d.number} ${d.status}`).join(', ') || '(none)',
  );
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
