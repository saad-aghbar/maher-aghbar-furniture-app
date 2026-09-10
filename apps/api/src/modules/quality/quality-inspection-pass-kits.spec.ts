import { readFileSync } from 'fs';
import { join } from 'path';

describe('quality inspection pass kits', () => {
  it('does not mark WIP kits consumed on QC pass', () => {
    const src = readFileSync(join(__dirname, 'quality-inspection.service.ts'), 'utf8');
    expect(src).not.toMatch(/markConsumedForStage/);
    expect(src).not.toMatch(/WipKitService/);
  });
});
