#!/usr/bin/env node
/**
 * Boot (or reuse) the local stack, then run Maestro flows against the Expo
 * dev client. Kept out of the blocking CI job — needs a simulator.
 *
 *   pnpm mobile:e2e
 *   pnpm mobile:e2e e2e/mobile/login.yaml
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const STACK = join(ROOT, '.cursor/skills/dev-stack/scripts/stack.sh');
const FLOWS_DIR = join(ROOT, 'e2e/mobile');

function run(cmd, args, opts = {}) {
  const result = spawnSync(cmd, args, {
    cwd: ROOT,
    stdio: 'inherit',
    env: { ...process.env, CI: undefined, CONTINUOUS_INTEGRATION: undefined },
    ...opts,
  });
  return result.status ?? 1;
}

function which(bin) {
  const result = spawnSync('which', [bin], { encoding: 'utf8' });
  return result.status === 0;
}

if (!which('maestro')) {
  console.error('Maestro CLI not found. Install: curl -Ls "https://get.maestro.mobile.dev" | bash');
  process.exit(1);
}

if (existsSync(STACK)) {
  const status = spawnSync('bash', [STACK, 'status'], {
    cwd: ROOT,
    encoding: 'utf8',
    env: process.env,
  });
  process.stdout.write(status.stdout ?? '');
  process.stderr.write(status.stderr ?? '');
  if (status.status !== 0) {
    console.warn('Dev stack is not fully healthy. Start it with /run, then retry.');
  }
}

const extra = process.argv.slice(2);
const target = extra.length ? extra : [FLOWS_DIR];
const code = run('maestro', ['test', ...target]);
process.exit(code);
