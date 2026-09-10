import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('JoFotara removal', () => {
  const roots = [
    join(__dirname, 'invoices.service.ts'),
    join(__dirname, 'invoices.controller.ts'),
    join(__dirname, '../../integrations/integrations.module.ts'),
    join(__dirname, '../../../../../packages/integrations/src/index.ts'),
  ];

  it('leaves no JoFotara symbols on invoice or integrations live paths', () => {
    for (const file of roots) {
      const src = readFileSync(file, 'utf8');
      expect(src).not.toMatch(/jofotara|JoFotara|JOFOTARA/i);
    }
  });
});
