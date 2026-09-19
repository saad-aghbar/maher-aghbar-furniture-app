import { upsertCatalogFabric, slugFabricCode, fabricListWhere } from './record-named-fabric';

describe('upsertCatalogFabric', () => {
  it('slugs a dealer-typed name into a catalog code', () => {
    expect(slugFabricCode('Velvet 302')).toBe('FAB-VELVET-302');
    expect(slugFabricCode('  linen beige  ')).toBe('FAB-LINEN-BEIGE');
  });

  it('creates a catalog row the first time a name is recorded', async () => {
    const created: unknown[] = [];
    const db = {
      fabric: {
        findFirst: jest.fn(async () => null),
        create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
          created.push(data);
          return { id: 'fab-1', ...data, isActive: true, nameHe: data.nameHe ?? null, color: data.color ?? null };
        }),
        update: jest.fn(),
      },
    };
    const row = await upsertCatalogFabric(db as never, { nameEn: 'Linen Beige', color: 'Beige' });
    expect(row.created).toBe(true);
    expect(created[0]).toMatchObject({
      code: 'FAB-LINEN-BEIGE',
      nameEn: 'Linen Beige',
      nameAr: 'Linen Beige',
      color: 'Beige',
      isActive: true,
    });
  });

  it('reactivates an existing name instead of duplicating', async () => {
    const db = {
      fabric: {
        findFirst: jest.fn(async () => ({
          id: 'fab-1',
          code: 'FAB-LINEN-BEIGE',
          nameEn: 'Linen Beige',
          nameAr: 'كتان بيج',
          nameHe: null,
          color: null,
          isActive: false,
        })),
        create: jest.fn(),
        update: jest.fn(async ({ data }: { data: Record<string, unknown> }) => ({
          id: 'fab-1',
          code: 'FAB-LINEN-BEIGE',
          nameEn: 'Linen Beige',
          nameAr: 'كتان بيج',
          nameHe: null,
          color: 'Beige',
          isActive: true,
          ...data,
        })),
      },
    };
    const row = await upsertCatalogFabric(db as never, {
      nameEn: 'Linen Beige',
      color: 'Beige',
    });
    expect(row.created).toBe(false);
    expect(db.fabric.create).not.toHaveBeenCalled();
    expect(db.fabric.update).toHaveBeenCalled();
    expect(row.isActive).toBe(true);
  });

  it('lists only active fabrics unless isActive=false', () => {
    expect(fabricListWhere({})).toEqual({ isActive: true });
    expect(fabricListWhere({ isActive: 'false' })).toEqual({});
    expect(fabricListWhere({ q: 'velvet' }).OR).toEqual(
      expect.arrayContaining([
        { nameEn: { contains: 'velvet', mode: 'insensitive' } },
        { nameAr: { contains: 'velvet', mode: 'insensitive' } },
        { nameHe: { contains: 'velvet', mode: 'insensitive' } },
      ]),
    );
  });
});
