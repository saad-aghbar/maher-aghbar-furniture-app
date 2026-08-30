/**
 * Re-seed Piece 9 only (for UAT without full demo:reset).
 */
import { PrismaClient } from '@prisma/client';
import { seedPiece9QualityPackagingExamples } from './piece9-quality-packaging';

async function main() {
  const prisma = new PrismaClient();
  const dealers = await prisma.customer.findMany({
    where: { archivedAt: null },
    take: 10,
    select: { id: true, code: true, name: true, nameEn: true },
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
          'upholsterer',
          'packer',
          'carpenter',
          'assembler',
        ],
      },
    },
    select: { id: true, username: true, customerId: true },
  });
  const admin = users.find((u) => u.username === 'admin');
  const workers = users.filter((u) =>
    ['inspector', 'upholsterer', 'packer', 'carpenter', 'assembler'].includes(u.username ?? ''),
  );
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
  console.log('Re-seeding Piece 9…');
  await seedPiece9QualityPackagingExamples(prisma, {
    dealers: dealerRefs,
    products,
    adminUserId: admin.id,
    workers,
  });
  const pos = await prisma.productionOrder.findMany({
    where: { number: { startsWith: 'PO-P9-' } },
    select: { number: true, status: true },
    orderBy: { number: 'asc' },
  });
  console.log(
    'P9 orders:',
    pos.map((p) => `${p.number} ${p.status}`).join(', '),
  );
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
