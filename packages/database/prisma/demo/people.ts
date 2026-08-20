import {
  PrismaClient,
  Locale,
  CustomerStatus,
  CustomerType,
} from '@prisma/client';
import { COMPANY_DOMAIN } from '../seed/util';
import { encryptPortalPassword } from '../seed/secret-box';

const DEMO_PORTAL_PASSWORD = '123';

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
    username: 'prodmgr',
    firstName: 'Samer',
    lastName: 'Qasem',
    roleCode: 'PRODUCTION_MANAGEMENT',
    departmentCode: 'PROD',
    phone: '+962790000011',
  },
  {
    username: 'scheduler',
    firstName: 'Dina',
    lastName: 'Hijazi',
    roleCode: 'SCHEDULING',
    departmentCode: 'PROD',
    phone: '+962790000012',
  },
  {
    username: 'sales1',
    firstName: 'Rami',
    lastName: 'Naber',
    roleCode: 'SALES',
    departmentCode: 'SALES',
    phone: '+962790000013',
  },
  {
    username: 'sales2',
    firstName: 'Hala',
    lastName: 'Shami',
    roleCode: 'SALES',
    departmentCode: 'SALES',
    phone: '+962790000014',
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
    username: 'warehouse2',
    firstName: 'Mona',
    lastName: 'Darwish',
    roleCode: 'WAREHOUSE_MANAGEMENT',
    departmentCode: 'WH',
    phone: '+962790000017',
  },
  {
    username: 'qclead',
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
    username: 'dispatch',
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
  { username: 'cutter', firstName: 'Yousef', lastName: 'Haddad', departmentCode: 'WH', phone: '+962790100101', stages: ['MATERIAL_PREP'] },
  { username: 'cutter2', firstName: 'Sami', lastName: 'Nasser', departmentCode: 'WH', phone: '+962790100102', stages: ['MATERIAL_PREP'] },
  { username: 'carpenter', firstName: 'Khaled', lastName: 'Obeid', departmentCode: 'CARP', phone: '+962790100201', stages: ['CARPENTRY'] },
  { username: 'carpenter2', firstName: 'Fadi', lastName: 'Saleh', departmentCode: 'CARP', phone: '+962790100202', stages: ['CARPENTRY'] },
  { username: 'carpenter3', firstName: 'Rami', lastName: 'Qudah', departmentCode: 'CARP', phone: '+962790100203', stages: ['CARPENTRY'] },
  { username: 'carpenter4', firstName: 'Ziad', lastName: 'Armouti', departmentCode: 'CARP', phone: '+962790100204', stages: ['CARPENTRY', 'ASSEMBLY'] },
  { username: 'painter', firstName: 'Hassan', lastName: 'Tarawneh', departmentCode: 'PAINT', phone: '+962790100301', stages: ['PAINTING'] },
  { username: 'painter2', firstName: 'Omar', lastName: 'Hijazi', departmentCode: 'PAINT', phone: '+962790100302', stages: ['PAINTING'] },
  { username: 'foam1', firstName: 'Ayman', lastName: 'Rawashdeh', departmentCode: 'UPHOL', phone: '+962790100351', stages: ['FOAM'] },
  { username: 'foam2', firstName: 'Bilal', lastName: 'Shatnawi', departmentCode: 'UPHOL', phone: '+962790100352', stages: ['FOAM'] },
  { username: 'upholsterer', firstName: 'Nour', lastName: 'Masri', departmentCode: 'UPHOL', phone: '+962790100401', stages: ['UPHOLSTERY'] },
  { username: 'upholsterer2', firstName: 'Lina', lastName: 'Awad', departmentCode: 'UPHOL', phone: '+962790100402', stages: ['UPHOLSTERY'] },
  { username: 'upholsterer3', firstName: 'Maya', lastName: 'Qudah', departmentCode: 'UPHOL', phone: '+962790100403', stages: ['UPHOLSTERY', 'FOAM'] },
  { username: 'assembler', firstName: 'Tareq', lastName: 'Zabin', departmentCode: 'ASM', phone: '+962790100501', stages: ['ASSEMBLY'] },
  { username: 'assembler2', firstName: 'Majed', lastName: 'Shawabkeh', departmentCode: 'ASM', phone: '+962790100502', stages: ['ASSEMBLY'] },
  { username: 'inspector', firstName: 'Rana', lastName: 'Khatib', departmentCode: 'QC', phone: '+962790100601', stages: ['INSPECTION'] },
  { username: 'inspector2', firstName: 'Huda', lastName: 'Natsheh', departmentCode: 'QC', phone: '+962790100602', stages: ['INSPECTION'] },
  { username: 'packer', firstName: 'Issa', lastName: 'Daoud', departmentCode: 'PACK', phone: '+962790100701', stages: ['PACKAGING'] },
  { username: 'packer2', firstName: 'Waleed', lastName: 'Ghazzawi', departmentCode: 'PACK', phone: '+962790100702', stages: ['PACKAGING', 'MATERIAL_PREP'] },
  { username: 'driver', firstName: 'Basel', lastName: 'Smadi', departmentCode: 'DEL', phone: '+962790100801', stages: ['DELIVERY'] },
  { username: 'driver2', firstName: 'Anas', lastName: 'Freijat', departmentCode: 'DEL', phone: '+962790100802', stages: ['DELIVERY'] },
];

const DEALERS: Array<{
  username: string;
  code: string;
  nameEn: string;
  nameAr: string;
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
  {
    username: 'balqis',
    code: 'CUS-0103',
    nameEn: 'Balqis Hospitality',
    nameAr: 'بلقيس للضيافة',
    city: 'Amman',
    area: 'Abdali',
    street: 'Boulevard 7',
    lat: 31.963,
    lng: 35.91,
    type: CustomerType.COMPANY,
    credit: 120000,
    terms: 45,
    contact: 'Salma Haddad',
    phone: '+962790210003',
    email: 'procurement@balqis-hosp.jo',
  },
  {
    username: 'cedar',
    code: 'CUS-0104',
    nameEn: 'Cedar House Amman',
    nameAr: 'بيت الأرز عمّان',
    city: 'Amman',
    area: 'Jabal Amman',
    street: 'Rainbow Street 9',
    lat: 31.951,
    lng: 35.928,
    type: CustomerType.SHOWROOM,
    credit: 35000,
    terms: 30,
    contact: 'Elias Haddad',
    phone: '+962790210004',
    email: 'cedar@cedarhouse.jo',
  },
  {
    username: 'zaatar',
    code: 'CUS-0105',
    nameEn: 'Zaatar Home',
    nameAr: 'زعتر هوم',
    city: 'Amman',
    area: 'Khalda',
    street: 'Wasfi Al-Tal 210',
    lat: 31.99,
    lng: 35.85,
    type: CustomerType.COMPANY,
    credit: 22000,
    terms: 14,
    contact: 'Noor Zaatar',
    phone: '+962790210005',
    email: 'shop@zaatarhome.jo',
  },
  {
    username: 'qasr',
    code: 'CUS-0106',
    nameEn: 'Qasr Suites',
    nameAr: 'قصر الأجنحة',
    city: 'Amman',
    area: '5th Circle',
    street: 'Paris Circle 3',
    lat: 31.96,
    lng: 35.87,
    type: CustomerType.COMPANY,
    credit: 150000,
    terms: 60,
    contact: 'Karim Qasem',
    phone: '+962790210006',
    email: 'ffande@qasr-suites.jo',
  },
  {
    username: 'rawnaq',
    code: 'CUS-0107',
    nameEn: 'Rawnaq Showroom',
    nameAr: 'رواق للعرض',
    city: 'Zarqa',
    area: 'New Zarqa',
    street: 'King Hussein 55',
    lat: 32.072,
    lng: 36.088,
    type: CustomerType.SHOWROOM,
    credit: 18000,
    terms: 21,
    contact: 'Ahmad Rawnaq',
    phone: '+962790210007',
    email: 'rawnaq@showroom.jo',
  },
  {
    username: 'diwan',
    code: 'CUS-0108',
    nameEn: 'Diwan Seating',
    nameAr: 'ديوان للجلوس',
    city: 'Amman',
    area: 'Marka',
    street: 'Industrial Street 12',
    lat: 31.98,
    lng: 36.0,
    type: CustomerType.COMPANY,
    credit: 40000,
    terms: 30,
    contact: 'Farah Diwan',
    phone: '+962790210008',
    email: 'studio@diwan-seating.jo',
  },
  {
    username: 'noor',
    code: 'CUS-0109',
    nameEn: 'Noor Furnishings',
    nameAr: 'نور للمفروشات',
    city: 'Irbid',
    area: 'University Street',
    street: 'University Street 88',
    lat: 32.556,
    lng: 35.85,
    type: CustomerType.SHOWROOM,
    credit: 16000,
    terms: 14,
    contact: 'Noor Alayan',
    phone: '+962790210009',
    email: 'noor@furnishings.jo',
  },
  {
    username: 'jabal',
    code: 'CUS-0110',
    nameEn: 'Jabal Contract',
    nameAr: 'جبل للعقود',
    city: 'Amman',
    area: 'Shmeisani',
    street: 'Sharif Naser 4',
    lat: 31.975,
    lng: 35.9,
    type: CustomerType.COMPANY,
    credit: 70000,
    terms: 45,
    contact: 'Samer Jabal',
    phone: '+962790210010',
    email: 'tenders@jabal-contract.jo',
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

  const salesId =
    staff.find((s) => s.username === 'sales1')?.id ?? adminId;

  const dealers: DealerRef[] = [];
  for (const d of DEALERS) {
    const customer = await prisma.customer.create({
      data: {
        code: d.code,
        name: d.nameEn,
        nameEn: d.nameEn,
        nameAr: d.nameAr,
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
        industry: d.type === CustomerType.SHOWROOM ? 'Retail furniture' : 'Hospitality / contract',
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
      city: d.city,
      area: d.area,
      street: d.street,
      lat: d.lat,
      lng: d.lng,
    });
  }

  const peopleCount = staff.length + workers.length;
  console.log(`  people: ${staff.length} staff + ${workers.length} workers = ${peopleCount} (+ ${dealers.length} dealer logins)`);

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
    schedulerId: staff.find((s) => s.username === 'scheduler')?.id ?? adminId,
  };
}
