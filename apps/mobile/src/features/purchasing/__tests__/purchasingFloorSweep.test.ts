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
    } else if (/\.tsx$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

function assertFloor(source: string) {
  expect(source).not.toContain('DeskCard');
  expect(source).not.toContain('SurfaceCard');
  expect(source).not.toContain('colors.info');
}

describe('purchasing floor sweep', () => {
  const files = walk(purchasingDir);

  it('keeps every purchasing surface off banned cards', () => {
    for (const file of files) {
      assertFloor(readFileSync(file, 'utf8'));
    }
  });

  it('uses expandable + ScrollView and pixel sheet heights on sheets', () => {
    const sheets = files.filter((f) => f.includes('Sheet.tsx'));
    for (const file of sheets) {
      const source = readFileSync(file, 'utf8');
      if (!source.includes('BottomSheet')) continue;
      expect(source).not.toContain('sheetHeight={0.');
      if (source.includes('useWindowDimensions')) {
        expect(source).toContain('Math.round');
      }
    }
  });
});
