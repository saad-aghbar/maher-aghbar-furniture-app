#!/usr/bin/env node
/**
 * Generates file-classifications.json covering every visual .tsx under mobile trees.
 * Shared components → REGISTERED (registry ids assigned).
 * App routes + *Screen.tsx → SCREEN_LINK.
 * Feature component files → REPRESENTED_BY_PARENT (linked to domain screen).
 * Tests/hooks-only → EXCLUDED_NON_VISUAL.
 *
 * Run: node scripts/generate-component-lab-classifications.mjs
 */
import { readdirSync, readFileSync, writeFileSync, existsSync, statSync, mkdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MOBILE = join(ROOT, 'apps/mobile');
const OUT = join(MOBILE, 'src/dev/component-lab/registry/file-classifications.json');

const TREES = [
  join(MOBILE, 'app'),
  join(MOBILE, 'src/components'),
  join(MOBILE, 'src/features'),
  join(MOBILE, 'src/motion'),
];

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (full.includes('__tests__') || full.includes('node_modules')) continue;
      walk(full, out);
    } else if (name.endsWith('.tsx') && !/\.(test|spec)\.tsx$/.test(name)) {
      out.push(full);
    }
  }
  return out;
}

function extractExports(src) {
  const names = new Set();
  const re =
    /export\s+(?:default\s+)?(?:async\s+)?(?:function|const|class)\s+([A-Z][A-Za-z0-9]*)/g;
  let m;
  while ((m = re.exec(src))) names.add(m[1]);
  return [...names];
}

function slug(name) {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/_/g, '-')
    .toLowerCase();
}

function featureDomain(rel) {
  const m = rel.match(/^src\/features\/([^/]+)/);
  return m ? m[1] : null;
}

function isNonVisual(rel, src, exports) {
  if (rel.includes('/__tests__/')) return true;
  if (/\/(hooks)\//.test(rel) && !/<[A-Z]/.test(src)) return true;
  if (
    /(query|select|types|utils|api|lib)\.[jt]sx?$/.test(rel) ||
    /\/(query|select|types|utils)\//.test(rel)
  ) {
    if (!/<[A-Z]/.test(src) && !/return\s*\(\s*</.test(src)) return true;
  }
  // style-only / theme tokens without JSX
  if (/Styles\.tsx$/.test(rel) && !/<[A-Z][a-zA-Z]/.test(src)) return true;
  if (exports.length === 0 && !/<[A-Za-z]/.test(src)) return true;
  return false;
}

function classify(rel, src, exports) {
  if (isNonVisual(rel, src, exports)) {
    return { classification: 'EXCLUDED_NON_VISUAL', registryIds: [], notes: 'non-visual' };
  }

  // Shared primitives + motion → REGISTERED
  if (rel.startsWith('src/components/') || rel.startsWith('src/motion/')) {
    const ids = exports.length
      ? exports.map((e) => {
          const prefix = rel.startsWith('src/motion/') ? 'motion' : 'shared';
          return `${prefix}.${slug(e)}`;
        })
      : [`shared.file.${slug(rel.split('/').pop().replace('.tsx', ''))}`];
    return { classification: 'REGISTERED', registryIds: ids, notes: 'shared/motion' };
  }

  // App routes → SCREEN_LINK
  if (rel.startsWith('app/')) {
    const routeHint = rel
      .replace(/^app\//, '/')
      .replace(/\/index\.tsx$/, '')
      .replace(/\.tsx$/, '')
      .replace(/\(([^)]+)\)\//g, '');
    const id = `screen.${slug(routeHint.replace(/\//g, '-') || 'root')}`;
    return {
      classification: 'SCREEN_LINK',
      registryIds: [id],
      notes: `route:${routeHint}`,
    };
  }

  // Feature screens → SCREEN_LINK
  if (/Screen\.tsx$/.test(rel) || /\/screens\//.test(rel)) {
    const name = exports[0] ?? rel.split('/').pop().replace('.tsx', '');
    const domain = featureDomain(rel) ?? 'feature';
    return {
      classification: 'SCREEN_LINK',
      registryIds: [`screen.${domain}.${slug(name)}`],
      notes: 'feature-screen',
    };
  }

  // Feature visual components → REPRESENTED_BY_PARENT (domain screen)
  // unless listed as having a direct lab demo.
  const domain = featureDomain(rel);
  if (domain) {
    const name = exports[0] ?? rel.split('/').pop().replace('.tsx', '');
    const ids = (exports.length ? exports : [name]).map(
      (e) => `feature.${domain}.${slug(e)}`,
    );
    const DIRECT_DEMO_FILES = new Set([
      'src/features/notifications/components/NotificationBoardCard.tsx',
    ]);
    if (DIRECT_DEMO_FILES.has(rel)) {
      return {
        classification: 'REGISTERED',
        registryIds: ids,
        notes: 'direct-demo',
      };
    }
    return {
      classification: 'REPRESENTED_BY_PARENT',
      registryIds: ids,
      notes: `parent-domain:${domain}`,
    };
  }

  return { classification: 'UNCLASSIFIED', registryIds: [], notes: 'fallback' };
}

function main() {
  const files = TREES.flatMap((t) => walk(t));
  const map = {};
  let counts = {
    REGISTERED: 0,
    REPRESENTED_BY_PARENT: 0,
    SCREEN_LINK: 0,
    EXCLUDED_NON_VISUAL: 0,
    UNCLASSIFIED: 0,
  };

  for (const full of files) {
    const rel = relative(MOBILE, full).replace(/\\/g, '/');
    const src = readFileSync(full, 'utf8');
    const exports = extractExports(src);
    const row = classify(rel, src, exports);
    map[rel] = { ...row, exportNames: exports };
    counts[row.classification] += 1;
  }

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(map, null, 2) + '\n');
  console.log('Wrote', OUT);
  console.log(counts);
  if (counts.UNCLASSIFIED > 0) {
    console.error('Generator left UNCLASSIFIED files — fix classify()');
    process.exit(1);
  }
}

main();
