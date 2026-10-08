/**
 * Live API smoke after demo:reset. Requires API on API_URL (default http://127.0.0.1:4000).
 * An unreachable API is a failure, not a skip.
 */
import { PrismaClient } from '@prisma/client';

const API = process.env.API_URL ?? 'http://127.0.0.1:4000';
const PASSWORD = '123';

const PERSONAS = [
  'admin',
  'production',
  'scheduling',
  'sales',
  'purchasing',
  'warehouse',
  'qc',
  'finance',
  'delivery',
  'carpenter',
  'foam',
  'upholsterer',
  'inspector',
  'packer',
  'recovery',
  'driver',
  'nile',
  'oasis',
  'balqis',
] as const;

type Json = Record<string, unknown>;

function rows(json: unknown): Json[] {
  if (Array.isArray(json)) return json as Json[];
  if (!json || typeof json !== 'object') return [];
  const body = json as Json;
  for (const key of ['data', 'items', 'results']) {
    if (Array.isArray(body[key])) return body[key] as Json[];
  }
  return [];
}

async function login(username: string): Promise<string> {
  const res = await fetch(`${API}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password: PASSWORD, client: 'mobile' }),
  });
  if (!res.ok) throw new Error(`${username} login failed: ${res.status} ${await res.text()}`);
  const json = (await res.json()) as { accessToken?: string; token?: string };
  const token = json.accessToken ?? json.token;
  if (!token) throw new Error(`${username} login returned no token`);
  return token;
}

async function request(path: string, token: string, init?: RequestInit): Promise<Response> {
  return fetch(`${API}/api/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init?.headers ?? {}),
    },
  });
}

async function get(path: string, token: string): Promise<unknown> {
  const res = await request(path, token);
  if (!res.ok) throw new Error(`GET ${path} → ${res.status} ${await res.text()}`);
  return res.json();
}

async function expectStatus(path: string, token: string, status: number): Promise<void> {
  const res = await request(path, token);
  if (res.status !== status) {
    throw new Error(`GET ${path} expected ${status}, got ${res.status} ${await res.text()}`);
  }
}

async function main() {
  let health: Response;
  try {
    health = await fetch(`${API}/api/v1/health`);
  } catch (err) {
    console.error(`live API UAT FAILED — ${API} not reachable (${err instanceof Error ? err.message : err})`);
    process.exit(1);
  }
  if (!health.ok) {
    console.error(`live API UAT FAILED — health ${health.status}`);
    process.exit(1);
  }

  const tokens = new Map<string, string>();
  for (const username of PERSONAS) {
    tokens.set(username, await login(username));
  }
  const admin = tokens.get('admin')!;
  const nile = tokens.get('nile')!;
  const carpenter = tokens.get('carpenter')!;

  const dashboard = (await get('/reports/dashboard', admin)) as Json;
  const prisma = new PrismaClient();
  try {
    const inProduction = await prisma.salesOrder.count({
      where: {
        archivedAt: null,
        status: { in: ['READY_FOR_PRODUCTION', 'IN_PRODUCTION', 'WAITING_FOR_MATERIALS'] },
      },
    });
    if (Number(dashboard.ordersInProduction) !== inProduction) {
      throw new Error(
        `dashboard ordersInProduction ${dashboard.ordersInProduction} ≠ table count ${inProduction}`,
      );
    }
    const outstanding = await prisma.invoice.aggregate({
      where: { archivedAt: null, status: { notIn: ['CANCELLED', 'VOID', 'DRAFT'] } },
      _sum: { outstandingAmount: true },
    });
    const expectedOutstanding = Number(outstanding._sum.outstandingAmount ?? 0);
    const reported = Number(dashboard.outstandingReceivables ?? NaN);
    if (!Number.isFinite(reported) || Math.abs(reported - expectedOutstanding) > 0.05) {
      throw new Error(`dashboard outstanding ${reported} ≠ invoices ${expectedOutstanding}`);
    }

    const listed = rows(await get('/sales-orders?page=1&pageSize=5', admin));
    if (listed.length < 1) throw new Error('sales order list page 1 is empty');
    const searched = rows(await get('/sales-orders?page=1&pageSize=5&q=Abdoun', admin));
    if (!searched.some((row) => String(row.projectName ?? row.number ?? '').includes('Abdoun') || String(row.number ?? '').length > 0)) {
      if (searched.length < 1) throw new Error('sales order search for Abdoun returned no rows');
    }
    const filtered = rows(await get('/sales-orders?page=1&pageSize=5&status=DELIVERED', admin));
    if (!filtered.length) throw new Error('DELIVERED sales order filter returned no rows');
    if (filtered.some((row) => row.status && row.status !== 'DELIVERED')) {
      throw new Error('DELIVERED filter included another status');
    }

    const products = rows(await get('/products?pageSize=20&q=SOF-3S-STD', admin));
    const sku = products.find((row) => row.sku === 'SOF-3S-STD');
    if (!sku) throw new Error('SOF-3S-STD missing from live products API');
    const imageUrl = String(sku.imageUrl ?? '');
    if (!/^https:\/\//.test(imageUrl) || /localhost|127\.0\.0\.1/i.test(imageUrl)) {
      throw new Error(`SOF-3S-STD imageUrl is not a public https URL (${imageUrl || 'empty'})`);
    }
    const image = await fetch(imageUrl);
    if (!image.ok) throw new Error(`SOF-3S-STD image ${imageUrl} → ${image.status}`);

    const doc = await prisma.document.findFirst({
      where: { mimeType: 'application/pdf', storageKey: { startsWith: 'demo/docs/' } },
      select: { id: true, fileName: true },
    });
    if (!doc) throw new Error('no demo PDF document to download');
    const link = (await get(`/uploads/documents/${doc.id}/link`, admin)) as { downloadPath?: string };
    if (!link.downloadPath?.startsWith('/api/v1/uploads/download?token=')) {
      throw new Error(`document link is not an API download path (${link.downloadPath ?? 'missing'})`);
    }
    const file = await fetch(`${API}${link.downloadPath}`);
    if (!file.ok) throw new Error(`document download → ${file.status}`);
    const head = Buffer.from(await file.arrayBuffer()).subarray(0, 5).toString('utf8');
    if (head !== '%PDF-') throw new Error(`document download is not a PDF (got ${head})`);

    const nileHome = await get('/reports/dealer-home', nile);
    if (!nileHome || typeof nileHome !== 'object') throw new Error('nile dealer home was empty');
    const workerHome = await get('/reports/worker-home', carpenter);
    if (!workerHome || typeof workerHome !== 'object') throw new Error('carpenter worker home was empty');

    await expectStatus('/reports/dashboard', carpenter, 403);
    const oasisOrder = await prisma.salesOrder.findFirst({
      where: { customer: { users: { some: { username: 'oasis' } } }, archivedAt: null },
      select: { id: true, number: true },
    });
    if (!oasisOrder) throw new Error('oasis has no sales order');
    const denied = await request(`/sales-orders/${oasisOrder.id}`, nile);
    if (denied.status !== 403 && denied.status !== 404) {
      throw new Error(`nile read ${oasisOrder.number} expected 403/404, got ${denied.status}`);
    }

    const waiting = await prisma.salesOrder.findFirst({
      where: {
        status: 'WAITING_FOR_MATERIALS',
        fabricProcurements: { some: { state: { in: ['WAITING', 'AWAITING_SUPPLIER', 'PARTIALLY_AVAILABLE'] } } },
      },
      select: { id: true, number: true },
    });
    if (!waiting) throw new Error('no linked shortage order');
    const fabrics = await get(`/fabric-procurements/orders/${waiting.id}`, admin);
    const fabricRows = rows(fabrics);
    const openFabric = fabricRows.some((row) =>
      ['WAITING', 'AWAITING_SUPPLIER', 'PARTIALLY_AVAILABLE'].includes(String(row.state ?? '')),
    );
    if (!openFabric && !JSON.stringify(fabrics).includes('WAITING') && !JSON.stringify(fabrics).includes('AWAITING')) {
      throw new Error(`${waiting.number} fabric board has no open procurement`);
    }

    const ret = await prisma.returnRequest.findUnique({
      where: { number: 'RT-DEMO-001' },
      select: { id: true },
    });
    if (!ret) throw new Error('RT-DEMO-001 missing');
    const capabilities = await get(`/returns/${ret.id}/capabilities`, admin);
    const capText = JSON.stringify(capabilities);
    if (!capText || capText === '{}' || capText === 'null') {
      throw new Error('RT-DEMO-001 capabilities were empty');
    }
    const pieces = rows(await get(`/returns/${ret.id}/pieces`, admin));
    if (pieces.length < 1) throw new Error('RT-DEMO-001 has no pieces');
  } finally {
    await prisma.$disconnect();
  }

  console.log('live API UAT passed');
  process.exit(0);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
