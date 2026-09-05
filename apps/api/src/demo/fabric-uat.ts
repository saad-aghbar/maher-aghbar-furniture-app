/**
 * Post-`demo:reset` step: give SO-FB1042 its production subject through the
 * real release path, then assert the fabric UAT world.
 *
 * The seed lives in `@maher/database` and cannot reach the production release
 * logic, so this runs inside the API where the canonical services are wired.
 * It boots a Nest context and calls `OrderProductionSetupService.release`,
 * the same code path the Release button uses — no hand-built PO/task graph.
 */
import 'reflect-metadata';
import { config as loadEnv } from 'dotenv';
import { resolve } from 'path';

// Same root-.env load order as main.ts, so the script sees DATABASE_URL.
loadEnv({ path: resolve(__dirname, '../../../../.env') });
loadEnv();

import { NestFactory } from '@nestjs/core';
import type { AuthUser } from '@maher/types';
import { PrismaService } from '../common/prisma.service';
import { AppModule } from '../app.module';
import { OrderProductionSetupService } from '../modules/production/order-production-setup.service';
import { assertFabricUatWorld, FABRIC_UAT_ORDER_NUMBER } from './fabric-uat-world';

async function main() {
  // The whole AppModule, so the release runs against production wiring rather
  // than a hand-picked subset that can drift from it.
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  try {
    const prisma = app.get(PrismaService);
    const setups = app.get(OrderProductionSetupService);

    const order = await prisma.salesOrder.findUnique({
      where: { number: FABRIC_UAT_ORDER_NUMBER },
      select: { id: true, _count: { select: { productionOrders: true } } },
    });
    if (!order) {
      throw new Error(
        `${FABRIC_UAT_ORDER_NUMBER} not found. Run pnpm demo:reset before this step.`,
      );
    }

    if (order._count.productionOrders > 0) {
      console.log(`  ${FABRIC_UAT_ORDER_NUMBER} already released — leaving it alone.`);
    } else {
      const admin = await prisma.user.findFirst({
        where: { username: 'admin' },
        select: { id: true, username: true, email: true, firstName: true, lastName: true },
      });
      if (!admin) throw new Error('No admin user found to release as.');

      // release() only needs identity and staff-ness; permissions are checked
      // by the controller guard, which a script does not go through.
      const actor = {
        id: admin.id,
        username: admin.username ?? 'admin',
        email: admin.email ?? '',
        name: `${admin.firstName} ${admin.lastName}`.trim(),
        roles: [],
        permissions: [],
      } as unknown as AuthUser;

      const released = await setups.release(order.id, actor);
      console.log(
        `  Released ${FABRIC_UAT_ORDER_NUMBER} → ${released.productionOrderIds.length} production order(s), sales order ${released.salesOrderStatus}.`,
      );
    }

    const world = await assertFabricUatWorld(prisma);
    console.log(
      `  Fabric UAT world OK — PO ${world.productionOrderId}, upholstery task ${world.upholsteryTaskId}, ${world.ready}/${world.required} fabric ready, lots ${world.qrCodes.join(' + ')}.`,
    );
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
