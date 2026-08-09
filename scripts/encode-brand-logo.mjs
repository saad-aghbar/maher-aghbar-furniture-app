#!/usr/bin/env node
/**
 * Encode brand PNG assets into packages/ui/src/brand-logo-data.ts as data URIs.
 * Usage: node scripts/encode-brand-logo.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const brandDir = join(root, 'packages/ui/assets/brand');

const assets = {
  markLight: 'logomark-on-light.png',
  markDark: 'logomark-on-dark.png',
  lockupLight: 'lockup-on-light.png',
  lockupDark: 'lockup-on-dark.png',
};

function toDataUri(filename) {
  const buf = readFileSync(join(brandDir, filename));
  return `data:image/png;base64,${buf.toString('base64')}`;
}

const uris = Object.fromEntries(
  Object.entries(assets).map(([key, file]) => [key, toDataUri(file)]),
);

const out = `/** Auto-generated brand lockups (PNG data URIs). Run: node scripts/encode-brand-logo.mjs */
export const BRAND_LOGO_MARK_LIGHT_URI =
  '${uris.markLight}';

export const BRAND_LOGO_MARK_DARK_URI =
  '${uris.markDark}';

export const BRAND_LOGO_LOCKUP_LIGHT_URI =
  '${uris.lockupLight}';

export const BRAND_LOGO_LOCKUP_DARK_URI =
  '${uris.lockupDark}';

/** @deprecated Prefer BRAND_LOGO_MARK_LIGHT_URI — kept for older imports */
export const BRAND_LOGO_DATA_URI = BRAND_LOGO_MARK_LIGHT_URI;
`;

writeFileSync(join(root, 'packages/ui/src/brand-logo-data.ts'), out);
console.log('Wrote packages/ui/src/brand-logo-data.ts');
