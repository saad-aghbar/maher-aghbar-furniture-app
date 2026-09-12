import { readFileSync } from 'fs';
import { join } from 'path';

const dir = join(__dirname, '..');

function read(path: string) {
  return readFileSync(join(dir, path), 'utf8');
}

function assertFloor(source: string) {
  expect(source).not.toContain('DeskCard');
  expect(source).not.toContain('SurfaceCard');
  expect(source).not.toContain('colors.info');
  expect(source).not.toContain("fontWeight: '700'");
}

describe('Spec option picker floor', () => {
  const files = [
    'components/SpecOptionPickerSheet.tsx',
    'components/SpecOptionChips.tsx',
  ];

  it('keeps parchment boards and forbids SaaS cards', () => {
    for (const file of files) {
      const source = read(file);
      assertFloor(source);
      expect(source).toMatch(/DealerBoard|orderBoardShadow|AnimatedPressable|BottomSheet/);
    }
  });

  it('picker is backed by SpecOptionValue and hides inactive rows', () => {
    const picker = read('components/SpecOptionPickerSheet.tsx');
    expect(picker).toContain('selectSpecOptionValuesForPicker');
    expect(picker).toContain('localizedName');
    expect(picker).toContain('SpecOptionValue');
    expect(picker).not.toMatch(/catch-all|free.?text box/i);
  });
});
