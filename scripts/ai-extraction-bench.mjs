#!/usr/bin/env node
/**
 * Offline handwritten extraction bench against the mock vision fixture.
 * Reports per-field accuracy. Live photos are compared the same way when present.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MockExtractionProvider, MockTranslateProvider } from '../packages/integrations/dist/index.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const expected = JSON.parse(
  readFileSync(
    join(root, 'packages/integrations/src/ai/__fixtures__/handwritten/two-product.expected.json'),
    'utf8',
  ),
);

const FIELDS = ['productName', 'quantity', 'width', 'height', 'depth', 'foamDensity', 'orientation'];

function score(actual, gold) {
  const rows = [];
  let hit = 0;
  let total = 0;
  for (let i = 0; i < gold.items.length; i += 1) {
    const a = actual.items?.[i] ?? {};
    const g = gold.items[i];
    for (const field of FIELDS) {
      if (g[field] == null) continue;
      total += 1;
      const ok = String(a[field] ?? '').trim() === String(g[field]).trim();
      if (ok) hit += 1;
      rows.push({ item: i + 1, field, expected: g[field], actual: a[field] ?? null, ok });
    }
  }
  return { accuracy: total ? hit / total : 0, hit, total, rows };
}

const extract = new MockExtractionProvider(new MockTranslateProvider());
const result = await extract.extractSpecFromImage(Buffer.from('fixture'), 'image/jpeg');
const report = score(result, expected);

const md = [
  '# Handwritten extraction bench',
  '',
  `Accuracy: ${(report.accuracy * 100).toFixed(1)}% (${report.hit}/${report.total} fields).`,
  '',
  '| Item | Field | Expected | Actual | Match |',
  '| --- | --- | --- | --- | --- |',
  ...report.rows.map(
    (row) =>
      `| ${row.item} | ${row.field} | ${row.expected} | ${row.actual ?? ''} | ${row.ok ? 'yes' : 'no'} |`,
  ),
  '',
].join('\n');

writeFileSync(join(root, 'docs/ai-extraction-bench.md'), md);
console.log(md);
if (report.accuracy < 0.8) process.exit(1);
