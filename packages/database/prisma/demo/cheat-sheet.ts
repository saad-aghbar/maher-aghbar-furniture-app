import type { PrismaClient } from '@prisma/client';
import { DEMO_EXPECTED_USERNAMES } from './people';
import { COST_UAT } from './cost-performance-uat';
import { DEMO_RETURN_NUMBER } from './returns';

/** Print login + fixture cheat sheet after a successful demo reset. */
export async function printDemoCheatSheet(prisma: PrismaClient): Promise<void> {
  const [
    adminCount,
    userCount,
    productCount,
    variantCount,
    dealerCount,
    soCount,
    poCount,
    invItemCount,
    purchaseOrderCount,
    returnCount,
    invoiceCount,
    notificationCount,
    pushTokenCount,
    outboxCount,
  ] = await Promise.all([
    prisma.userRole.count({ where: { role: { code: 'SYSTEM_ADMINISTRATOR' } } }),
    prisma.user.count(),
    prisma.product.count(),
    prisma.productVariant.count(),
    prisma.customer.count(),
    prisma.salesOrder.count({ where: { archivedAt: null } }),
    prisma.productionOrder.count(),
    prisma.inventoryItem.count(),
    prisma.purchaseOrder.count(),
    prisma.returnRequest.count(),
    prisma.invoice.count(),
    prisma.notification.count(),
    prisma.devicePushToken.count(),
    prisma.notificationOutbox.count(),
  ]);

  const staffCount = await prisma.user.count({
    where: { roles: { some: { role: { kind: 'STAFF' } } } },
  });
  const workerCount = await prisma.user.count({
    where: { roles: { some: { role: { code: 'PRODUCTION_WORKER' } } } },
  });
  const dealerLogins = await prisma.user.count({
    where: { roles: { some: { role: { code: 'CUSTOMER' } } } },
  });

  console.log(`
====================================
MAHER ERP DEMO READY
====================================

ADMIN
admin / 123

DEALER
nile / 123
oasis / 123

WAREHOUSE
warehouse / 123

PURCHASING
purchasing / 123

PRODUCTION
production / 123

SCHEDULING
scheduling / 123

SALES
sales / 123

CARPENTER
carpenter / 123

FOAM
foam / 123

UPHOLSTERY
upholsterer / 123

QC (office)
qc / 123

INSPECTOR (floor)
inspector / 123

FINANCE
finance / 123

DELIVERY (office)
delivery / 123

DRIVER (floor)
driver / 123

PACKER
packer / 123

RECOVERY
recovery / 123

GOLDEN ORDER
SO-GOLDEN-001

COST GOLDEN
${COST_UAT.golden} (294 / 630 / 336)

FABRIC ORDER
SO-FB1042

RETURN
${DEMO_RETURN_NUMBER}

LATE PO
PORD-DEMO-LATE

LOW STOCK ITEM
MAT-BEECH

====================================
FIXTURE SUMMARY
====================================
USERS          ${userCount} total (${adminCount} admin · ${dealerLogins} dealer · ${staffCount} staff · ${workerCount} workers)
               expected logins: ${DEMO_EXPECTED_USERNAMES.length}
CATALOG        ${productCount} products · ${variantCount} variants
DEALERS        ${dealerCount}
SALES ORDERS   ${soCount}
PRODUCTION     ${poCount} production orders
INVENTORY      ${invItemCount} items
PURCHASE ORDERS ${purchaseOrderCount}
RETURNS        ${returnCount}
INVOICES       ${invoiceCount}
NOTIFICATIONS  ${notificationCount}
PUSH TOKENS    ${pushTokenCount}
OUTBOX         ${outboxCount}
====================================
`);
}
