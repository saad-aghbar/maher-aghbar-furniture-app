import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('FloorBoard contract', () => {
  it('keeps the 3px start rail and parchment surface', () => {
    const src = readFileSync(
      resolve(__dirname, '../../../../packages/ui/src/floor/FloorBoard.tsx'),
      'utf8',
    );
    expect(src).toContain('w-[3px]');
    expect(src).toContain('--maher-surface');
    expect(src).toContain('--maher-brand');
  });
});
