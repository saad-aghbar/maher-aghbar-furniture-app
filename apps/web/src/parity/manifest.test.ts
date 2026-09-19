import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { WEB_PARITY, mobileRouteKey } from './manifest';

function walk(dir: string, files: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, files);
    else if (full.endsWith('.tsx')) files.push(full);
  }
  return files;
}

describe('web parity manifest', () => {
  it('covers every mobile route file or marks it native/dev', () => {
    const root = join(__dirname, '../../../mobile/app');
    const files = walk(root);
    const keys = files
      .map((file) => mobileRouteKey(file.replace(/\\/g, '/')))
      .filter((key): key is string => typeof key === 'string' && !key.includes('/_') && !key.endsWith('/_layout'));
    const mapped = new Set(WEB_PARITY.map((row) => row.mobile.replace(/\/$/, '') || '/'));
    const missing = keys.filter((key) => {
      const normalized = key.replace(/\/$/, '') || '/';
      if (normalized.startsWith('/dev') || normalized === '/index' || normalized === '/') return false;
      if (normalized.includes('_layout')) return false;
      return !mapped.has(normalized) && !WEB_PARITY.some((row) => row.mobile.replace(/\/$/, '') === normalized);
    });
    expect(missing.slice(0, 20)).toEqual([]);
  });
});
