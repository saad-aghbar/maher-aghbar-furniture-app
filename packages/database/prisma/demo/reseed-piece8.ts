/**
 * Re-seed Piece 8 only (for UAT fix without full demo:reset).
 */
import { PrismaClient } from '@prisma/client';
import { seedPiece8FactoryFloorExamples } from './piece8-factory-floor';

async function main() {
  const prisma = new PrismaClient();
  const dealers = await prisma.customer.findMany({
    where: { code: { in: ['OASIS', 'NILE', 'BALQIS'] } },
    select: { id: true, code: true, name: true, nameEn: true },
  });
  // Attach usernames from users
  const users = await prisma.user.findMany({
    where: { username: { in: ['oasis', 'nile', 'balqis', 'admin', 'carpenter', 'assembler'] } },
    select: { id: true, username: true, customerId: true },
  });
  const admin = users.find((u) => u.username === 'admin');
  const workers = users.filter((u) => ['carpenter', 'assembler'].includes(u.username ?? ''));
  const dealerRefs = dealers.map((d) => {
    const u = users.find((x) => x.customerId === d.id);
    return { ...d, username: u?.username };
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
  console.log('Re-seeding Piece 8…');
  await seedPiece8FactoryFloorExamples(prisma, {
    dealers: dealerRefs,
    products,
    adminUserId: admin.id,
    workers,
  });
  const kits = await prisma.wipKit.findMany({
    where: { qrCode: { startsWith: 'WIP-P8-' } },
    select: { qrCode: true, status: true, productionOrder: { select: { number: true } } },
  });
  console.log(
    'P8 kits:',
    kits.map((k) => `${k.productionOrder.number} ${k.qrCode} ${k.status}`),
  );
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
