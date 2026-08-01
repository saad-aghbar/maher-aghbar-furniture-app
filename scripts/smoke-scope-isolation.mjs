/**
 * Proves multi-customer and multi-worker isolation.
 * Usage: node scripts/smoke-scope-isolation.mjs
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
          ...(payload
            ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
            : {}),
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
          resolve({
            status: res.statusCode ?? 0,
            json,
            setCookie: res.headers['set-cookie'] ?? [],
          });
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
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

async function login(email) {
  const res = await request('POST', '/api/v1/auth/login', {
    body: { email, password: 'Admin@12345!' },
  });
  return { status: res.status, cookie: cookieHeader(res.setCookie), user: res.json?.user };
}

const admin = await login('admin@maher-aghbar.jo');
ok('admin login', admin.status === 200 || admin.status === 201);

const cedar = await login('customer@cedar-hotel.jo');
ok('cedar customer login', cedar.status === 200 || cedar.status === 201, cedar.user?.customerId ?? '');

const olive = await login('customer@olive-restaurant.jo');
ok(
  'olive customer login',
  olive.status === 200 || olive.status === 201,
  olive.user?.customerId ?? '',
);
ok(
  'customers linked to different companies',
  Boolean(cedar.user?.customerId && olive.user?.customerId) &&
    cedar.user.customerId !== olive.user.customerId,
  `${cedar.user?.customerId} vs ${olive.user?.customerId}`,
);

const cedarOrders = await request('GET', '/api/v1/sales-orders?pageSize=50', {
  cookie: cedar.cookie,
});
const oliveOrders = await request('GET', '/api/v1/sales-orders?pageSize=50', {
  cookie: olive.cookie,
});
ok('cedar orders scoped', cedarOrders.status === 200);
ok('olive orders scoped', oliveOrders.status === 200);

const cedarIds = new Set((cedarOrders.json?.data ?? []).map((o) => o.id));
const oliveIds = new Set((oliveOrders.json?.data ?? []).map((o) => o.id));
const overlap = [...cedarIds].filter((id) => oliveIds.has(id));
ok('no shared sales orders between customers', overlap.length === 0, `overlap=${overlap.length}`);

for (const order of cedarOrders.json?.data ?? []) {
  ok(
    `cedar order belongs to cedar (${order.number})`,
    order.customer?.id === cedar.user.customerId || order.customerId === cedar.user.customerId,
  );
}
for (const order of oliveOrders.json?.data ?? []) {
  ok(
    `olive order belongs to olive (${order.number})`,
    order.customer?.id === olive.user.customerId || order.customerId === olive.user.customerId,
  );
}

if ((cedarOrders.json?.data ?? []).length > 0) {
  const foreignId = cedarOrders.json.data[0].id;
  const blocked = await request('GET', `/api/v1/sales-orders/${foreignId}`, {
    cookie: olive.cookie,
  });
  ok(
    'olive cannot open cedar sales order',
    blocked.status === 403 || blocked.status === 404,
    String(blocked.status),
  );
}

const carpenter = await login('carpenter@maher-aghbar.jo');
const worker = await login('worker@maher-aghbar.jo');
ok('carpenter login', carpenter.status === 200 || carpenter.status === 201);
ok('worker login', worker.status === 200 || worker.status === 201);

const carpenterTasks = await request('GET', '/api/v1/tasks?pageSize=50', {
  cookie: carpenter.cookie,
});
const workerTasks = await request('GET', '/api/v1/tasks?pageSize=50', {
  cookie: worker.cookie,
});
ok('carpenter tasks list', carpenterTasks.status === 200);
ok('worker tasks list', workerTasks.status === 200);

const carpenterAssigneeOk = (carpenterTasks.json?.data ?? []).every(
  (t) => !t.assignedEmployeeId || t.assignedEmployeeId === carpenter.user?.id,
);
const workerAssigneeOk = (workerTasks.json?.data ?? []).every(
  (t) => !t.assignedEmployeeId || t.assignedEmployeeId === worker.user?.id,
);
ok('carpenter only sees own assigned tasks', carpenterAssigneeOk);
ok('worker only sees own assigned tasks', workerAssigneeOk);

const adminTasks = await request('GET', '/api/v1/tasks?pageSize=50', { cookie: admin.cookie });
const otherTask = (adminTasks.json?.data ?? []).find(
  (t) => t.assignedEmployeeId && t.assignedEmployeeId !== carpenter.user?.id,
);
if (otherTask) {
  const blockedTask = await request('GET', `/api/v1/tasks/${otherTask.id}`, {
    cookie: carpenter.cookie,
  });
  ok(
    'carpenter cannot open another worker task',
    blockedTask.status === 403 || blockedTask.status === 404,
    String(blockedTask.status),
  );
} else {
  ok('carpenter cannot open another worker task', true, 'no foreign assigned task in seed');
}

const failed = steps.filter((s) => !s.ok);
console.log(`\n${steps.length - failed.length}/${steps.length} passed`);
process.exit(failed.length ? 1 : 0);
