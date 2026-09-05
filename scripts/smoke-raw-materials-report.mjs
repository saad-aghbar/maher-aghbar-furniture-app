/**
 * Smoke the Raw Materials report JSON + PDF against a running API.
 * Usage: node scripts/smoke-raw-materials-report.mjs
 */
import http from 'node:http';

const API = process.env.API_URL ?? 'http://localhost:4000';

function request(method, path, { body, cookie, accept } = {}) {
  const url = new URL(path, API);
  const payload = body ? JSON.stringify(body) : null;
  return new Promise((resolve, reject) => {
    const req = http.request(
      url,
      {
        method,
        headers: {
          ...(payload
            ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
            : {}),
          ...(cookie ? { Cookie: cookie } : {}),
          ...(accept ? { Accept: accept } : {}),
        },
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const buf = Buffer.concat(chunks);
          const setCookie = res.headers['set-cookie'] ?? [];
          resolve({ status: res.statusCode ?? 0, buf, headers: res.headers, setCookie });
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
  body: { username: 'admin', password: '123' },
});
const cookie = cookieHeader(login.setCookie);
ok('admin login', login.status === 201 || login.status === 200, String(login.status));

const json = await request('GET', '/api/v1/inventory/reports/raw-materials?period=month', {
  cookie,
});
let payload = null;
try {
  payload = JSON.parse(json.buf.toString('utf8'));
} catch {
  payload = null;
}
ok('JSON 200', json.status === 200, String(json.status));
ok('JSON period echoed', Boolean(payload?.period?.fromYmd && payload?.period?.toYmd));
ok('JSON cost basis', payload?.costBasisId === 'standardCost+latestPurchaseReceipt');
ok('JSON quantity identity present', Array.isArray(payload?.items));

const pdf = await request('GET', '/api/v1/inventory/reports/raw-materials/pdf?period=month&lang=en', {
  cookie,
  accept: 'application/pdf',
});
ok('PDF 200', pdf.status === 200, String(pdf.status));
ok('PDF magic', pdf.buf.slice(0, 5).toString() === '%PDF-');
ok(
  'PDF content-type',
  String(pdf.headers['content-type'] ?? '').includes('pdf'),
  String(pdf.headers['content-type'] ?? ''),
);

const alias = await request('GET', '/api/v1/documents/inventory/reports/raw-materials?period=month', {
  cookie,
  accept: 'application/pdf',
});
ok('plan-path PDF 200', alias.status === 200, String(alias.status));
ok('plan-path PDF magic', alias.buf.slice(0, 5).toString() === '%PDF-');

const anon = await request('GET', '/api/v1/inventory/reports/raw-materials?period=month');
ok('unauthenticated rejected', anon.status === 401 || anon.status === 403, String(anon.status));

const failed = steps.filter((s) => !s.ok);
console.log(`\n${steps.length - failed.length}/${steps.length} passed`);
process.exit(failed.length ? 1 : 0);
