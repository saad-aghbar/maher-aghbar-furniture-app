import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

const purchasingDir = join(__dirname, '..');

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__tests__') continue;
      out.push(...walk(full));
    } else if (/\.(tsx|ts)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

describe('purchasing shared inputs', () => {
  const files = walk(purchasingDir);

  it('does not use a bare numeric TextField in purchasing sheets', () => {
    const offenders: string[] = [];
    for (const file of files) {
      if (!file.includes('/components/') && !file.endsWith('Screen.tsx')) continue;
      const source = readFileSync(file, 'utf8');
      if (!source.includes('TextField')) continue;
      const hasNumericKeyboard =
        source.includes('keyboardType="decimal-pad"') ||
        source.includes("keyboardType='decimal-pad'") ||
        source.includes('keyboardType="number-pad"') ||
        source.includes("keyboardType='number-pad'") ||
        source.includes('keyboardType="numeric"');
      if (hasNumericKeyboard) offenders.push(file);
    }
    expect(offenders).toEqual([]);
  });

  it('does not use a YYYY-MM-DD date placeholder', () => {
    const offenders: string[] = [];
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      if (source.includes('YYYY-MM-DD')) offenders.push(file);
    }
    expect(offenders).toEqual([]);
  });

  it('uses QtyStepperField on receive and create-order qty fields', () => {
    const receive = readFileSync(join(purchasingDir, 'ReceiveGoodsScreen.tsx'), 'utf8');
    const builder = readFileSync(join(purchasingDir, 'components/AddMaterialSheet.tsx'), 'utf8');
    const invoice = readFileSync(join(purchasingDir, 'components/EditSupplierInvoiceSheet.tsx'), 'utf8');
    expect(receive).toContain('QtyStepperField');
    expect(builder).toContain('QtyStepperField');
    expect(invoice).toContain('DatePickerField');
    expect(invoice).toContain('QtyStepperField');
  });
});
