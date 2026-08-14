/**
 * Factory UAT smoke: configure a product via production-setup API and walk
 * one order's inventory ledger if UAT fixtures exist.
 * Usage: node scripts/smoke-factory-uat.mjs
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

const adminLogin = await request('POST', '/api/v1/auth/login', {
  body: { username: 'admin', password: '123' },
});
const adminCookie = cookieHeader(adminLogin.setCookie);
ok('admin login', adminLogin.status === 200 || adminLogin.status === 201, String(adminLogin.status));

const products = await request('GET', '/api/v1/products?pageSize=100&q=UAT-SOFA', {
  cookie: adminCookie,
});
const rows = products.json?.data ?? [];
let productA = rows.find((p) => p.sku === 'UAT-SOFA-A');
if (!productA?.id) {
  const created = await request('POST', '/api/v1/products', {
    cookie: adminCookie,
    body: {
      nameEn: 'Smoke Factory Sofa',
      nameAr: 'كنبة دخان المصنع',
      unit: 'pcs',
    },
  });
  productA = created.json;
  ok('create product for setup API', Boolean(productA?.id), productA?.id ?? String(created.status));
} else {
  ok('UAT-SOFA-A fixture exists', Boolean(productA?.id), productA.id);
}

const workflows = await request('GET', '/api/v1/production-workflows', { cookie: adminCookie });
const wf = (workflows.json ?? []).find((w) => w.code === 'STANDARD_FURNITURE' && w.activeVersion)
  ?? (workflows.json ?? []).find((w) => w.activeVersion)
  ?? (workflows.json ?? [])[0];
ok('published workflow available', Boolean(wf?.id), wf?.code ?? String(workflows.status));

if (productA?.id && wf?.id) {
  const createdNew = !rows.find((p) => p.sku === 'UAT-SOFA-A');
  if (createdNew) {
    await request('PATCH', `/api/v1/products/${productA.id}/workflow-configuration`, {
      cookie: adminCookie,
      body: { workflowId: wf.id },
    });
  }
  const setup = await request('GET', `/api/v1/products/${productA.id}/production-setup`, {
    cookie: adminCookie,
  });
  ok(
    'production-setup GET',
    setup.status === 200 && Boolean(setup.json?.status),
    setup.json?.status ?? String(setup.status),
  );
  const preview = await request('GET', `/api/v1/products/${productA.id}/production-setup/preview`, {
    cookie: adminCookie,
  });
  ok(
    'production-setup preview',
    preview.status === 200 && Array.isArray(preview.json?.steps),
    String(preview.json?.steps?.length ?? preview.status),
  );
  if (setup.json?.stages?.length) {
    const stages = setup.json.stages.map((s, i) => {
      const isLast = i === setup.json.stages.length - 1;
      const produces = createdNew && (s.stageCode === 'PACKAGING' || isLast);
      return {
        workflowNodeId: s.workflowNodeId,
        stageDefinitionId: s.stageDefinitionId,
        behavior: produces ? 'PRODUCES_FINISHED' : s.behavior,
        consumesRawMaterials: s.consumesRawMaterials,
        consumesSemiFinished: s.consumesSemiFinished,
        outputNameEn: produces ? 'Smoke Sofa' : s.output?.nameEn,
        outputNameAr: produces ? 'كنبة دخان' : s.output?.nameAr,
        outputNameHe: s.output?.nameHe,
        outputQtyPerUnit: s.output?.qtyPerUnit ?? 1,
        defaultWarehouseId: s.output?.defaultWarehouseId,
        consumeOutputIds: s.consumeOutputIds ?? [],
      };
    });
    const put = await request('PUT', `/api/v1/products/${productA.id}/production-setup`, {
      cookie: adminCookie,
      body: { stages },
    });
    ok('production-setup PUT round-trip', put.status === 200, `${put.status} ${put.json?.status ?? ''}`);
  }
}

const lots = await request('GET', '/api/v1/inventory/semi-finished?pageSize=5', {
  cookie: adminCookie,
});
ok(
  'semi-finished lots inspectable',
  lots.status === 200 && Array.isArray(lots.json?.data),
  String(lots.json?.data?.length ?? lots.status),
);
if (lots.json?.data?.[0]?.id) {
  const lot = await request('GET', `/api/v1/inventory/lots/${lots.json.data[0].id}`, {
    cookie: adminCookie,
  });
  ok(
    'lot detail has product/order labels',
    lot.status === 200 &&
      (lot.json?.productionOrderNumber != null || lot.json?.productionOrder?.number != null),
    String(lot.status),
  );
}

const failed = steps.filter((s) => !s.ok);
console.log(`\n${steps.length - failed.length}/${steps.length} passed`);
process.exit(failed.length ? 1 : 0);
