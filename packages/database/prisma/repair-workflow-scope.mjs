/**
 * One-shot: collapse ProductionWorkflowScope.RECOVERY into RETURN.
 * Updates the  existing RECOVERY rows, then rebuilds the Postgres enum.
 *
 * Run: pnpm --filter @maher/database repair:workflow-scope
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function enumHasRecovery() {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT e.enumlabel AS label
     FROM pg_enum e
     JOIN pg_type t ON e.enumtypid = t.oid
     WHERE t.typname = 'ProductionWorkflowScope'`,
  );
  return rows.some((row) => row.label === 'RECOVERY');
}

async function main() {
  const migrated = await prisma.$executeRawUnsafe(
    `UPDATE production_workflows SET scope = 'RETURN' WHERE scope::text = 'RECOVERY'`,
  );
  console.log(`  workflows: moved ${migrated} row(s) from RECOVERY to RETURN`);

  if (!(await enumHasRecovery())) {
    console.log('  enum: RECOVERY already removed');
    return;
  }

  await prisma.$executeRawUnsafe(
    `ALTER TYPE "ProductionWorkflowScope" RENAME TO "ProductionWorkflowScope_old"`,
  );
  await prisma.$executeRawUnsafe(
    `CREATE TYPE "ProductionWorkflowScope" AS ENUM ('STANDARD', 'RETURN')`,
  );
  await prisma.$executeRawUnsafe(
    `ALTER TABLE production_workflows ALTER COLUMN scope DROP DEFAULT`,
  );
  await prisma.$executeRawUnsafe(
    `ALTER TABLE production_workflows
     ALTER COLUMN scope TYPE "ProductionWorkflowScope"
     USING scope::text::"ProductionWorkflowScope"`,
  );
  await prisma.$executeRawUnsafe(
    `ALTER TABLE production_workflows
     ALTER COLUMN scope SET DEFAULT 'STANDARD'::"ProductionWorkflowScope"`,
  );
  await prisma.$executeRawUnsafe(`DROP TYPE "ProductionWorkflowScope_old"`);
  console.log('  enum: ProductionWorkflowScope is now STANDARD | RETURN');
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
