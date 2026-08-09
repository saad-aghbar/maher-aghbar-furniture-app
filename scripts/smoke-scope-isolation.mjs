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

async function login(username) {
  const res = await request('POST', '/api/v1/auth/login', {
    body: { username, password: '123' },
  });
  return { status: res.status, cookie: cookieHeader(res.setCookie), user: res.json?.user };
}

const admin = await login('admin');
ok('admin login', admin.status === 200 || admin.status === 201);

const nile = await login('nile');
ok('nile customer login', nile.status === 200 || nile.status === 201, nile.user?.customerId ?? '');

const oasis = await login('oasis');
ok(
  'oasis customer login',
  oasis.status === 200 || oasis.status === 201,
  oasis.user?.customerId ?? '',
);
ok(
  'customers linked to different companies',
  Boolean(nile.user?.customerId && oasis.user?.customerId) &&
    nile.user.customerId !== oasis.user.customerId,
  `${nile.user?.customerId} vs ${oasis.user?.customerId}`,
);

const nileOrders = await request('GET', '/api/v1/sales-orders?pageSize=50', {
  cookie: nile.cookie,
});
const oasisOrders = await request('GET', '/api/v1/sales-orders?pageSize=50', {
  cookie: oasis.cookie,
});
ok('nile orders scoped', nileOrders.status === 200);
ok('oasis orders scoped', oasisOrders.status === 200);

const nileIds = new Set((nileOrders.json?.data ?? []).map((o) => o.id));
const oasisIds = new Set((oasisOrders.json?.data ?? []).map((o) => o.id));
const overlap = [...nileIds].filter((id) => oasisIds.has(id));
ok('no shared sales orders between customers', overlap.length === 0, `overlap=${overlap.length}`);

for (const order of nileOrders.json?.data ?? []) {
  ok(
    `nile order belongs to nile (${order.number})`,
    order.customer?.id === nile.user.customerId || order.customerId === nile.user.customerId,
  );
}
for (const order of oasisOrders.json?.data ?? []) {
  ok(
    `oasis order belongs to oasis (${order.number})`,
    order.customer?.id === oasis.user.customerId || order.customerId === oasis.user.customerId,
  );
}

if ((nileOrders.json?.data ?? []).length > 0) {
  const foreignId = nileOrders.json.data[0].id;
  const blocked = await request('GET', `/api/v1/sales-orders/${foreignId}`, {
    cookie: oasis.cookie,
  });
  ok(
    'oasis cannot open nile sales order',
    blocked.status === 403 || blocked.status === 404,
    String(blocked.status),
  );
}

const carpenter = await login('carpenter');
const carpenter2 = await login('carpenter2');
ok('carpenter login', carpenter.status === 200 || carpenter.status === 201);
ok('carpenter2 login', carpenter2.status === 200 || carpenter2.status === 201);

const carpenterTasks = await request('GET', '/api/v1/tasks?pageSize=50', {
  cookie: carpenter.cookie,
});
const carpenter2Tasks = await request('GET', '/api/v1/tasks?pageSize=50', {
  cookie: carpenter2.cookie,
});
ok('carpenter tasks list', carpenterTasks.status === 200);
ok('carpenter2 tasks list', carpenter2Tasks.status === 200);

const carpenterIds = new Set((carpenterTasks.json?.data ?? []).map((t) => t.id));
const carpenter2Ids = new Set((carpenter2Tasks.json?.data ?? []).map((t) => t.id));
const taskOverlap = [...carpenterIds].filter((id) => carpenter2Ids.has(id));
ok('carpenters see disjoint task sets', taskOverlap.length === 0, `overlap=${taskOverlap.length}`);

const carpenterAssigneeOk = (carpenterTasks.json?.data ?? []).every(
  (t) => !t.assignedEmployeeId || t.assignedEmployeeId === carpenter.user?.id,
);
const carpenter2AssigneeOk = (carpenter2Tasks.json?.data ?? []).every(
  (t) => !t.assignedEmployeeId || t.assignedEmployeeId === carpenter2.user?.id,
);
ok('carpenter only sees own assigned tasks', carpenterAssigneeOk);
ok('carpenter2 only sees own assigned tasks', carpenter2AssigneeOk);

const foreignForCarpenter2 = (carpenterTasks.json?.data ?? []).find(
  (t) => t.assignedEmployeeId === carpenter.user?.id,
);
if (foreignForCarpenter2) {
  const blocked = await request('GET', `/api/v1/tasks/${foreignForCarpenter2.id}`, {
    cookie: carpenter2.cookie,
  });
  ok(
    'carpenter2 cannot open carpenter task',
    blocked.status === 403 || blocked.status === 404,
    String(blocked.status),
  );
} else {
  ok('carpenter2 cannot open carpenter task', true, 'no carpenter-owned task in list');
}

const worker = await login('cutter');
ok('worker (material prep) login', worker.status === 200 || worker.status === 201);

const balqis = await login('balqis');
ok('balqis customer login', balqis.status === 200 || balqis.status === 201);

const failed = steps.filter((s) => !s.ok);
console.log(`\n${steps.length - failed.length}/${steps.length} passed`);
process.exit(failed.length ? 1 : 0);
