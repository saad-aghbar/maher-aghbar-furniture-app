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

describe('Users floor', () => {
  const files = [
    'components/CreateUserSheet.tsx',
    'components/EditUserSheet.tsx',
    'components/userSheetForm.tsx',
  ];

  it('keeps parchment boards and forbids SaaS cards', () => {
    for (const file of files) {
      const source = read(file);
      assertFloor(source);
      expect(source).toMatch(/UserFormSection|HourlyRateField/);
    }
  });

  it('uses the shared plus-minus stepper for hourly rate', () => {
    const source = read('components/userSheetForm.tsx');
    expect(source).toContain('QtyStepperField');
    expect(source).toContain('unit="₪"');
    expect(source).not.toContain('TextField');
  });

  it('marks selected stage skills with a start rail, not a checkmark', () => {
    const source = read('components/StageSkillsPicker.tsx');
    assertFloor(source);
    expect(source).toContain('width: 3');
    expect(source).toContain('colors.brandSoft');
    expect(source).toContain("locale === 'ar' ? 'medium' : 'semibold'");
    expect(source).toContain('theme.radius.lg');
    expect(source).not.toContain("'✓ '");
  });

  it('calls useChromeSize before RolesTouchBar can return null', () => {
    const source = read('components/RolesTouchBar.tsx');
    const chrome = source.indexOf('useChromeSize(PILL_HEIGHT)');
    const early = source.indexOf('if (roles.length === 0) return null');
    expect(chrome).toBeGreaterThan(-1);
    expect(early).toBeGreaterThan(-1);
    expect(chrome).toBeLessThan(early);
  });
});
