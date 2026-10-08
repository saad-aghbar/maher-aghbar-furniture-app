/**
 * Move one new Nile ottoman through the live API:
 * request → quotation → accept → release → tasks → inspection → delivery → invoice → payment.
 * This mutates the database. Run demo:reset again afterwards to restore the presentation world.
 */
import { PrismaClient } from '@prisma/client';

const API = process.env.API_URL ?? 'http://127.0.0.1:4000';
const PROJECT = 'Demo walk sofa';

type Json = Record<string, unknown>;

async function login(username: string): Promise<string> {
  const res = await fetch(`${API}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password: '123', client: 'mobile' }),
  });
  if (!res.ok) throw new Error(`${username} login ${res.status} ${await res.text()}`);
  const json = (await res.json()) as { accessToken?: string; token?: string };
  const token = json.accessToken ?? json.token;
  if (!token) throw new Error(`${username} login returned no token`);
  return token;
}

async function call(token: string, method: string, path: string, body?: unknown): Promise<Json> {
  const res = await fetch(`${API}/api/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    throw new Error(`${method} ${path} → ${res.status} ${text.slice(0, 800)}`);
  }
  return (json ?? {}) as Json;
}

function idOf(json: Json): string {
  const id = json.id ?? (json.data as Json | undefined)?.id;
  if (typeof id !== 'string') throw new Error(`response has no id: ${JSON.stringify(json).slice(0, 300)}`);
  return id;
}

async function main() {
  let health: Response;
  try {
    health = await fetch(`${API}/api/v1/health`);
  } catch (err) {
    throw new Error(`workflow walk FAILED — ${API} not reachable (${err instanceof Error ? err.message : err})`);
  }
  if (!health.ok) throw new Error(`workflow walk FAILED — health ${health.status}`);

  const admin = await login('admin');
  const sales = await login('sales');
  const nile = await login('nile');
  const qc = await login('qc');

  const products = await call(admin, 'GET', '/products?pageSize=20&q=SOF-3S-STD');
  const list = (Array.isArray(products.data) ? products.data : Array.isArray(products) ? products : []) as Json[];
  const product = list.find((row) => row.sku === 'SOF-3S-STD') ?? list[0];
  if (!product?.id) throw new Error('SOF-3S-STD was not returned by the products API');
  const variants = (product.variants as Json[] | undefined) ?? [];
  const variant = variants.find((row) => row.isDefault) ?? variants[0];

  const dealers = await call(admin, 'GET', '/customers?pageSize=20&q=nile');
  const dealerRows = (Array.isArray(dealers.data) ? dealers.data : []) as Json[];
  const dealer =
    dealerRows.find((row) => String(row.code ?? row.username ?? '').toLowerCase().includes('nile')) ??
    dealerRows[0];
  let customerId = typeof dealer?.id === 'string' ? dealer.id : '';
  if (!customerId) {
    const me = await call(nile, 'GET', '/auth/me');
    customerId = String(me.customerId ?? '');
  }
  if (!customerId) throw new Error('could not resolve the Nile customer id');

  const request = await call(sales, 'POST', '/requests?submit=true', {
    customerId,
    projectName: PROJECT,
    source: 'PHONE',
    priority: 'NORMAL',
    deliveryAddress: 'Abdoun, Amman',
    items: [
      {
        productName: String(product.nameEn ?? product.nameAr ?? 'Ottoman'),
        productId: product.id,
        variantId: variant?.id,
        quantity: 1,
        unit: 'pcs',
      },
    ],
  });
  const requestId = idOf(request);
  console.log(`request ${request.number ?? requestId}`);

  await call(sales, 'POST', `/requests/${requestId}/under-review`);
  await call(sales, 'POST', `/requests/${requestId}/ready-for-quotation`);

  const quote = await call(sales, 'POST', '/quotations', {
    customerId,
    requestId,
    paymentTerms: 'Net 30',
    deliveryTerms: 'Showroom delivery',
    lines: [
      {
        description: String(product.nameEn ?? 'Ottoman'),
        productId: product.id,
        variantId: variant?.id,
        quantity: 1,
        unitPrice: 180,
        taxRate: 0.16,
      },
    ],
  });
  const quoteId = idOf(quote);
  console.log(`quotation ${quote.number ?? quoteId}`);
  const offeredDeliveryDate = '2026-10-22';
  await call(sales, 'PATCH', `/quotations/${quoteId}`, { offeredDeliveryDate });
  await call(admin, 'POST', `/quotations/${quoteId}/submit-for-approval`);
  await call(admin, 'POST', `/quotations/${quoteId}/approve`);
  await call(sales, 'POST', `/quotations/${quoteId}/send`);
  const accepted = await call(nile, 'POST', `/quotations/${quoteId}/accept`, { signatureData: 'Nile Interiors' });
  const acceptedOrders = (accepted.salesOrders as Json[] | undefined) ?? [];
  const salesOrderId = String(
    accepted.salesOrderId ??
      (accepted.salesOrder as Json | undefined)?.id ??
      acceptedOrders[0]?.id ??
      '',
  );
  if (!salesOrderId) throw new Error(`accept did not return a sales order: ${JSON.stringify(accepted).slice(0, 400)}`);
  console.log(`sales order ${salesOrderId}`);

  await call(admin, 'POST', `/sales-orders/${salesOrderId}/production-setup/ensure-plan`).catch(() => undefined);
  await call(admin, 'POST', `/sales-orders/${salesOrderId}/production-setup/mark-ready`).catch(() => undefined);
  try {
    const released = await call(admin, 'POST', `/sales-orders/${salesOrderId}/production-setup/release`);
    console.log(`released ${JSON.stringify(released).slice(0, 180)}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (!message.includes('ALREADY_RELEASED')) throw err;
    console.log('production already released');
  }

  const order = await call(admin, 'GET', `/sales-orders/${salesOrderId}`);
  const prisma = new PrismaClient();
  let poId = '';
  try {
    const productionOrder = await prisma.productionOrder.findFirst({
      where: { salesOrderId, archivedAt: null, originType: 'SALES_ORDER' },
      select: { id: true },
    });
    poId = productionOrder?.id ?? '';
    const skills = await prisma.workerSkill.findMany({
      where: { isActive: true },
      select: { userId: true, stageDefinition: { select: { code: true } } },
    });
    const workerFor = new Map<string, string>();
    for (const skill of skills) {
      if (!workerFor.has(skill.stageDefinition.code)) workerFor.set(skill.stageDefinition.code, skill.userId);
    }
    const tasks = await prisma.productionTask.findMany({
      where: { productionOrder: { salesOrderId } },
      orderBy: [{ stageDefinition: { sortOrder: 'asc' } }, { createdAt: 'asc' }],
      select: {
        id: true,
        number: true,
        status: true,
        assignedEmployeeId: true,
        stageDefinition: { select: { code: true } },
      },
    });
    if (!tasks.length || !poId) throw new Error('release did not create production tasks');
    const fallbackWorker = workerFor.get('CARPENTRY') ?? skills[0]?.userId;
    const jitterDays = 200 + Math.floor(Math.random() * 40);
    let day = new Date(Date.now() + jitterDays * 24 * 60 * 60 * 1000);
    for (let hop = 0; hop < 10; hop += 1) {
      const weekday = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Amman', weekday: 'short' }).format(day);
      if (weekday !== 'Fri') break;
      day = new Date(day.getTime() + 24 * 60 * 60 * 1000);
    }
    const ymd = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Amman' }).format(day);
    let cursor = Date.parse(`${ymd}T08:00:00+03:00`);
    const plannedStartDate = ymd;
    for (const task of tasks) {
      if (task.assignedEmployeeId) continue;
      const employeeId = workerFor.get(task.stageDefinition.code) ?? fallbackWorker;
      if (!employeeId) continue;
      const startMs = cursor;
      const endMs = startMs + 20 * 60 * 1000;
      cursor = endMs;
      await call(admin, 'POST', `/tasks/${task.id}/assign`, {
        employeeId,
        plannedStart: new Date(startMs).toISOString(),
        plannedCompletion: new Date(endMs).toISOString(),
      });
    }
    await call(admin, 'POST', `/production-orders/${poId}/start`, { plannedStartDate });
    for (const task of tasks) {
      if (['COMPLETED', 'CANCELLED'].includes(task.status)) continue;
      if (task.stageDefinition.code === 'INSPECTION') {
        const inspection = await call(qc, 'POST', '/quality-inspections', {
          productionOrderId: poId,
          stageCode: 'INSPECTION',
          notes: 'Demo walk pass',
        });
        await call(qc, 'POST', `/quality-inspections/${idOf(inspection)}/submit`, {
          result: 'PASSED',
          notes: 'Ottoman matches the order.',
        });
        console.log(`inspection ${inspection.number ?? idOf(inspection)} passed`);
        continue;
      }
      if (task.status !== 'IN_PROGRESS') {
        await call(admin, 'POST', `/tasks/${task.id}/start`);
      }
      if (task.stageDefinition.code === 'PACKAGING') {
        const res = await fetch(`${API}/api/v1/tasks/${task.id}/complete`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${admin}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ notes: 'Demo walk finish' }),
        });
        const text = await res.text();
        if (!res.ok) {
          const body = JSON.parse(text) as { error?: { code?: string; expected?: string[] } };
          const expected = body.error?.expected?.length ? body.error.expected : ['Package 1'];
          if (body.error?.code !== 'PACKAGES_INCOMPLETE') {
            throw new Error(`POST /tasks/${task.id}/complete → ${res.status} ${text.slice(0, 800)}`);
          }
          await call(admin, 'POST', `/tasks/${task.id}/complete`, {
            notes: 'Demo walk finish',
            confirmedPackageLabels: expected,
          });
        }
      } else {
        await call(admin, 'POST', `/tasks/${task.id}/complete`, { notes: 'Demo walk finish' });
      }
      console.log(`completed task ${task.number} ${task.stageDefinition.code}`);
    }
  } finally {
    await prisma.$disconnect();
  }

  const delivery = await call(admin, 'POST', '/deliveries', {
    customerId,
    salesOrderId,
    deliveryAddress: 'Abdoun, Amman',
    notes: 'Demo walk delivery',
  });
  const deliveryId = idOf(delivery);
  await call(admin, 'PATCH', `/deliveries/${deliveryId}/status`, { status: 'DELIVERED' });
  console.log(`delivery ${delivery.number ?? deliveryId} delivered`);

  const invoice = await call(admin, 'POST', '/invoices', { salesOrderId });
  const invoiceId = idOf(invoice);
  const amount = Number(invoice.outstandingAmount ?? invoice.total ?? 0);
  if (!(amount > 0)) throw new Error(`invoice ${invoice.number ?? invoiceId} has no amount to pay`);
  const payment = await call(admin, 'POST', '/payments', {
    customerId,
    invoiceId,
    amount,
    method: 'BANK_TRANSFER',
    referenceNumber: 'DEMO-WALK',
    notes: 'Demo walk payment',
  });
  console.log(
    `workflow walk passed: order ${order.number ?? salesOrderId}, invoice ${invoice.number ?? invoiceId}, payment ${payment.number ?? idOf(payment)}`,
  );
  process.exit(0);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
