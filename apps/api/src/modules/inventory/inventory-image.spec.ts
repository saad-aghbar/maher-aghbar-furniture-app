import { readFileSync } from 'fs';
import { join } from 'path';
import { canonicalInventoryImageUrl } from './inventory-image';

const inventoryDir = __dirname;
const repoRoot = join(inventoryDir, '../../../../../');

function readRepo(rel: string) {
  return readFileSync(join(repoRoot, rel), 'utf8');
}

describe('canonicalInventoryImageUrl', () => {
  it('returns a trimmed URL', () => {
    expect(canonicalInventoryImageUrl({ imageUrl: '  https://cdn.example/velvet.jpg  ' })).toBe(
      'https://cdn.example/velvet.jpg',
    );
  });

  it('returns null for missing, blank, or undefined', () => {
    expect(canonicalInventoryImageUrl(null)).toBeNull();
    expect(canonicalInventoryImageUrl(undefined)).toBeNull();
    expect(canonicalInventoryImageUrl({})).toBeNull();
    expect(canonicalInventoryImageUrl({ imageUrl: null })).toBeNull();
    expect(canonicalInventoryImageUrl({ imageUrl: '   ' })).toBeNull();
  });

  it('does not invent a fallback URL', () => {
    expect(canonicalInventoryImageUrl({ imageUrl: '' })).toBeNull();
  });

  it('GET items requires inventory.read; PATCH imageUrl requires inventory.adjust', () => {
    const src = readFileSync(join(inventoryDir, 'inventory.controller.ts'), 'utf8');
    const getIdx = src.lastIndexOf("@Get('items/:id')");
    expect(getIdx).toBeGreaterThan(-1);
    const getBlock = src.slice(getIdx, getIdx + 220);
    expect(getBlock).toContain("RequirePermissions('inventory.read')");
    const patchBlock = src.slice(
      src.indexOf("@Patch('items/:id')"),
      src.indexOf("@Post('items/sync-from-materials')"),
    );
    expect(patchBlock).toContain("RequirePermissions('inventory.adjust')");
    expect(src).toContain('imageUrl?: string | null');
  });

  it('INVENTORY_IMAGE upload allows document.manage, catalog.manage, or inventory.adjust', () => {
    const src = readRepo('apps/api/src/modules/documents/uploads.controller.ts');
    expect(src).toContain(
      "RequireAnyPermissions('document.manage', 'catalog.manage', 'inventory.adjust')",
    );
    expect(src).toContain("category === 'INVENTORY_IMAGE'");
  });

  it('material demand and production-setup pass inventory imageUrl without copying onto PO lines', () => {
    const demand = readRepo('apps/api/src/modules/purchasing/purchasing.service.ts');
    expect(demand).toContain('canonicalInventoryImageUrl');
    expect(demand).toMatch(/imageUrl:\s*canonicalInventoryImageUrl\(item\)/);

    const setup = readRepo('apps/api/src/modules/production/production-setup.service.ts');
    expect(setup).toContain('canonicalInventoryImageUrl');
    expect(setup).toMatch(/imageUrl:\s*canonicalInventoryImageUrl\(row\.inventoryItem\)/);

    const schema = readRepo('packages/database/prisma/schema.prisma');
    const poLine = schema.slice(
      schema.indexOf('model PurchaseOrderLine'),
      schema.indexOf('model GoodsReceipt'),
    );
    expect(poLine).not.toMatch(/imageUrl/);
  });

  it('curated demo pool has 42 unique SKU photos including Cedar velvet', () => {
    const src = readRepo('packages/database/prisma/demo/material-photo-pool.ts');
    const skus = [...src.matchAll(/'(MAT-[A-Z0-9-]+)':\s*photo\(/g)].map((m) => m[1]);
    const photos = [...src.matchAll(/photo\('(photo-[^']+)'\)/g)].map((m) => m[1]);
    expect(skus).toHaveLength(42);
    expect(new Set(skus).size).toBe(42);
    expect(photos).toHaveLength(42);
    expect(new Set(photos).size).toBe(42);
    expect(skus).toContain('MAT-ITAL-VEL');
  });
});
