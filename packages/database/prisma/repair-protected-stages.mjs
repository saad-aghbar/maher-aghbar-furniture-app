/**
 * One-shot: reactivate protected stages (especially DISMANTLE_RECOVER) and
 * ensure recovery1 / recovery2 exist with the DISMANTLE_RECOVER skill.
 * Does not wipe operational data.
 *
 * Run: pnpm --filter @maher/database repair:protected-stages
 */
import { createCipheriv, createHash, randomBytes } from 'node:crypto';
import bcryptjs from 'bcryptjs';
const { hashSync } = bcryptjs;
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const DEMO_PASSWORD = '123';
const COMPANY_DOMAIN = 'maher-aghbar.jo';
const PROTECTED_STAGE_CODES = [
  'MATERIAL_PREP',
  'INSPECTION',
  'PACKAGING',
  'DELIVERY',
  'DISMANTLE_RECOVER',
];
const RECOVERY_WORKERS = [
  {
    username: 'recovery1',
    firstName: 'Suhaib',
    lastName: 'Zaid',
    phone: '+962790100901',
  },
  {
    username: 'recovery2',
    firstName: 'Murad',
    lastName: 'Btoush',
    phone: '+962790100902',
  },
];

function encryptPortalPassword(plain) {
  const keyMaterial = process.env.PORTAL_PASSWORD_KEY || process.env.JWT_ACCESS_SECRET;
  if (!keyMaterial || keyMaterial.length < 16) {
    return null;
  }
  const key = createHash('sha256').update(keyMaterial, 'utf8').digest();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    'v1',
    iv.toString('base64url'),
    tag.toString('base64url'),
    ciphertext.toString('base64url'),
  ].join('.');
}

async function main() {
  const reactivated = await prisma.productionStageDefinition.updateMany({
    where: { code: { in: PROTECTED_STAGE_CODES } },
    data: { isActive: true },
  });
  console.log(`  stages: reactivated ${reactivated.count} protected stage row(s)`);

  const dismantle = await prisma.productionStageDefinition.findUnique({
    where: { code: 'DISMANTLE_RECOVER' },
    select: { id: true, isActive: true },
  });
  if (!dismantle) {
    throw new Error('DISMANTLE_RECOVER stage is missing from the library.');
  }

  const role = await prisma.role.findUniqueOrThrow({
    where: { code: 'PRODUCTION_WORKER' },
    select: { id: true },
  });
  const warehouse = await prisma.department.findUnique({
    where: { code: 'WH' },
    select: { id: true },
  });
  const passwordHash = hashSync(DEMO_PASSWORD, 12);
  const portalPasswordEnc = encryptPortalPassword(DEMO_PASSWORD);

  let createdWorkers = 0;
  let skilled = 0;
  for (const worker of RECOVERY_WORKERS) {
    let user = await prisma.user.findUnique({
      where: { username: worker.username },
      select: { id: true },
    });
    if (!user) {
      user = await prisma.user.create({
        data: {
          username: worker.username,
          email: `${worker.username}@${COMPANY_DOMAIN}`,
          phone: worker.phone,
          passwordHash,
          portalPasswordEnc: portalPasswordEnc ?? undefined,
          firstName: worker.firstName,
          lastName: worker.lastName,
          isEmailVerified: true,
          isActive: true,
          departmentId: warehouse?.id,
          roles: { create: { roleId: role.id } },
        },
        select: { id: true },
      });
      createdWorkers += 1;
    }

    const existing = await prisma.workerSkill.findFirst({
      where: { userId: user.id, stageDefinitionId: dismantle.id },
      select: { id: true, isActive: true },
    });
    if (!existing) {
      await prisma.workerSkill.create({
        data: {
          userId: user.id,
          stageDefinitionId: dismantle.id,
          proficiency: 3,
          isActive: true,
        },
      });
      skilled += 1;
    } else if (!existing.isActive) {
      await prisma.workerSkill.update({
        where: { id: existing.id },
        data: { isActive: true },
      });
      skilled += 1;
    }
  }

  const recoverSkills = await prisma.workerSkill.count({
    where: { stageDefinitionId: dismantle.id, isActive: true },
  });
  console.log(
    `  workers: created ${createdWorkers}; skills ensured ${skilled}; DISMANTLE_RECOVER skilled=${recoverSkills}`,
  );

  const staffAccounts = [
    {
      username: 'qc2',
      firstName: 'Yasmin',
      lastName: 'Awad',
      phone: '+962790000021',
      roleCode: 'QUALITY_CONTROL',
      departmentCode: 'QC',
    },
    {
      username: 'returnsdesk',
      firstName: 'Ruba',
      lastName: 'Haddad',
      phone: '+962790000022',
      roleCode: 'WAREHOUSE_MANAGEMENT',
      departmentCode: 'WH',
    },
    {
      username: 'finance',
      firstName: 'Tamer',
      lastName: 'Issa',
      phone: '+962790000019',
      roleCode: 'FINANCE',
      departmentCode: 'ACCT',
    },
  ];

  let createdStaff = 0;
  for (const staff of staffAccounts) {
    const role = await prisma.role.findUnique({
      where: { code: staff.roleCode },
      select: { id: true },
    });
    if (!role) {
      console.log(`  staff: skipped ${staff.username} — missing role ${staff.roleCode}`);
      continue;
    }
    const department = await prisma.department.findUnique({
      where: { code: staff.departmentCode },
      select: { id: true },
    });
    let user = await prisma.user.findUnique({
      where: { username: staff.username },
      select: { id: true },
    });
    if (!user) {
      user = await prisma.user.create({
        data: {
          username: staff.username,
          email: `${staff.username}@${COMPANY_DOMAIN}`,
          phone: staff.phone,
          passwordHash,
          portalPasswordEnc: portalPasswordEnc ?? undefined,
          firstName: staff.firstName,
          lastName: staff.lastName,
          isEmailVerified: true,
          isActive: true,
          departmentId: department?.id,
          roles: { create: { roleId: role.id } },
        },
        select: { id: true },
      });
      createdStaff += 1;
    } else {
      const hasRole = await prisma.userRole.findUnique({
        where: { userId_roleId: { userId: user.id, roleId: role.id } },
        select: { userId: true },
      });
      if (!hasRole) {
        await prisma.userRole.create({ data: { userId: user.id, roleId: role.id } });
      }
    }
  }
  console.log(`  staff: created ${createdStaff} returns accounts`);

  const financeRole = await prisma.role.findUnique({
    where: { code: 'FINANCE' },
    select: { id: true },
  });
  if (financeRole) {
    let granted = 0;
    for (const code of ['return.read', 'return.inspect', 'invoice.create']) {
      const permission = await prisma.permission.findUnique({ where: { code } });
      if (!permission) continue;
      const existing = await prisma.rolePermission.findUnique({
        where: { roleId_permissionId: { roleId: financeRole.id, permissionId: permission.id } },
        select: { roleId: true },
      });
      if (!existing) {
        await prisma.rolePermission.create({
          data: { roleId: financeRole.id, permissionId: permission.id },
        });
        granted += 1;
      }
    }
    console.log(`  finance: granted ${granted} missing return/charge permissions`);
  }

  const repairCodes = ['CARPENTRY', 'INSPECTION', 'PACKAGING', 'DELIVERY'];
  let repair = await prisma.productionWorkflow.findUnique({
    where: { code: 'RETURN_REPAIR' },
    select: { id: true, activeVersionId: true },
  });
  if (!repair) {
    repair = await prisma.productionWorkflow.create({
      data: {
        code: 'RETURN_REPAIR',
        nameAr: 'إصلاح المرتجع',
        nameEn: 'Return repair',
        nameHe: 'תיקון החזרה',
        status: 'ACTIVE',
        scope: 'RETURN',
      },
      select: { id: true, activeVersionId: true },
    });
  } else {
    await prisma.productionWorkflow.update({
      where: { id: repair.id },
      data: { status: 'ACTIVE', scope: 'RETURN', archivedAt: null },
    });
  }
  let repairVersion = await prisma.productionWorkflowVersion.findUnique({
    where: { workflowId_versionNumber: { workflowId: repair.id, versionNumber: 1 } },
    select: { id: true },
  });
  if (!repairVersion) {
    repairVersion = await prisma.productionWorkflowVersion.create({
      data: {
        workflowId: repair.id,
        versionNumber: 1,
        status: 'PUBLISHED',
        name: 'Return repair v1',
        publishedAt: new Date(),
      },
      select: { id: true },
    });
  }
  const repairNodeCount = await prisma.productionWorkflowNode.count({
    where: { workflowVersionId: repairVersion.id },
  });
  if (repairNodeCount === 0) {
    const stages = await prisma.productionStageDefinition.findMany({
      where: { code: { in: repairCodes } },
    });
    const byCode = new Map(stages.map((s) => [s.code, s]));
    const nodeIds = new Map();
    for (const [index, code] of repairCodes.entries()) {
      const stage = byCode.get(code);
      if (!stage) throw new Error(`RETURN_REPAIR seed missing stage ${code}`);
      const node = await prisma.productionWorkflowNode.create({
        data: {
          workflowVersionId: repairVersion.id,
          stageDefinitionId: stage.id,
          nodeKey: code,
          sortOrder: index + 1,
          isRequiredByDefault: true,
          canBeSkipped: false,
          defaultEstimatedMinutes: 45,
        },
        select: { id: true },
      });
      nodeIds.set(code, node.id);
    }
    for (let i = 0; i < repairCodes.length - 1; i += 1) {
      await prisma.productionWorkflowEdge.create({
        data: {
          workflowVersionId: repairVersion.id,
          fromNodeId: nodeIds.get(repairCodes[i]),
          toNodeId: nodeIds.get(repairCodes[i + 1]),
          dependencyType: 'HARD',
        },
      });
    }
  }
  await prisma.productionWorkflow.update({
    where: { id: repair.id },
    data: { activeVersionId: repairVersion.id, status: 'ACTIVE', scope: 'RETURN' },
  });
  console.log('  workflow: RETURN_REPAIR ensured');

  const recoveryDemo = await prisma.returnRequest.findUnique({
    where: { number: 'RT-DEMO-RECOVERY-001' },
    select: { id: true },
  });
  if (!recoveryDemo) {
    const delivered = await prisma.salesOrder.findFirst({
      where: { status: 'DELIVERED' },
      include: { lines: { take: 1 }, deliveries: { take: 1 } },
    });
    const admin = await prisma.user.findUnique({
      where: { username: 'admin' },
      select: { id: true },
    });
    if (delivered && admin) {
      const created = await prisma.returnRequest.create({
        data: {
          number: 'RT-DEMO-RECOVERY-001',
          customerId: delivered.customerId,
          salesOrderId: delivered.id,
          deliveryId: delivered.deliveries[0]?.id,
          productDesc: delivered.lines[0]?.description ?? 'Recovery demo piece',
          quantity: 1,
          reason: 'MANUFACTURING_DEFECT',
          description: 'Recovery-only demo: scrap & recover on RETURN_RECOVERY.',
          approvalStatus: 'APPROVED',
          physicalStatus: 'RETURNED',
          lifecycleState: 'REWORKING',
          inventoryFate: 'SCRAP',
          receivedAt: new Date(),
          receivedById: admin.id,
        },
        select: { id: true },
      });
      await prisma.returnPiece.create({
        data: {
          returnRequestId: created.id,
          pieceNo: 1,
          code: 'RT-DEMO-RECOVERY-001-P1',
          salesOrderId: delivered.id,
          salesOrderLineId: delivered.lines[0]?.id,
          productDesc: delivered.lines[0]?.description ?? 'Recovery demo piece',
          state: 'IN_PROGRESS',
          decision: 'SCRAP_RECOVERY',
          outboundEligible: false,
          receivedAt: new Date(),
        },
      });
      console.log('  demo: seeded RT-DEMO-RECOVERY-001');
    } else {
      console.log('  demo: skipped RT-DEMO-RECOVERY-001 — no delivered sales order');
    }
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
