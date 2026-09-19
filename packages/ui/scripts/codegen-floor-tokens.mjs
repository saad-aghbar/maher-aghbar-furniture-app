#!/usr/bin/env node
/**
 * Syncs packages/ui floor tokens from apps/mobile/src/theme/colors.ts
 * plus radius.ts. Writes floor-tokens.json and patches the --maher-* hex
 * values in tokens.css so web and mobile cannot drift.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const colorsPath = resolve(root, 'apps/mobile/src/theme/colors.ts');
const radiusPath = resolve(root, 'apps/mobile/src/theme/radius.ts');
const jsonPath = resolve(root, 'packages/ui/src/floor-tokens.json');
const cssPath = resolve(root, 'packages/ui/src/tokens.css');

function extractBlock(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end < 0) throw new Error(`Missing ${startMarker}`);
  return source.slice(start, end);
}

function extractHex(source, key) {
  const match = source.match(new RegExp(`${key}:\\s*'(#[0-9A-Fa-f]{6})'`));
  return match?.[1] ?? null;
}

function extractRadius(source) {
  const out = {};
  for (const key of ['sm', 'md', 'lg', 'xl', 'full']) {
    const match = source.match(new RegExp(`${key}:\\s*(\\d+)`));
    if (match) out[key] = Number(match[1]);
  }
  return out;
}

const colors = readFileSync(colorsPath, 'utf8');
const light = extractBlock(colors, 'export const lightColors', 'export const darkColors');
const tokens = {
  light: {
    background: extractHex(light, 'background'),
    surface: extractHex(light, 'surface'),
    surfaceSecondary: extractHex(light, 'surfaceSecondary'),
    surfaceElevated: extractHex(light, 'surfaceElevated'),
    textPrimary: extractHex(light, 'textPrimary'),
    textSecondary: extractHex(light, 'textSecondary'),
    textMuted: extractHex(light, 'textMuted'),
    border: extractHex(light, 'border'),
    borderMuted: extractHex(light, 'borderMuted'),
    borderStrong: extractHex(light, 'borderStrong'),
    brand: extractHex(light, 'brand'),
    brandHover: extractHex(light, 'brandHover'),
    brandActive: extractHex(light, 'brandActive'),
    brandSoft: extractHex(light, 'brandSoft'),
    onBrand: extractHex(light, 'onBrand'),
    success: extractHex(light, 'success'),
    successSoft: extractHex(light, 'successSoft'),
    warning: extractHex(light, 'warning'),
    warningSoft: extractHex(light, 'warningSoft'),
    error: extractHex(light, 'error'),
    errorSoft: extractHex(light, 'errorSoft'),
    info: extractHex(light, 'info'),
    infoSoft: extractHex(light, 'infoSoft'),
  },
  radius: extractRadius(readFileSync(radiusPath, 'utf8')),
};

for (const [key, value] of Object.entries(tokens.light)) {
  if (!value) throw new Error(`Missing light token ${key}`);
}

writeFileSync(jsonPath, `${JSON.stringify(tokens, null, 2)}\n`);

const cssMap = {
  '--maher-background': tokens.light.background,
  '--maher-surface': tokens.light.surface,
  '--maher-surface-muted': tokens.light.surfaceSecondary,
  '--maher-text-primary': tokens.light.textPrimary,
  '--maher-text-secondary': tokens.light.textSecondary,
  '--maher-text-tertiary': tokens.light.textMuted,
  '--maher-border': tokens.light.border,
  '--maher-border-strong': tokens.light.borderStrong,
  '--maher-brand': tokens.light.brand,
  '--maher-brand-hover': tokens.light.brandHover,
  '--maher-brand-active': tokens.light.brandActive,
  '--maher-success': tokens.light.success,
  '--maher-success-soft': tokens.light.successSoft,
  '--maher-warning': tokens.light.warning,
  '--maher-warning-soft': tokens.light.warningSoft,
  '--maher-error': tokens.light.error,
  '--maher-error-soft': tokens.light.errorSoft,
  '--maher-info': tokens.light.info,
  '--maher-info-soft': tokens.light.infoSoft,
};

let css = readFileSync(cssPath, 'utf8');
for (const [variable, hex] of Object.entries(cssMap)) {
  const next = hex.toLowerCase();
  css = css.replace(new RegExp(`${variable}:\\s*#[0-9A-Fa-f]{6}`), `${variable}: ${next}`);
}
writeFileSync(cssPath, css);
console.log(`Wrote ${jsonPath} and patched ${cssPath}`);
