import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import tokens from '../../../../packages/ui/src/floor-tokens.json';

function extractHex(source: string, key: string): string | null {
  const match = source.match(new RegExp(`${key}:\\s*'(#[0-9A-Fa-f]{6})'`));
  return match?.[1] ?? null;
}

describe('floor token drift', () => {
  it('matches mobile light parchment tokens', () => {
    const colors = readFileSync(
      resolve(__dirname, '../../../../apps/mobile/src/theme/colors.ts'),
      'utf8',
    );
    const light = colors.slice(
      colors.indexOf('export const lightColors'),
      colors.indexOf('export const darkColors'),
    );
    expect(extractHex(light, 'background')).toBe(tokens.light.background);
    expect(extractHex(light, 'surface')).toBe(tokens.light.surface);
    expect(extractHex(light, 'brand')).toBe(tokens.light.brand);
    expect(extractHex(light, 'success')).toBe(tokens.light.success);
    expect(extractHex(light, 'warning')).toBe(tokens.light.warning);
    expect(extractHex(light, 'error')).toBe(tokens.light.error);
  });
});
