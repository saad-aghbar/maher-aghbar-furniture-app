import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { supplierListWhere } from './supplier-list-where';

describe('supplierListWhere', () => {
  it('hides archived rows and keeps inactive unless status=ACTIVE', () => {
    expect(supplierListWhere({})).toEqual({ archivedAt: null });
    expect(supplierListWhere({ status: 'ACTIVE' })).toEqual({
      archivedAt: null,
      status: 'ACTIVE',
    });
  });

  it('searches name fields when q is set', () => {
    const where = supplierListWhere({ q: 'marka', status: 'ACTIVE' });
    expect(where.status).toBe('ACTIVE');
    expect(where.OR).toEqual(
      expect.arrayContaining([
        { name: { contains: 'marka', mode: 'insensitive' } },
        { code: { contains: 'marka', mode: 'insensitive' } },
      ]),
    );
  });
});

describe('supplier create payload', () => {
  it('always persists certified true and does not take it from the client', () => {
    const src = readFileSync(join(__dirname, 'suppliers.controller.ts'), 'utf8');
    expect(src).toContain('isCertified: true');
    expect(src).not.toContain('dto.isCertified');
  });
});
