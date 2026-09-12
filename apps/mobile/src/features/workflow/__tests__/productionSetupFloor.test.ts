import { readFileSync } from 'fs';
import { join } from 'path';

const dir = join(__dirname, '..');

function read(path: string) {
  return readFileSync(join(dir, path), 'utf8');
}

describe('Variant production setup floor', () => {
  it('keeps parchment boards and writes stage time with the variant BOM', () => {
    const screen = read('ProductionSetupScreen.tsx');
    const sheet = read('components/ProductionStageSetupSheet.tsx');
    expect(screen).toContain('orderBoardShadow');
    expect(screen).not.toContain('DeskCard');
    expect(screen).not.toContain("fontWeight: '700'");
    expect(screen).toContain('patchProductVariant');
    expect(screen).toContain('minutesPerUnit');
    expect(sheet).toContain('catalog.stageTime');
    expect(sheet).toContain('minutesPerUnit');
    expect(sheet).not.toContain('factoryNotes');
    expect(sheet).not.toContain('stageInstructions');
  });
});
