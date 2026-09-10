import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

const schedulingDir = join(__dirname, '..');

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

describe('scheduling floor sweep', () => {
  const files = walk(schedulingDir);

  it('keeps scheduling surfaces off banned cards', () => {
    for (const file of files) {
      assertFloor(readFileSync(file, 'utf8'));
    }
  });
});
