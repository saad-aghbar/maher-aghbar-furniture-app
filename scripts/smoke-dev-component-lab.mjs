/**
 * Smoke: Dev Component Lab registry invariants (no device required).
 * Usage: pnpm smoke:dev-component-lab
 */
import { createRequire } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const steps = [];

function ok(name, cond, detail = '') {
  steps.push({ name, ok: Boolean(cond), detail });
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  return Boolean(cond);
}

// 1) Audit UNCLASSIFIED = 0
const audit = spawnSync('node', ['scripts/dev-component-lab-audit.mjs'], {
  cwd: ROOT,
  encoding: 'utf8',
});
ok('1. audit exit 0 (UNCLASSIFIED=0)', audit.status === 0, `status=${audit.status}`);

const snapshotPath = join(
  ROOT,
  'apps/mobile/src/dev/component-lab/registry/audit-snapshot.json',
);
const snap = existsSync(snapshotPath)
  ? JSON.parse(readFileSync(snapshotPath, 'utf8'))
  : null;
ok('2. audit snapshot present', Boolean(snap));
ok('3. unclassified files = 0', snap?.unclassified === 0, `n=${snap?.unclassified}`);

// 4) Classifications cover key names
const classPath = join(
  ROOT,
  'apps/mobile/src/dev/component-lab/registry/file-classifications.json',
);
const classifications = JSON.parse(readFileSync(classPath, 'utf8'));
const ids = Object.values(classifications).flatMap((r) => r.registryIds ?? []);
ok(
  '4. FloatingActionDock registered',
  ids.includes('shared.floating-action-dock'),
);
ok('5. ProductThumb registered', ids.includes('shared.product-thumb'));
ok(
  '6. NotificationBoardCard classified',
  ids.includes('feature.notifications.notification-board-card'),
);
ok(
  '7. PrimaryButton registered',
  ids.includes('shared.primary-button'),
);

// 8) Route file exists
ok(
  '8. /dev/tests routes exist',
  existsSync(join(ROOT, 'apps/mobile/app/dev/tests/index.tsx')) &&
    existsSync(join(ROOT, 'apps/mobile/app/dev/tests/[id].tsx')) &&
    existsSync(join(ROOT, 'apps/mobile/app/dev/tests/coverage.tsx')),
);

// 9) Entry row exists
ok(
  '9. DevTestsEntryRow exists',
  existsSync(
    join(ROOT, 'apps/mobile/src/dev/component-lab/screens/DevTestsEntryRow.tsx'),
  ),
);

// 10) Unique registry ids in classifications
const allIds = [];
for (const row of Object.values(classifications)) {
  for (const id of row.registryIds ?? []) allIds.push(id);
}
const unique = new Set(allIds);
ok(
  '10. classification registry ids mostly unique',
  unique.size >= allIds.length * 0.95,
  `unique=${unique.size} total=${allIds.length}`,
);

const failed = steps.filter((s) => !s.ok).length;
console.log(`\nDev component lab smoke: ${steps.length - failed}/${steps.length} PASS`);
process.exit(failed ? 1 : 0);
