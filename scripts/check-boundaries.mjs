#!/usr/bin/env node
/**
 * Lightweight app-boundary check. No extra dependencies.
 *
 * Allowed: apps → packages; frontends → API over HTTP.
 * Forbidden: app → another app's source; packages → apps (except allowlist);
 *            Mobile → @maher/ui.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const ALLOWLIST = new Set([
  path.normalize('packages/database/prisma/seed/dealer-orders-recent.ts'),
]);

const SKIP_DIRS = new Set([
  'node_modules',
  'dist',
  '.next',
  '.expo',
  '.turbo',
  'coverage',
  '.git',
]);

const IMPORT_RE =
  /(?:from\s+|import\s*\(|require\s*\()\s*['"]([^'"]+)['"]/g;

const violations = [];

function walk(dir, acc = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, acc);
    else if (/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(entry.name) && !entry.name.endsWith('.d.ts')) {
      acc.push(full);
    }
  }
  return acc;
}

function rel(file) {
  return path.relative(ROOT, file).split(path.sep).join('/');
}

function appOf(posixPath) {
  const m = posixPath.match(/^apps\/([^/]+)/);
  return m ? m[1] : null;
}

function isUnderPackages(posixPath) {
  return posixPath.startsWith('packages/');
}

function resolveSpecifier(filePosix, spec) {
  if (!spec.startsWith('.')) return spec;
  const fromDir = path.posix.dirname(filePosix);
  const combined = path.posix.normalize(`${fromDir}/${spec}`);
  return combined.replace(/^\.\//, '');
}

function mentionsAppSrc(resolved, appName) {
  const prefix = `apps/${appName}`;
  return (
    resolved.includes(`${prefix}/`) ||
    resolved === prefix ||
    resolved.startsWith(`${prefix}/src`) ||
    resolved.includes(`/apps/${appName}/`)
  );
}

const files = [...walk(path.join(ROOT, 'apps')), ...walk(path.join(ROOT, 'packages'))];

for (const file of files) {
  const filePosix = rel(file);
  const source = fs.readFileSync(file, 'utf8');
  IMPORT_RE.lastIndex = 0;
  let match;
  while ((match = IMPORT_RE.exec(source))) {
    const spec = match[1];
    const resolved = resolveSpecifier(filePosix, spec);
    const fromApp = appOf(filePosix);

    if (fromApp === 'mobile' && (spec === '@maher/ui' || spec.startsWith('@maher/ui/'))) {
      violations.push(`${filePosix}: Mobile must not import @maher/ui (${spec})`);
    }

    const targetApps = ['api', 'admin-web', 'customer-portal', 'employee-portal', 'mobile', 'worker'];
    for (const target of targetApps) {
      if (!mentionsAppSrc(resolved, target) && !mentionsAppSrc(spec, target)) continue;
      if (fromApp === target) continue;

      if (ALLOWLIST.has(path.normalize(filePosix))) continue;

      if (isUnderPackages(filePosix)) {
        violations.push(`${filePosix}: package must not import apps/${target} (${spec})`);
        continue;
      }

      if (fromApp === 'mobile' && target !== 'mobile') {
        violations.push(`${filePosix}: Mobile must not import apps/${target} (${spec})`);
      } else if (
        (fromApp === 'admin-web' || fromApp === 'customer-portal' || fromApp === 'employee-portal') &&
        (target === 'mobile' || target === 'api')
      ) {
        violations.push(`${filePosix}: ${fromApp} must not import apps/${target} (${spec})`);
      } else if (fromApp && fromApp !== target) {
        violations.push(`${filePosix}: ${fromApp} must not import apps/${target} (${spec})`);
      }
    }
  }
}

if (violations.length) {
  console.error('Boundary check failed:\n');
  for (const v of violations) console.error(`  ${v}`);
  process.exit(1);
}

console.log('Boundary check passed (allowlist: packages/database/prisma/seed/dealer-orders-recent.ts).');
