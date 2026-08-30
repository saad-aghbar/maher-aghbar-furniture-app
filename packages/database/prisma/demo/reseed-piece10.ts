/**
 * Re-seed Piece 10 only (for UAT without full demo:reset).
 */
import { PrismaClient } from '@prisma/client';
import { seedPiece10FinishedOutboundExamples } from './piece10-finished-outbound';

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
          'driver',
          'inspector',
          'packer',
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
    ['inspector', 'packer', 'carpenter', 'assembler', 'upholsterer', 'driver'].includes(
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
  console.log('Re-seeding Piece 10…');
  await seedPiece10FinishedOutboundExamples(prisma, {
    dealers: dealerRefs,
    products,
    adminUserId: admin.id,
    workers,
    driverId: driver?.id ?? admin.id,
  });
  const rows = await prisma.delivery.findMany({
    where: { number: { startsWith: 'DLV-P10-' } },
    select: { number: true, status: true },
    orderBy: { number: 'asc' },
  });
  console.log(
    'P10 deliveries:',
    rows.map((d) => `${d.number} ${d.status}`).join(', '),
  );
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
