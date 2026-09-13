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
    expect(sheet).toContain('StageTimeClock');
    expect(sheet).not.toContain('catalog.minutesPerUnit');
    expect(sheet).not.toContain('catalog.setupMinutes');
    expect(sheet).not.toContain('factoryNotes');
    expect(sheet).not.toContain('stageInstructions');
  });

  it('uses a hours-and-minutes workshop clock, not setup vs per-unit fields', () => {
    const clock = read('components/StageTimeClock.tsx');
    expect(clock).toContain('orderBoardShadow');
    expect(clock).toContain('AnimatedPressable');
    expect(clock).toContain('durationHours');
    expect(clock).toContain('durationMinutes');
    expect(clock).not.toContain('DeskCard');
    expect(clock).not.toContain('catalog.minutesPerUnit');
    expect(clock).not.toContain('catalog.setupMinutes');
  });
});
