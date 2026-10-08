import { spawnSync } from 'child_process';
import { mkdirSync, statSync } from 'fs';
import { resolve } from 'path';
import type { DemoDbTarget } from './env-guard';

const REPO_ROOT = resolve(__dirname, '../../../..');

const DEMO_QUEUES = [
  'scheduling',
  'emails',
  'sms',
  'whatsapp',
  'pdf',
  'ai',
  'ocr',
  'translation',
  'reports',
  'notifications',
  'file-processing',
] as const;

const SAFE_TRANSPORTS = new Set(['', 'console', 'mock', 'noop', 'local']);

/**
 * The developer's .env may point at live providers. This process and the
 * fabric-release child must not send mail, SMS, or paid AI. The file is unchanged.
 */
export function forceDemoTransports(): void {
  const forced = {
    EMAIL_PROVIDER: 'console',
    SMS_PROVIDER: 'console',
    WHATSAPP_PROVIDER: 'console',
    AI_PROVIDER: 'mock',
  } as const;
  for (const [key, value] of Object.entries(forced)) {
    const current = process.env[key]?.trim() ?? '';
    if (!SAFE_TRANSPORTS.has(current)) {
      console.log(`Demo transport: ${key} forced to ${value} for this process (env file unchanged).`);
    }
    process.env[key] = value;
  }
}

export function backupDemoDatabase(target: DemoDbTarget): string {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set.');
  const parsed = new URL(url);
  const dir = resolve(REPO_ROOT, 'backups');
  mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const file = resolve(dir, `maher_erp-pre-demo-${stamp}.dump`);
  const dump = spawnSync(
    'pg_dump',
    [
      '-Fc',
      '-h',
      parsed.hostname,
      '-p',
      parsed.port || '5432',
      '-U',
      decodeURIComponent(parsed.username),
      '-d',
      target.database,
      '-f',
      file,
    ],
    {
      encoding: 'utf8',
      env: { ...process.env, PGPASSWORD: decodeURIComponent(parsed.password) },
    },
  );
  if (dump.status !== 0) {
    throw new Error(`pg_dump failed: ${(dump.stderr || dump.stdout || '').trim()}`);
  }
  const size = statSync(file).size;
  if (size < 100) throw new Error(`Backup ${file} is only ${size} bytes.`);
  const list = spawnSync('pg_restore', ['--list', file], { encoding: 'utf8' });
  if (list.status !== 0) {
    throw new Error(`pg_restore --list failed: ${(list.stderr || '').trim()}`);
  }
  if (!/TABLE DATA|TABLE/i.test(list.stdout)) {
    throw new Error(`Backup ${file} listed no tables.`);
  }
  console.log(`Backup ${file} (${size} bytes) is readable.`);
  const user = decodeURIComponent(parsed.username);
  console.log(
    `Restore: PGPASSWORD set for ${user}, then pg_restore --clean --if-exists -h ${target.host} -p ${target.port} -U ${user} -d ${target.database} "${file}"`,
  );
  return file;
}

/** Delete only Bull keys for this app's queues. Do not flush Redis. */
export function drainDemoQueues(): void {
  for (const name of DEMO_QUEUES) {
    const prefix = `bull:${name}:`;
    const scan = spawnSync('redis-cli', ['--scan', '--pattern', `${prefix}*`], { encoding: 'utf8' });
    if (scan.status !== 0) {
      throw new Error(`redis-cli scan failed for ${name}: ${(scan.stderr || '').trim()}`);
    }
    const keys = scan.stdout
      .split('\n')
      .map((line) => line.trim())
      .filter((key) => key.startsWith(prefix));
    if (!keys.length) continue;
    for (let i = 0; i < keys.length; i += 40) {
      const chunk = keys.slice(i, i + 40);
      const deleted = spawnSync('redis-cli', ['DEL', ...chunk], { encoding: 'utf8' });
      if (deleted.status !== 0) {
        throw new Error(`redis-cli DEL failed for ${name}: ${(deleted.stderr || '').trim()}`);
      }
    }
    console.log(`Drained ${keys.length} Redis keys for queue ${name}.`);
  }
}

/** Stop a local apps/worker so its pollers cannot write during the wipe. */
export function stopLocalWorker(): void {
  const listed = spawnSync('pgrep', ['-fl', 'apps/worker'], { encoding: 'utf8' });
  const lines = (listed.stdout || '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.includes('maher-aghbar-furniture-app') && line.includes('apps/worker'));
  for (const line of lines) {
    const pid = Number(line.split(/\s+/)[0]);
    if (!pid || pid === process.pid) continue;
    try {
      process.kill(pid, 'SIGTERM');
      console.log(`Stopped local worker pid ${pid}.`);
    } catch (err) {
      console.log(`Worker pid ${pid} was already gone (${err instanceof Error ? err.message : err}).`);
    }
  }
}
