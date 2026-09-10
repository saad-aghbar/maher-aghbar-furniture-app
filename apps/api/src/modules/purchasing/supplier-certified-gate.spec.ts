import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('supplier certification gate', () => {
  it('does not block purchase-order create on certification', () => {
    const service = readFileSync(join(__dirname, 'purchasing.service.ts'), 'utf8');
    const controller = readFileSync(join(__dirname, 'purchasing.controller.ts'), 'utf8');
    expect(service).not.toContain('assertSupplierCertified');
    expect(service).not.toContain('SUPPLIER_NOT_CERTIFIED');
    expect(controller).not.toContain('assertSupplierCertified');
    expect(controller).not.toContain('SUPPLIER_NOT_CERTIFIED');
  });
});
