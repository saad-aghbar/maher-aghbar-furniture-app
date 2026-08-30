/**
 * Re-seed Piece 14 only (for UAT without full demo:reset).
 */
import { PrismaClient } from '@prisma/client';
import { seedPiece14FullSystemExamples } from './piece14-full-system';

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
          'carpenter',
          'assembler',
          'upholsterer',
          'inspector',
          'packer',
        ],
      },
    },
    select: { id: true, username: true, customerId: true },
  });
  const admin = users.find((u) => u.username === 'admin');
  const workers = users.filter((u) =>
    ['carpenter', 'assembler', 'upholsterer', 'inspector', 'packer'].includes(u.username ?? ''),
  );
  const dealerRefs = dealers.map((d) => {
    const u = users.find((x) => x.customerId === d.id);
    return {
      id: d.id,
      code: d.code,
      name: d.name,
      nameEn: d.nameEn ?? undefined,
      username: u?.username,
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
  console.log('Re-seeding Piece 14…');
  await seedPiece14FullSystemExamples(prisma, {
    dealers: dealerRefs,
    products,
    adminUserId: admin.id,
    workers,
  });
  const rows = await prisma.salesOrder.findMany({
    where: { number: { startsWith: 'SO-P14-' } },
    select: {
      number: true,
      status: true,
      productionSetup: { select: { status: true } },
      productionOrders: { select: { number: true, status: true } },
    },
    orderBy: { number: 'asc' },
  });
  console.log(
    'P14 SOs:',
    rows
      .map(
        (s) =>
          `${s.number}=${s.status}/setup=${s.productionSetup?.status ?? 'none'}/PO=${s.productionOrders.map((p) => `${p.number}:${p.status}`).join('|') || 'none'}`,
      )
      .join(', ') || '(none)',
  );
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
