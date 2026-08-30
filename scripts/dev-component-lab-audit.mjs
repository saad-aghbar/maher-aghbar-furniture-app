#!/usr/bin/env node
/**
 * Dev component-lab audit — H1 source-file coverage.
 *
 * Scans visual trees under apps/mobile and reconciles against
 * apps/mobile/src/dev/component-lab/registry/file-classifications.json
 *
 * Usage: pnpm dev:component-lab:audit
 * Exit 1 if any UNCLASSIFIED visual file or export remains.
 */
import { createRequire } from 'node:module';
import {
  readdirSync,
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  statSync,
} from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MOBILE = join(ROOT, 'apps/mobile');
const CLASS_PATH = join(
  MOBILE,
  'src/dev/component-lab/registry/file-classifications.json',
);
const REPORT_PATH = join(ROOT, 'docs/dev-component-lab-audit-report.md');

const TREES = [
  join(MOBILE, 'app'),
  join(MOBILE, 'src/components'),
  join(MOBILE, 'src/features'),
  join(MOBILE, 'src/motion'),
];

const EXCLUDE_DIR_BITS = [
  '/__tests__/',
  '/node_modules/',
  '/.expo/',
  '/coverage/',
];

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      const rel = full.replace(/\\/g, '/');
      if (EXCLUDE_DIR_BITS.some((b) => rel.includes(b))) continue;
      walk(full, out);
    } else if (name.endsWith('.tsx')) {
      const norm = full.replace(/\\/g, '/');
      if (EXCLUDE_DIR_BITS.some((b) => norm.includes(b))) continue;
      if (/\.(test|spec)\.tsx$/.test(name)) continue;
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
  const re2 = /export\s+\{\s*([^}]+)\s*\}/g;
  while ((m = re2.exec(src))) {
    for (const part of m[1].split(',')) {
      const id = part.trim().split(/\s+as\s+/).pop()?.trim();
      if (id && /^[A-Z]/.test(id)) names.add(id);
    }
  }
  return [...names];
}

function isLikelyNonVisual(path, src, exports) {
  const base = path.split('/').pop() ?? '';
  if (base.startsWith('use') && exports.every((e) => e.startsWith('use'))) return true;
  if (/\/(hooks|query|select|types|utils|lib|api)\//.test(path)) {
    // still may contain UI — only exclude if no JSX-looking tags and no PascalCase export rendering
    if (!/<[A-Z]/.test(src) && !/return\s*\(\s*</.test(src)) return true;
  }
  if (exports.length === 0 && !/return\s*\(\s*</.test(src) && !/<[A-Za-z]/.test(src)) {
    return true;
  }
  return false;
}

function loadClassifications() {
  if (!existsSync(CLASS_PATH)) return {};
  return JSON.parse(readFileSync(CLASS_PATH, 'utf8'));
}

function main() {
  const files = TREES.flatMap((t) => walk(t));
  const classifications = loadClassifications();
  const rows = [];

  let registered = 0;
  let parent = 0;
  let screenLink = 0;
  let excluded = 0;
  let unclassified = 0;
  let exportCandidates = 0;
  let unclassifiedExports = 0;

  for (const full of files.sort()) {
    const rel = relative(MOBILE, full).replace(/\\/g, '/');
    const src = readFileSync(full, 'utf8');
    const exports = extractExports(src);
    exportCandidates += exports.length;

    let classification = classifications[rel]?.classification;
    const registryIds = classifications[rel]?.registryIds ?? [];
    const notes = classifications[rel]?.notes;

    if (!classification) {
      if (isLikelyNonVisual(rel, src, exports)) {
        classification = 'EXCLUDED_NON_VISUAL';
      } else {
        classification = 'UNCLASSIFIED';
      }
    }

    if (classification === 'REGISTERED') registered += 1;
    else if (classification === 'REPRESENTED_BY_PARENT') parent += 1;
    else if (classification === 'SCREEN_LINK') screenLink += 1;
    else if (classification === 'EXCLUDED_NON_VISUAL') excluded += 1;
    else {
      unclassified += 1;
      unclassifiedExports += Math.max(exports.length, 1);
    }

    rows.push({ path: rel, classification, exportNames: exports, registryIds, notes });
  }

  const md = [
    '# Dev Component Lab — Audit Report',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    '| Metric | Count |',
    '|--------|------:|',
    `| TOTAL VISUAL FILES AUDITED | ${rows.length} |`,
    `| TOTAL VISUAL EXPORTS/CANDIDATES | ${exportCandidates} |`,
    `| REGISTERED | ${registered} |`,
    `| REPRESENTED BY PARENT | ${parent} |`,
    `| SCREEN-LINK | ${screenLink} |`,
    `| EXCLUDED NON-VISUAL | ${excluded} |`,
    `| UNCLASSIFIED | ${unclassified} |`,
    '',
    unclassified
      ? '## UNCLASSIFIED files\n\n' +
        rows
          .filter((r) => r.classification === 'UNCLASSIFIED')
          .map((r) => `- \`${r.path}\` exports: ${r.exportNames.join(', ') || '(none)'}`)
          .join('\n')
      : '## UNCLASSIFIED files\n\nNone.',
    '',
  ].join('\n');

  mkdirSync(dirname(REPORT_PATH), { recursive: true });
  writeFileSync(REPORT_PATH, md);

  // Also emit machine-readable snapshot for smoke
  const snapshot = {
    totalFiles: rows.length,
    totalExports: exportCandidates,
    registered,
    representedByParent: parent,
    screenLink,
    excludedNonVisual: excluded,
    unclassified,
    unclassifiedExports,
  };
  writeFileSync(
    join(MOBILE, 'src/dev/component-lab/registry/audit-snapshot.json'),
    JSON.stringify(snapshot, null, 2) + '\n',
  );

  console.log(md);
  console.log(`Wrote ${REPORT_PATH}`);

  if (unclassified > 0) {
    console.error(`FAIL: ${unclassified} UNCLASSIFIED visual file(s)`);
    process.exit(1);
  }
  console.log('PASS: UNCLASSIFIED files = 0');
}

main();
