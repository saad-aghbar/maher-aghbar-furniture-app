import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const UI_SRC = resolve(__dirname, '../../../../packages/ui/src');
const WEB_SRC = resolve(__dirname, '..');

/** Shells retired by the Board template. Importing any of them from `@maher/ui` is a contract failure. */
const RETIRED = ['Card', 'MetricCard', 'PageHero', 'FloorBoard', 'SurfaceCard', 'FilterPanel', 'NestedNav'];

function read(rel: string): string {
  return readFileSync(resolve(UI_SRC, rel), 'utf8');
}

/**
 * Board template contract: paper shell, hairline border, tone through a stamp
 * or wash — never a colored side rail.
 */
describe('Board template contract', () => {
  const shells = ['board/Board.tsx', 'PageHeader.tsx', 'Table.tsx', 'Modal.tsx'];

  it.each(shells)('%s uses the board shell and no rail', (file) => {
    const src = read(file);
    expect(src).toContain('maher-board');
    expect(src).toContain('--maher-surface');
    expect(src).toContain('--maher-border)]');
    expect(src).not.toContain('w-[3px]');
    expect(src).not.toContain('inset-y-0 start-0');
  });

  it('Board carries tone through stamp + wash vars', () => {
    const src = read('board/Board.tsx');
    expect(src).toContain('--board-ink');
    expect(src).toContain('Stamp');
    expect(src).toContain('maher-board--wash-top');
  });

  it('tokens.css defines the board shadow and lift', () => {
    const css = read('tokens.css');
    expect(css).toContain('--maher-shadow-board:');
    expect(css).toContain('.maher-board--interactive:hover');
    expect(css).toContain('scale(0.985)');
  });

  it('no component in packages/ui draws a 3px rail', () => {
    const files = walk(UI_SRC).filter((f) => /\.(tsx|ts|css)$/.test(f) && !f.endsWith('.test.ts'));
    const offenders = files.filter((f) => /w-\[3px\]|width:\s*3px;/.test(readFileSync(f, 'utf8')));
    expect(offenders.map((f) => f.replace(UI_SRC, ''))).toEqual([]);
  });

  it('retired shells are gone from packages/ui', () => {
    const index = read('index.ts');
    for (const name of RETIRED) {
      expect(index).not.toMatch(new RegExp(`\\b${name}\\b`));
    }
    for (const file of ['Card.tsx', 'MetricCard.tsx', 'motion/PageHero.tsx', 'motion/SurfaceCard.tsx', 'floor/FloorBoard.tsx']) {
      expect(() => read(file)).toThrow();
    }
  });

  it('no web page imports a retired shell or the old list-card class', () => {
    const files = walk(WEB_SRC).filter((f) => /\.tsx$/.test(f) && !f.includes('.test.'));
    const offenders: string[] = [];
    for (const f of files) {
      const src = readFileSync(f, 'utf8');
      const imports = [...src.matchAll(/import\s*\{([^}]*)\}\s*from\s*['"]@maher\/ui['"]/gs)].map((m) => m[1] ?? '');
      const names = imports.flatMap((block) => block.split(',').map((n) => n.trim().replace(/^type\s+/, '').split(/\s+as\s+/)[0] ?? ''));
      if (names.some((n) => RETIRED.includes(n)) || src.includes('maher-list-card') || /w-\[3px\]/.test(src)) offenders.push(f.replace(WEB_SRC, ''));
    }
    expect(offenders).toEqual([]);
  });

  it('kit exports the chrome, overlay, list, detail, form, calendar and document families', () => {
    const index = read('index.ts');
    for (const family of ['./nav', './overlay', './list', './detail', './form', './calendar', './documents']) {
      expect(index).toContain(`from '${family}'`);
    }
  });
});

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = resolve(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}
