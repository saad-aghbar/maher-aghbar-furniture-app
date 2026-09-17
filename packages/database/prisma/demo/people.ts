import {
  PrismaClient,
  Locale,
  CustomerStatus,
  CustomerType,
} from '@prisma/client';
import { COMPANY_DOMAIN } from '../seed/util';
import { encryptPortalPassword } from '../seed/secret-box';
import { ensurePlaceholderHourlyRates } from '../seed/labor-rates';

const DEMO_PORTAL_PASSWORD = '123';

/** Canonical demo logins (password 123). Exactly one SYSTEM_ADMINISTRATOR. */
export const DEMO_EXPECTED_USERNAMES = [
  'admin',
  'production',
  'scheduling',
  'sales',
  'purchasing',
  'warehouse',
  'qc',
  'finance',
  'delivery',
  'carpenter',
  'foam',
  'upholsterer',
  'inspector',
  'packer',
  'recovery',
  'driver',
  'nile',
  'oasis',
] as const;

export type StaffUser = {
  id: string;
  username: string;
  departmentCode: string | null;
  roleCode: string;
};

export type DealerRef = {
  id: string;
  code: string;
  username: string;
  nameEn: string;
  nameAr: string;
  nameHe: string;
  city: string;
  area: string;
  street: string;
  lat: number;
  lng: number;
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

  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) {
    const hasRole = await prisma.userRole.findUnique({
      where: { userId_roleId: { userId: existing.id, roleId: role.id } },
    });
    if (!hasRole) {
      await prisma.userRole.create({ data: { userId: existing.id, roleId: role.id } });
    }
    return existing;
  }

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
      mfaEnabled: false,
      mfaSecret: null,
      departmentId,
      customerId: opts.customerId,
      roles: { create: { roleId: role.id } },
    },
  });
}

const STAFF: Array<{
  username: string;
  firstName: string;
  lastName: string;
  roleCode: string;
  departmentCode: string;
  phone: string;
}> = [
  {
    username: 'admin',
    firstName: 'Maher',
    lastName: 'Aghbar',
    roleCode: 'SYSTEM_ADMINISTRATOR',
    departmentCode: 'MGMT',
    phone: '+962790000001',
  },
  {
    username: 'production',
    firstName: 'Samer',
    lastName: 'Qasem',
    roleCode: 'PRODUCTION_MANAGEMENT',
    departmentCode: 'PROD',
    phone: '+962790000011',
  },
  {
    username: 'scheduling',
    firstName: 'Dina',
    lastName: 'Hijazi',
    roleCode: 'SCHEDULING',
    departmentCode: 'PROD',
    phone: '+962790000012',
  },
  {
    username: 'sales',
    firstName: 'Rami',
    lastName: 'Naber',
    roleCode: 'SALES',
    departmentCode: 'SALES',
    phone: '+962790000013',
  },
  {
    username: 'purchasing',
    firstName: 'Firas',
    lastName: 'Zoubi',
    roleCode: 'PURCHASING',
    departmentCode: 'PURCH',
    phone: '+962790000015',
  },
  {
    username: 'warehouse',
    firstName: 'Hani',
    lastName: 'Khatib',
    roleCode: 'WAREHOUSE_MANAGEMENT',
    departmentCode: 'WH',
    phone: '+962790000016',
  },
  {
    username: 'qc',
    firstName: 'Laila',
    lastName: 'Barakat',
    roleCode: 'QUALITY_CONTROL',
    departmentCode: 'QC',
    phone: '+962790000018',
  },
  {
    username: 'finance',
    firstName: 'Tamer',
    lastName: 'Issa',
    roleCode: 'FINANCE',
    departmentCode: 'ACCT',
    phone: '+962790000019',
  },
  {
    username: 'delivery',
    firstName: 'Nader',
    lastName: 'Malkawi',
    roleCode: 'DELIVERY_OPERATIONS',
    departmentCode: 'DEL',
    phone: '+962790000020',
  },
];

const WORKERS: Array<{
  username: string;
  firstName: string;
  lastName: string;
  departmentCode: string;
  phone: string;
  stages: string[];
}> = [
  {
    username: 'carpenter',
    firstName: 'Khaled',
    lastName: 'Obeid',
    departmentCode: 'CARP',
    phone: '+962790100201',
    stages: ['MATERIAL_PREP', 'CARPENTRY', 'PAINTING', 'ASSEMBLY'],
  },
  {
    username: 'foam',
    firstName: 'Ayman',
    lastName: 'Rawashdeh',
    departmentCode: 'UPHOL',
    phone: '+962790100351',
    stages: ['FOAM'],
  },
  {
    username: 'upholsterer',
    firstName: 'Nour',
    lastName: 'Masri',
    departmentCode: 'UPHOL',
    phone: '+962790100401',
    stages: ['UPHOLSTERY'],
  },
  {
    username: 'inspector',
    firstName: 'Rana',
    lastName: 'Khatib',
    departmentCode: 'QC',
    phone: '+962790100601',
    stages: ['INSPECTION'],
  },
  {
    username: 'packer',
    firstName: 'Issa',
    lastName: 'Daoud',
    departmentCode: 'PACK',
    phone: '+962790100701',
    stages: ['PACKAGING'],
  },
  {
    username: 'recovery',
    firstName: 'Suhaib',
    lastName: 'Zaid',
    departmentCode: 'WH',
    phone: '+962790100901',
    stages: ['DISMANTLE_RECOVER'],
  },
  {
    username: 'driver',
    firstName: 'Basel',
    lastName: 'Smadi',
    departmentCode: 'DEL',
    phone: '+962790100801',
    stages: ['DELIVERY'],
  },
];

const DEALERS: Array<{
  username: string;
  code: string;
  nameEn: string;
  nameAr: string;
  nameHe: string;
  city: string;
  area: string;
  street: string;
  lat: number;
  lng: number;
  type: CustomerType;
  credit: number;
  terms: number;
  contact: string;
  phone: string;
  email: string;
}> = [
  {
    username: 'nile',
    code: 'CUS-0101',
    nameEn: 'Nile Interiors',
    nameAr: 'النيل للديكور',
    nameHe: 'נייל לעיצוב פנים',
    city: 'Amman',
    area: 'Abdoun',
    street: 'Zahran Street 42',
    lat: 31.9539,
    lng: 35.8623,
    type: CustomerType.SHOWROOM,
    credit: 80000,
    terms: 30,
    contact: 'Ruba Nabulsi',
    phone: '+962790210001',
    email: 'orders@nile-interiors.jo',
  },
  {
    username: 'oasis',
    code: 'CUS-0102',
    nameEn: 'Oasis Living',
    nameAr: 'واحة المعيشة',
    nameHe: 'אואזיס ליווינג',
    city: 'Amman',
    area: 'Sweifieh',
    street: 'Wakalat Street 18',
    lat: 31.955,
    lng: 35.86,
    type: CustomerType.SHOWROOM,
    credit: 45000,
    terms: 21,
    contact: 'Majd Khoury',
    phone: '+962790210002',
    email: 'hello@oasis-living.jo',
  },
];

export async function seedDemoPeople(prisma: PrismaClient, passwordHash: string) {
  const staff: StaffUser[] = [];
  let adminId = '';

  for (const s of STAFF) {
    const user = await ensureUser(prisma, passwordHash, {
      username: s.username,
      email: `${s.username}@${COMPANY_DOMAIN}`,
      firstName: s.firstName,
      lastName: s.lastName,
      roleCode: s.roleCode,
      phone: s.phone,
      departmentCode: s.departmentCode,
    });
    staff.push({
      id: user.id,
      username: s.username,
      departmentCode: s.departmentCode,
      roleCode: s.roleCode,
    });
    if (s.username === 'admin') adminId = user.id;
  }

  const workers: StaffUser[] = [];
  const stageAssignees: Record<string, string[]> = {};
  const stages = await prisma.productionStageDefinition.findMany({
    where: { isActive: true },
    select: { id: true, code: true },
  });
  const stageId = new Map(stages.map((s) => [s.code, s.id]));

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
    workers.push({
      id: user.id,
      username: w.username,
      departmentCode: w.departmentCode,
      roleCode: 'PRODUCTION_WORKER',
    });
    for (const code of w.stages) {
      const sid = stageId.get(code);
      if (!sid) throw new Error(`Missing stage ${code} for worker skill`);
      await prisma.workerSkill.create({
        data: { userId: user.id, stageDefinitionId: sid, proficiency: 3, isActive: true },
      });
      stageAssignees[code] = stageAssignees[code] ?? [];
      stageAssignees[code]!.push(user.id);
    }
  }

  await ensurePlaceholderHourlyRates(
    prisma,
    workers.map((w) => w.id),
  );

  const salesId = staff.find((s) => s.username === 'sales')?.id ?? adminId;

  const dealers: DealerRef[] = [];
  for (const d of DEALERS) {
    const customer = await prisma.customer.create({
      data: {
        code: d.code,
        name: d.nameEn,
        nameEn: d.nameEn,
        nameAr: d.nameAr,
        nameHe: d.nameHe,
        customerType: d.type,
        companyName: d.nameEn,
        preferredLanguage: Locale.ar,
        status: CustomerStatus.ACTIVE,
        phone: d.phone,
        email: d.email,
        creditLimit: d.credit,
        paymentTermsDays: d.terms,
        accountManagerId: salesId,
        createdById: adminId,
        industry: 'Retail furniture',
        contacts: {
          create: {
            name: d.contact,
            position: 'Buying desk',
            phone: d.phone,
            email: d.email,
            isPrimary: true,
            preferredLanguage: Locale.ar,
          },
        },
        addresses: {
          create: {
            label: 'Showroom',
            recipient: d.contact,
            phone: d.phone,
            country: 'JO',
            city: d.city,
            area: d.area,
            street: d.street,
            latitude: d.lat,
            longitude: d.lng,
            isDefaultBilling: true,
            isDefaultDelivery: true,
          },
        },
      },
    });

    await ensureUser(prisma, passwordHash, {
      username: d.username,
      email: `${d.username}@${COMPANY_DOMAIN}`,
      firstName: d.nameEn.split(' ')[0]!,
      lastName: d.nameEn.split(' ').slice(1).join(' ') || 'Desk',
      roleCode: 'CUSTOMER',
      phone: d.phone,
      customerId: customer.id,
    });

    dealers.push({
      id: customer.id,
      code: d.code,
      username: d.username,
      nameEn: d.nameEn,
      nameAr: d.nameAr,
      nameHe: d.nameHe,
      city: d.city,
      area: d.area,
      street: d.street,
      lat: d.lat,
      lng: d.lng,
    });
  }

  console.log(
    `  people: ${staff.length} staff + ${workers.length} workers (+ ${dealers.length} dealer logins)`,
  );

  return {
    adminId,
    staff,
    workers,
    dealers,
    stageAssignees,
    salesId,
    inspectorId: workers.find((w) => w.username === 'inspector')?.id ?? adminId,
    driverId: workers.find((w) => w.username === 'driver')?.id ?? adminId,
    warehouseId: staff.find((s) => s.username === 'warehouse')?.id ?? adminId,
    purchasingId: staff.find((s) => s.username === 'purchasing')?.id ?? adminId,
    financeId: staff.find((s) => s.username === 'finance')?.id ?? adminId,
    schedulerId: staff.find((s) => s.username === 'scheduling')?.id ?? adminId,
    productionId: staff.find((s) => s.username === 'production')?.id ?? adminId,
  };
}
