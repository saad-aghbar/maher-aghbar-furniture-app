import {
  PrismaClient,
  Locale,
  CustomerStatus,
  CustomerType,
} from '@prisma/client';
import { COMPANY_DOMAIN } from './util';
import { encryptPortalPassword } from './secret-box';
import { ensurePlaceholderHourlyRates } from './labor-rates';

const DEMO_PORTAL_PASSWORD = '123';

export type StaffUser = {
  id: string;
  username: string;
  departmentCode: string | null;
};

export type DealerRef = {
  id: string;
  code: string;
  username: string;
  nameEn: string;
  nameAr: string;
};

async function ensureUser(
  prisma: PrismaClient,
  passwordHash: string,
  opts: {
    username: string;
    email: string;
    firstName: string;
    lastName: string;
    roleCode: string;
    phone?: string;
    departmentCode?: string;
    customerId?: string;
  },
) {
  const username = opts.username.toLowerCase();
  const role = await prisma.role.findUniqueOrThrow({ where: { code: opts.roleCode } });
  const departmentId = opts.departmentCode
    ? (await prisma.department.findUniqueOrThrow({ where: { code: opts.departmentCode } })).id
    : undefined;

  return prisma.user.create({
    data: {
      username,
      email: opts.email,
      phone: opts.phone,
      passwordHash,
      portalPasswordEnc: encryptPortalPassword(DEMO_PORTAL_PASSWORD),
      firstName: opts.firstName,
      lastName: opts.lastName,
      preferredLanguage: Locale.ar,
      isEmailVerified: true,
      isActive: true,
      departmentId,
      customerId: opts.customerId,
      roles: { create: { roleId: role.id } },
    },
  });
}

/** Multi-skill floor tester — every active stage, password 123. */
export async function ensureFloorWorker(prisma: PrismaClient, passwordHash: string) {
  const existing = await prisma.user.findUnique({ where: { username: 'floor' } });
  const user =
    existing ??
    (await ensureUser(prisma, passwordHash, {
      username: 'floor',
      email: `floor@${COMPANY_DOMAIN}`,
      firstName: 'Floor',
      lastName: 'Tester',
      roleCode: 'PRODUCTION_WORKER',
      phone: '+962790100000',
      departmentCode: 'PROD',
    }));

  const stages = await prisma.productionStageDefinition.findMany({
    where: { isActive: true },
    select: { id: true },
  });
  for (const stage of stages) {
    await prisma.workerSkill.upsert({
      where: { userId_stageDefinitionId: { userId: user.id, stageDefinitionId: stage.id } },
      create: { userId: user.id, stageDefinitionId: stage.id, proficiency: 5, isActive: true },
      update: { isActive: true, proficiency: 5 },
    });
  }
  return user;
}

const DEALERS: Array<{
  username: string;
  code: string;
  nameEn: string;
  nameAr: string;
  nameHe: string;
}> = [
  { username: 'nile', code: 'CUS-0101', nameEn: 'Nile Interiors', nameAr: 'النيل للديكور', nameHe: 'נייל לעיצוב פנים' },
  { username: 'oasis', code: 'CUS-0102', nameEn: 'Oasis Living', nameAr: 'واحة المعيشة', nameHe: 'אואזיס ליווינג' },
  { username: 'balqis', code: 'CUS-0103', nameEn: 'Balqis Hospitality', nameAr: 'بلقيس للضيافة', nameHe: 'בלקיס לאירוח' },
];

const WORKERS: Array<{
  username: string;
  firstName: string;
  lastName: string;
  departmentCode: string;
  phone: string;
}> = [
  { username: 'cutter', firstName: 'Yousef', lastName: 'Haddad', departmentCode: 'WH', phone: '+962790100101' },
  { username: 'cutter2', firstName: 'Sami', lastName: 'Nasser', departmentCode: 'WH', phone: '+962790100102' },
  { username: 'carpenter', firstName: 'Khaled', lastName: 'Obeid', departmentCode: 'CARP', phone: '+962790100201' },
  { username: 'carpenter2', firstName: 'Fadi', lastName: 'Saleh', departmentCode: 'CARP', phone: '+962790100202' },
  { username: 'carpenter3', firstName: 'Rami', lastName: 'Qudah', departmentCode: 'CARP', phone: '+962790100203' },
  { username: 'painter', firstName: 'Hassan', lastName: 'Tarawneh', departmentCode: 'PAINT', phone: '+962790100301' },
  { username: 'painter2', firstName: 'Omar', lastName: 'Hijazi', departmentCode: 'PAINT', phone: '+962790100302' },
  { username: 'upholsterer', firstName: 'Nour', lastName: 'Masri', departmentCode: 'UPHOL', phone: '+962790100401' },
  { username: 'upholsterer2', firstName: 'Lina', lastName: 'Awad', departmentCode: 'UPHOL', phone: '+962790100402' },
  { username: 'assembler', firstName: 'Tareq', lastName: 'Zabin', departmentCode: 'ASM', phone: '+962790100501' },
  { username: 'assembler2', firstName: 'Majed', lastName: 'Shawabkeh', departmentCode: 'ASM', phone: '+962790100502' },
  { username: 'inspector', firstName: 'Rana', lastName: 'Khatib', departmentCode: 'QC', phone: '+962790100601' },
  { username: 'packer', firstName: 'Issa', lastName: 'Daoud', departmentCode: 'PACK', phone: '+962790100701' },
  { username: 'driver', firstName: 'Basel', lastName: 'Smadi', departmentCode: 'DEL', phone: '+962790100801' },
  { username: 'driver2', firstName: 'Anas', lastName: 'Freijat', departmentCode: 'DEL', phone: '+962790100802' },
  { username: 'recovery1', firstName: 'Suhaib', lastName: 'Zaid', departmentCode: 'WH', phone: '+962790100901' },
  { username: 'recovery2', firstName: 'Murad', lastName: 'Btoush', departmentCode: 'WH', phone: '+962790100902' },
];

export async function seedPeople(
  prisma: PrismaClient,
  passwordHash: string,
  opts: { includeWorkers?: boolean } = {},
) {
  const admin = await ensureUser(prisma, passwordHash, {
    username: 'admin',
    email: `admin@${COMPANY_DOMAIN}`,
    firstName: 'Maher',
    lastName: 'Aghbar',
    roleCode: 'SYSTEM_ADMINISTRATOR',
    phone: '+962790000001',
    departmentCode: 'MGMT',
  });

  await ensureUser(prisma, passwordHash, {
    username: 'warehouse',
    email: `warehouse@${COMPANY_DOMAIN}`,
    firstName: 'Hani',
    lastName: 'Warehouse',
    roleCode: 'WAREHOUSE_MANAGEMENT',
    phone: '+962790000010',
    departmentCode: 'WH',
  });

  const dealers: DealerRef[] = [];
  for (let i = 0; i < DEALERS.length; i += 1) {
    const d = DEALERS[i]!;
    const customer = await prisma.customer.create({
      data: {
        code: d.code,
        name: d.nameEn,
        nameEn: d.nameEn,
        nameAr: d.nameAr,
        nameHe: d.nameHe,
        customerType: CustomerType.COMPANY,
        companyName: d.nameEn,
        preferredLanguage: Locale.ar,
        status: CustomerStatus.ACTIVE,
        createdById: admin.id,
      },
    });

    await ensureUser(prisma, passwordHash, {
      username: d.username,
      email: `${d.username}@${COMPANY_DOMAIN}`,
      firstName: d.nameEn.split(' ')[0]!,
      lastName: 'Portal',
      roleCode: 'CUSTOMER',
      phone: `+96279${2100000 + i}`,
      customerId: customer.id,
    });

    dealers.push({
      id: customer.id,
      code: d.code,
      username: d.username,
      nameEn: d.nameEn,
      nameAr: d.nameAr,
    });
  }

  const workers: StaffUser[] = [];
  const byDept: Record<string, string[]> = {};
  if (opts.includeWorkers) {
    for (const w of WORKERS) {
      const user = await ensureUser(prisma, passwordHash, {
        username: w.username,
        email: `${w.username}@${COMPANY_DOMAIN}`,
        firstName: w.firstName,
        lastName: w.lastName,
        roleCode: 'PRODUCTION_WORKER',
        phone: w.phone,
        departmentCode: w.departmentCode,
      });
      workers.push({ id: user.id, username: w.username, departmentCode: w.departmentCode });
      byDept[w.departmentCode] = byDept[w.departmentCode] ?? [];
      byDept[w.departmentCode]!.push(user.id);
    }
  }

  const floorWorker = await ensureFloorWorker(prisma, passwordHash);
  workers.push({ id: floorWorker.id, username: 'floor', departmentCode: 'PROD' });
  await ensurePlaceholderHourlyRates(
    prisma,
    workers.map((w) => w.id),
  );

  /** Stage code → preferred assignee user ids */
  const stageAssignees: Record<string, string[]> = {
    MATERIAL_PREP: byDept.WH ?? [],
    CARPENTRY: byDept.CARP ?? [],
    PAINTING: byDept.PAINT ?? [],
    FOAM: byDept.UPHOL ?? [],
    UPHOLSTERY: byDept.UPHOL ?? [],
    ASSEMBLY: byDept.ASM ?? [],
    INSPECTION: byDept.QC ?? [],
    PACKAGING: byDept.PACK ?? [],
    DELIVERY: byDept.DEL ?? [],
    DISMANTLE_RECOVER: byDept.WH ?? [],
  };

  return { admin, dealers, workers, stageAssignees };
}
