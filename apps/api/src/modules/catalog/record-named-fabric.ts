import type { Prisma } from '@maher/database';

type Db = {
  fabric: {
    findFirst: (args: Prisma.FabricFindFirstArgs) => Promise<{
      id: string;
      code: string;
      nameEn: string;
      nameAr: string;
      nameHe: string | null;
      color: string | null;
      isActive: boolean;
    } | null>;
    create: (args: Prisma.FabricCreateArgs) => Promise<{
      id: string;
      code: string;
      nameEn: string;
      nameAr: string;
      nameHe: string | null;
      color: string | null;
      isActive: boolean;
    }>;
    update: (args: Prisma.FabricUpdateArgs) => Promise<{
      id: string;
      code: string;
      nameEn: string;
      nameAr: string;
      nameHe: string | null;
      color: string | null;
      isActive: boolean;
    }>;
  };
};

function str(value: unknown): string {
  return String(value ?? '').trim();
}

/** Dealer list defaults to active rows; `isActive=false` includes archived names. */
export function fabricListWhere(query: { q?: string; isActive?: string }): Prisma.FabricWhereInput {
  const q = str(query.q);
  const includeInactive = str(query.isActive).toLowerCase() === 'false';
  return {
    ...(includeInactive ? {} : { isActive: true }),
    ...(q
      ? {
          OR: [
            { code: { contains: q, mode: 'insensitive' } },
            { nameEn: { contains: q, mode: 'insensitive' } },
            { nameAr: { contains: q, mode: 'insensitive' } },
            { nameHe: { contains: q, mode: 'insensitive' } },
            { color: { contains: q, mode: 'insensitive' } },
          ],
        }
      : {}),
  };
}

/** Stable catalog code from a dealer-typed name (Velvet 302 → FAB-VELVET-302). */
export function slugFabricCode(name: string): string {
  const slug = str(name)
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 16)
    .toUpperCase();
  return slug ? `FAB-${slug}` : 'FAB-CUSTOM';
}

export type RecordNamedFabricInput = {
  nameEn: string;
  nameAr?: string | null;
  nameHe?: string | null;
  code?: string | null;
  color?: string | null;
};

/**
 * Dealer-typed fabrics become catalog rows so the next order can pick them.
 * Idempotent on code or case-insensitive name.
 */
export async function upsertCatalogFabric(
  db: Db,
  input: RecordNamedFabricInput,
): Promise<{
  id: string;
  code: string;
  nameEn: string;
  nameAr: string;
  nameHe: string | null;
  color: string | null;
  isActive: boolean;
  created: boolean;
}> {
  const nameEn = str(input.nameEn) || str(input.nameAr) || str(input.nameHe);
  if (!nameEn) {
    throw new Error('FABRIC_NAME_REQUIRED');
  }
  const nameAr = str(input.nameAr) || nameEn;
  const nameHe = str(input.nameHe) || null;
  const color = str(input.color) || null;
  const wantedCode = str(input.code) || slugFabricCode(nameEn);

  const existing = await db.fabric.findFirst({
    where: {
      OR: [
        { code: { equals: wantedCode, mode: 'insensitive' } },
        { nameEn: { equals: nameEn, mode: 'insensitive' } },
        { nameAr: { equals: nameEn, mode: 'insensitive' } },
        { nameAr: { equals: nameAr, mode: 'insensitive' } },
      ],
    },
  });
  if (existing) {
    const patch: Prisma.FabricUpdateInput = {};
    if (!existing.isActive) patch.isActive = true;
    if (color && !existing.color) patch.color = color;
    if (nameHe && !existing.nameHe) patch.nameHe = nameHe;
    if (Object.keys(patch).length) {
      const updated = await db.fabric.update({ where: { id: existing.id }, data: patch });
      return { ...updated, created: false };
    }
    return { ...existing, created: false };
  }

  try {
    const created = await db.fabric.create({
      data: {
        code: wantedCode,
        nameEn,
        nameAr,
        nameHe,
        color,
        isActive: true,
      },
    });
    return { ...created, created: true };
  } catch {
    const raced = await db.fabric.findFirst({
      where: { code: { equals: wantedCode, mode: 'insensitive' } },
    });
    if (raced) return { ...raced, created: false };
    throw new Error('FABRIC_CODE_TAKEN');
  }
}
