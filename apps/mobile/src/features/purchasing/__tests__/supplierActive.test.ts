import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { toSearchParams } from '@/api/pagination';

describe('supplier active status', () => {
  it('lists choosers with status=ACTIVE', () => {
    const qs = toSearchParams({ page: 1, pageSize: 100, status: 'ACTIVE' });
    expect(qs).toContain('status=ACTIVE');
    expect(toSearchParams({ page: 1, pageSize: 100, q: 'marka' })).not.toContain('status=');
  });

  it('create/edit sheet writes status instead of certification', () => {
    const src = readFileSync(
      join(__dirname, '../components/CreateSupplierSheet.tsx'),
      'utf8',
    );
    expect(src).not.toContain('isCertified');
    expect(src).toContain("t('catalog.active')");
    expect(src).toContain("status: form.isActive ? 'ACTIVE' : 'INACTIVE'");
  });

  it('chooser rows no longer map isCertified', () => {
    const src = readFileSync(
      join(__dirname, '../components/CreatePurchaseOrderSheet.tsx'),
      'utf8',
    );
    expect(src).not.toContain('isCertified');
  });
});
