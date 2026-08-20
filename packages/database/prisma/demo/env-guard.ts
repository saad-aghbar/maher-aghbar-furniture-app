const LOOPBACK = new Set(['127.0.0.1', 'localhost', '::1']);

export type DemoDbTarget = {
  host: string;
  port: string;
  database: string;
  nodeEnv: string;
};

export function parseDatabaseUrl(url = process.env.DATABASE_URL ?? ''): DemoDbTarget {
  if (!url) {
    throw new Error('DATABASE_URL is not set.');
  }
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('DATABASE_URL is not a valid URL.');
  }
  const database = parsed.pathname.replace(/^\//, '').split('?')[0] ?? '';
  return {
    host: parsed.hostname,
    port: parsed.port || '5432',
    database,
    nodeEnv: process.env.NODE_ENV ?? '',
  };
}

export function assertDemoEnvironment(url = process.env.DATABASE_URL): DemoDbTarget {
  const target = parseDatabaseUrl(url);
  const reasons: string[] = [];
  if (target.nodeEnv === 'production') {
    reasons.push(`NODE_ENV=${target.nodeEnv}`);
  }
  if (!LOOPBACK.has(target.host.toLowerCase())) {
    reasons.push(`host=${target.host} (loopback required)`);
  }
  if (target.database !== 'maher_erp') {
    reasons.push(`database=${target.database} (maher_erp required)`);
  }
  console.log(
    `Demo preflight: NODE_ENV=${target.nodeEnv || '(unset)'} host=${target.host} port=${target.port} database=${target.database}`,
  );
  if (reasons.length) {
    throw new Error(
      `Refusing demo reset — not a confirmed local DEV database (${reasons.join('; ')}).`,
    );
  }
  return target;
}
