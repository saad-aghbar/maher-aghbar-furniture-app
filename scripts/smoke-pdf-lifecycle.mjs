/**
 * Lifecycle smoke against a running API (no browser required).
 * Usage: node scripts/smoke-pdf-lifecycle.mjs
 */
import http from 'node:http';

const API = process.env.API_URL ?? 'http://localhost:4000';

function request(method, path, { body, cookie } = {}) {
  const url = new URL(path, API);
  const payload = body ? JSON.stringify(body) : null;
  return new Promise((resolve, reject) => {
    const req = http.request(
      url,
      {
        method,
        headers: {
          ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {}),
          ...(cookie ? { Cookie: cookie } : {}),
        },
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          let json = null;
          try {
            json = text ? JSON.parse(text) : null;
          } catch {
            json = text;
          }
          const setCookie = res.headers['set-cookie'] ?? [];
          resolve({ status: res.statusCode ?? 0, json, setCookie });
        });
      },
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function cookieHeader(setCookie) {
  return setCookie.map((c) => c.split(';')[0]).join('; ');
}

const steps = [];
function ok(name, cond, detail = '') {
  steps.push({ name, ok: Boolean(cond), detail });
  const mark = cond ? 'PASS' : 'FAIL';
  console.log(`${mark}  ${name}${detail ? ` — ${detail}` : ''}`);
}

const login = await request('POST', '/api/v1/auth/login', {
  body: { email: 'admin@maher-aghbar.jo', password: 'Admin@12345!' },
});
const cookie = cookieHeader(login.setCookie);
ok('admin login', login.status === 201 || login.status === 200, String(login.status));

const checks = [
  '/api/v1/health',
  '/api/v1/reports/dashboard',
  '/api/v1/reports/sales',
  '/api/v1/inventory/warehouses',
  '/api/v1/notifications/templates',
  '/api/v1/users',
  '/api/v1/contracts',
  '/api/v1/returns',
];
for (const path of checks) {
  const res = await request('GET', path, { cookie });
  ok(path, res.status === 200, String(res.status));
}

const failed = steps.filter((s) => !s.ok);
console.log(`\n${steps.length - failed.length}/${steps.length} passed`);
process.exit(failed.length ? 1 : 0);
