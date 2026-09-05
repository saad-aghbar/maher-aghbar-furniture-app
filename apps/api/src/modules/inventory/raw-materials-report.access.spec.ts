import { readFileSync } from 'fs';
import { join } from 'path';

const dir = __dirname;

describe('raw materials report access', () => {
  it('JSON and PDF routes require both report.inventory.read and inventory.cost.read', () => {
    const inventory = readFileSync(join(dir, 'inventory.controller.ts'), 'utf8');
    const jsonBlock = inventory.slice(
      inventory.indexOf("@Get('reports/raw-materials')"),
      inventory.indexOf("@Get('reports/raw-materials')") + 280,
    );
    expect(jsonBlock).toContain("RequirePermissions('report.inventory.read', 'inventory.cost.read')");

    const pdf = readFileSync(join(dir, '../documents/pdf.controller.ts'), 'utf8');
    expect(pdf).toContain("@Get('inventory/reports/raw-materials/pdf')");
    expect(pdf).toContain("@Get('documents/inventory/reports/raw-materials')");
    const pdfBlock = pdf.slice(
      pdf.indexOf("@Get('inventory/reports/raw-materials/pdf')"),
      pdf.indexOf("@Get('inventory/reports/raw-materials/pdf')") + 320,
    );
    expect(pdfBlock).toContain("RequirePermissions('report.inventory.read', 'inventory.cost.read')");
  });
});
