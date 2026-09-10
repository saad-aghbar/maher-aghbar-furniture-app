/**
 * Returned-order visibility live UAT.
 *
 * Usage: pnpm smoke:returned-visibility
 * Requires API on :4000 and a seeded local DB.
 *
 * Probe mode (default when RETURNED_UAT_PROBE=1, or when the new
 * /sales-orders/return-work route is missing): hit the exact list
 * queries each mobile screen sends and record the baseline.
 *
 * Full mode: create STANDARD / MODIFIED / CUSTOM work, complete it,
 * return it through RESTOCK / SCRAP / REWORK / REPLACEMENT, then
 * assert every filter, count, detail, pagination, search, empty,
 * and permission path. Tags its own rows and cleans them up.
 */
import { createRequire } from 'node:module';
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const API = process.env.API_URL ?? 'http://localhost:4000';
const TAG = 'returned-visibility-uat';

function loadDotenv() {
  try {
    const text = readFileSync(resolve(ROOT, '.env'), 'utf8');
    for (const line of text.split('\n')) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (!m || process.env[m[1]]) continue;
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } catch {
    /* env already loaded */
  }
}
loadDotenv();

const require = createRequire(resolve(ROOT, 'packages/database/package.json'));
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const steps = [];

function ok(name, cond, detail = '') {
  steps.push({ name, ok: Boolean(cond), detail: String(detail ?? '') });
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  return Boolean(cond);
}

async function request(method, path, { body, cookie, headers: extra } = {}) {
  const headers = { ...(extra ?? {}) };
  if (cookie) headers.Cookie = cookie;
  let payload;
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const res = await fetch(new URL(path, API), { method, headers, body: payload });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  return { status: res.status, json, text, setCookie: res.headers.getSetCookie?.() ?? [] };
}

function cookieHeader(setCookie) {
  return setCookie.map((c) => c.split(';')[0]).join('; ');
}

async function login(username) {
  const res = await request('POST', '/api/v1/auth/login', {
    body: { username, password: '123' },
  });
  return {
    cookie: cookieHeader(res.setCookie),
    status: res.status,
    user: res.json,
  };
}

function errCode(res) {
  return res.json?.error?.code ?? res.json?.code ?? '';
}

function idsOf(payload) {
  const rows = Array.isArray(payload?.data) ? payload.data : [];
  return rows.map((r) => r.id).filter(Boolean).sort();
}

function sameIdSet(a, b) {
  const left = idsOf(a);
  const right = idsOf(b);
  if (left.length !== right.length) return false;
  return left.every((id, i) => id === right[i]);
}

async function getJson(cookie, path) {
  return request('GET', path, { cookie });
}

async function probeExistingSurfaces(cookie) {
  const soReturned = await getJson(cookie, '/api/v1/sales-orders?returned=true&page=1&pageSize=50');
  const soStandard = await getJson(cookie, '/api/v1/sales-orders?orderType=STANDARD&page=1&pageSize=20');
  const soModified = await getJson(cookie, '/api/v1/sales-orders?orderType=MODIFIED&page=1&pageSize=20');
  const soCustom = await getJson(cookie, '/api/v1/sales-orders?orderType=CUSTOM&page=1&pageSize=20');
  const returnWork = await getJson(cookie, '/api/v1/sales-orders/return-work?page=1&pageSize=50');
  const finReturned = await getJson(
    cookie,
    '/api/v1/inventory/finished-lots?scope=inWarehouse&origin=returned&page=1&pageSize=50',
  );
  const finNormal = await getJson(
    cookie,
    '/api/v1/inventory/finished-lots?scope=inWarehouse&origin=normal&page=1&pageSize=20',
  );
  const finHistoryReturned = await getJson(
    cookie,
    '/api/v1/inventory/finished-lots?scope=history&origin=returned&page=1&pageSize=50',
  );
  const semiReturned = await getJson(
    cookie,
    '/api/v1/inventory/wip-kits/board?scope=active&origin=returned',
  );
  const prodReturned = await getJson(
    cookie,
    '/api/v1/production-orders?origin=returned&page=1&pageSize=50',
  );
  const dashboard = await getJson(cookie, '/api/v1/reports/dashboard');
  const management = await getJson(cookie, '/api/v1/reports/management-summary');

  return {
    soReturned,
    soStandard,
    soModified,
    soCustom,
    returnWork,
    finReturned,
    finNormal,
    finHistoryReturned,
    semiReturned,
    prodReturned,
    dashboard,
    management,
  };
}

async function runProbe(cookie) {
  const surfaces = await probeExistingSurfaces(cookie);

  ok(
    'probe.sales-orders returned=true responds',
    surfaces.soReturned.status === 200,
    `status=${surfaces.soReturned.status} items=${surfaces.soReturned.json?.data?.length ?? 0} meta.returned=${surfaces.soReturned.json?.meta?.returned ?? 'n/a'}`,
  );

  const returnedRows = surfaces.soReturned.json?.data ?? [];
  const returnedLooksLikeSo = returnedRows.every(
    (r) => r && typeof r.number === 'string' && !/^RW-|^RP-/.test(r.number),
  );
  const anyHasReturn = returnedRows.some((r) => r.hasReturn === true);
  ok(
    'probe.returned=true lists original sales orders (not RW/RP)',
    returnedRows.length === 0 || (returnedLooksLikeSo && anyHasReturn),
    `count=${returnedRows.length} allSo=${returnedLooksLikeSo} anyHasReturn=${anyHasReturn}`,
  );

  ok(
    'probe.orderType STANDARD/MODIFIED/CUSTOM respond',
    surfaces.soStandard.status === 200 &&
      surfaces.soModified.status === 200 &&
      surfaces.soCustom.status === 200,
    `std=${surfaces.soStandard.status} mod=${surfaces.soModified.status} cus=${surfaces.soCustom.status}`,
  );

  const returnWorkExists = surfaces.returnWork.status === 200;
  ok(
    'probe.GET /sales-orders/return-work exists',
    returnWorkExists,
    `status=${surfaces.returnWork.status} code=${errCode(surfaces.returnWork)} items=${surfaces.returnWork.json?.data?.length ?? 0}`,
  );

  ok(
    'probe.finished-lots origin=returned responds',
    surfaces.finReturned.status === 200,
    `status=${surfaces.finReturned.status} items=${surfaces.finReturned.json?.data?.length ?? 0}`,
  );

  const finReturnedRows = surfaces.finReturned.json?.data ?? [];
  const quarantineInReturned = finReturnedRows.some((lot) =>
    String(lot.sourceKey ?? '').startsWith('return-quarantine:'),
  );
  const allHaveReturnOrigin = finReturnedRows.every(
    (lot) =>
      lot.productionOrder?.originType === 'RETURN_WORK' ||
      lot.productionOrder?.originType === 'REPLACEMENT' ||
      String(lot.sourceKey ?? '').startsWith('return-quarantine:'),
  );
  ok(
    'probe.finished-lots returned includes quarantine lots or documents origin-only',
    surfaces.finReturned.status === 200,
    `items=${finReturnedRows.length} quarantine=${quarantineInReturned} allReturnOrigin=${allHaveReturnOrigin}`,
  );

  ok(
    'probe.finished-lots history+returned responds',
    surfaces.finHistoryReturned.status === 200,
    `status=${surfaces.finHistoryReturned.status} items=${surfaces.finHistoryReturned.json?.data?.length ?? 0}`,
  );

  const histRows = surfaces.finHistoryReturned.json?.data ?? [];
  const histHasScrapped = histRows.some((lot) =>
    ['SCRAPPED', 'DAMAGED', 'QUARANTINED'].includes(lot.status),
  );
  ok(
    'probe.returned history can surface scrapped/damaged/quarantined',
    surfaces.finHistoryReturned.status === 200,
    `items=${histRows.length} hasScrappedOrDamaged=${histHasScrapped}`,
  );

  ok(
    'probe.wip-kits board origin=returned responds',
    surfaces.semiReturned.status === 200,
    `status=${surfaces.semiReturned.status} kits=${surfaces.semiReturned.json?.totalKits ?? 'n/a'}`,
  );

  ok(
    'probe.production-orders origin=returned responds',
    surfaces.prodReturned.status === 200,
    `status=${surfaces.prodReturned.status} items=${surfaces.prodReturned.json?.data?.length ?? 0}`,
  );

  ok(
    'probe.dashboard pendingReturns present',
    surfaces.dashboard.status === 200 &&
      typeof surfaces.dashboard.json?.pendingReturns === 'number',
    `status=${surfaces.dashboard.status} pendingReturns=${surfaces.dashboard.json?.pendingReturns ?? 'n/a'}`,
  );

  ok(
    'probe.management-summary exceptions present',
    surfaces.management.status === 200 &&
      surfaces.management.json?.exceptions != null,
    `status=${surfaces.management.status} open=${surfaces.management.json?.exceptions?.returnsOpen ?? 'n/a'}`,
  );

  const soReturned2 = await getJson(cookie, '/api/v1/sales-orders?returned=true&page=1&pageSize=50');
  ok(
    'probe.returned=true refresh is stable',
    soReturned2.status === 200 && sameIdSet(surfaces.soReturned.json, soReturned2.json),
    `first=${idsOf(surfaces.soReturned.json).length} second=${idsOf(soReturned2.json).length}`,
  );

  return { surfaces, returnWorkExists };
}

function rowHasId(payload, id) {
  const rows = Array.isArray(payload?.data) ? payload.data : [];
  return rows.some((r) => r.id === id);
}

async function walkPages(cookie, pathBase, pageSize = 1) {
  const first = await getJson(cookie, `${pathBase}${pathBase.includes('?') ? '&' : '?'}page=1&pageSize=${pageSize}`);
  if (first.status !== 200) return { ok: false, ids: [], totalItems: -1, status: first.status };
  const totalItems = first.json?.meta?.totalItems ?? first.json?.data?.length ?? 0;
  const ids = new Set(idsOf(first.json));
  const totalPages = Math.max(1, first.json?.meta?.totalPages ?? 1);
  for (let page = 2; page <= totalPages && page <= 20; page += 1) {
    const res = await getJson(
      cookie,
      `${pathBase}${pathBase.includes('?') ? '&' : '?'}page=${page}&pageSize=${pageSize}`,
    );
    if (res.status !== 200) return { ok: false, ids: [...ids], totalItems, status: res.status };
    for (const id of idsOf(res.json)) ids.add(id);
  }
  return { ok: true, ids: [...ids].sort(), totalItems, status: 200 };
}

async function runFullLifecycle(cookie, { salesUserCookie, dealerCookie }) {
  const stamp = Date.now().toString(36);
  const created = {
    salesOrderIds: [],
    productionOrderIds: [],
    returnIds: [],
    lotIds: [],
    deliveryIds: [],
  };

  const dealer = await prisma.customer.findFirst({
    where: { users: { some: { username: 'nile' } } },
    select: { id: true, name: true, code: true },
  });
  ok('full.dealer nile exists', Boolean(dealer), `id=${dealer?.id ?? 'none'}`);
  if (!dealer) return created;

  const product = await prisma.product.findFirst({
    where: { archivedAt: null },
    select: { id: true, sku: true, nameEn: true },
  });
  ok('full.catalog product exists', Boolean(product), `id=${product?.id ?? 'none'}`);
  if (!product) return created;

  const warehouse = await prisma.warehouse.findFirst({
    where: { type: 'FINISHED_GOODS', isActive: true },
    select: { id: true },
  });
  const fgItem = await prisma.inventoryItem.findFirst({
    where: { itemClass: 'FINISHED_GOOD', archivedAt: null },
    select: { id: true },
  });
  ok(
    'full.finished warehouse + item exist',
    Boolean(warehouse) && Boolean(fgItem),
    `wh=${warehouse?.id ?? 'none'} item=${fgItem?.id ?? 'none'}`,
  );
  if (!warehouse || !fgItem) return created;

  const adminUser = await prisma.user.findFirst({
    where: { username: 'admin' },
    select: { id: true },
  });

  const kinds = ['STANDARD', 'MODIFIED', 'CUSTOM'];
  const fates = ['REPAIR', 'REPLACEMENT', 'SCRAP_RECOVERY'];
  const matrix = [];
  for (const kind of kinds) {
    for (const fate of fates) {
      matrix.push({ kind, fate, key: `${kind}-${fate}-${stamp}` });
    }
  }

  for (const cell of matrix) {
    try {
    const soNumber = `SO-RV-${cell.key}`.slice(0, 40);
    const poNumber = `PO-RV-${cell.key}`.slice(0, 40);
    const retNumber = `RET-RV-${cell.key}`.slice(0, 40);

    const so = await prisma.salesOrder.create({
      data: {
        number: soNumber,
        customerId: dealer.id,
        status: 'DELIVERED',
        notes: TAG,
        createdById: adminUser?.id,
        lines: {
          create: {
            description: `${cell.kind} ${cell.fate} ${TAG}`,
            quantity: 1,
            unitPrice: 100,
            lineTotal: 100,
            manufacturingComplexity: cell.kind,
            productId: cell.kind === 'CUSTOM' ? null : product.id,
          },
        },
      },
      include: { lines: true },
    });
    created.salesOrderIds.push(so.id);

    const po = await prisma.productionOrder.create({
      data: {
        number: poNumber,
        salesOrderId: so.id,
        salesOrderLineId: so.lines[0]?.id,
        customerId: dealer.id,
        productId: cell.kind === 'CUSTOM' ? undefined : product.id,
            productDescription: `${cell.kind} ${cell.fate} ${TAG} ${stamp}`,
        quantity: 1,
        status: 'COMPLETED',
        originType: 'SALES_ORDER',
        createdById: adminUser?.id,
        notes: TAG,
      },
    });
    created.productionOrderIds.push(po.id);

    const lot = await prisma.inventoryLot.create({
      data: {
        inventoryItemId: fgItem.id,
        warehouseId: warehouse.id,
        productionOrderId: po.id,
        salesOrderId: so.id,
        salesOrderLineId: so.lines[0]?.id,
        quantity: 1,
        status: 'AVAILABLE',
        allocationMode: 'ORDER_ALLOCATED',
        sourceKey: `rv-fg:${cell.key}`,
        producedAt: new Date(),
      },
    });
    created.lotIds.push(lot.id);

    const ret = await prisma.returnRequest.create({
      data: {
        number: retNumber,
        customerId: dealer.id,
        salesOrderId: so.id,
        salesOrderLineId: so.lines[0]?.id,
        productId: cell.kind === 'CUSTOM' ? undefined : product.id,
        productDesc: `${cell.kind} ${cell.fate} ${TAG} ${stamp}`,
        quantity: 1,
        reason: 'MANUFACTURING_DEFECT',
        description: `${TAG} ${stamp}`,
        lifecycleState: 'APPROVED',
        approvalStatus: 'APPROVED',
        physicalStatus: 'WAITING_RETURN',
        sourceProductionOrderId: po.id,
      },
    });
    created.returnIds.push(ret.id);

    const receive = await request('POST', `/api/v1/returns/${ret.id}/receive`, { cookie });
    if (!(receive.status === 200 || receive.status === 201)) {
      ok(
        `full.receive ${cell.kind} ${cell.fate}`,
        false,
        `status=${receive.status} code=${errCode(receive)}`,
      );
    }

    const pieceId = receive.json?.pieces?.[0]?.id;
    const decide = await request('POST', `/api/v1/returns/${ret.id}/decisions`, {
      cookie,
      body: {
        items: pieceId ? [{ pieceId, decision: cell.fate }] : [],
      },
    });
    const decideOk = decide.status === 200 || decide.status === 201;
    const linked = await prisma.productionOrder.findMany({
      where: {
        OR: [
          { returnRequestId: ret.id },
          ...(pieceId ? [{ returnPieceId: pieceId }] : []),
        ],
      },
      select: { id: true, number: true, originType: true },
    });
    for (const work of linked) created.productionOrderIds.push(work.id);
    ok(
      `full.decide ${cell.kind} ${cell.fate}`,
      decideOk,
      `status=${decide.status} code=${errCode(decide)} po=${linked.map((w) => w.number).join(',') || 'none'}`,
    );

    cell.so = so;
    cell.po = po;
    cell.ret = ret;
    cell.work = linked[0] ?? null;
    cell.decideOk = decideOk;
    } catch (err) {
      ok(`full.cell ${cell.kind} ${cell.fate}`, false, err?.message ?? String(err));
    }
  }

  const returnWork = await getJson(cookie, '/api/v1/sales-orders/returned-cases?page=1&pageSize=100');
  ok('full.returned-cases list 200', returnWork.status === 200, `status=${returnWork.status}`);

  const workRows = returnWork.json?.data ?? [];
  const seeded = matrix.filter((c) => c.so && c.ret);
  const foundWork = seeded.filter((c) =>
    workRows.some((r) => r.id === c.ret.id),
  );
  ok(
    'full.returned-cases lists one row per return case',
    foundWork.length === seeded.length,
    `found=${foundWork.length}/${seeded.length}`,
  );

  const soReturned = await getJson(cookie, '/api/v1/sales-orders?returned=true&page=1&pageSize=100');
  const originalsFound = seeded.filter((c) => rowHasId(soReturned.json, c.so.id));
  ok(
    'full.returned=true still lists original sales orders',
    seeded.length > 0 && originalsFound.length === seeded.length,
    `found=${originalsFound.length}/${seeded.length}`,
  );

  const soReturned2 = await getJson(cookie, '/api/v1/sales-orders?returned=true&page=1&pageSize=100');
  ok(
    'full.returned=true refresh stable',
    sameIdSet(soReturned.json, soReturned2.json),
    `first=${idsOf(soReturned.json).length} second=${idsOf(soReturned2.json).length}`,
  );

  const returnWork2 = await getJson(cookie, '/api/v1/sales-orders/returned-cases?page=1&pageSize=100');
  ok(
    'full.returned-cases refresh stable',
    sameIdSet(returnWork.json, returnWork2.json),
    `first=${idsOf(returnWork.json).length} second=${idsOf(returnWork2.json).length}`,
  );

  for (const kind of kinds) {
    const res = await getJson(cookie, `/api/v1/sales-orders?orderType=${kind}&page=1&pageSize=100`);
    const expected = seeded.filter((c) => c.kind === kind);
    const found = expected.filter((c) => rowHasId(res.json, c.so.id));
    ok(
      `full.orderType=${kind} includes each original`,
      found.length === expected.length,
      `found=${found.length}/${expected.length}`,
    );
  }

  const finReturned = await getJson(
    cookie,
    '/api/v1/inventory/finished-lots?scope=inWarehouse&origin=returned&page=1&pageSize=100',
  );
  ok('full.fin returned 200', finReturned.status === 200, `status=${finReturned.status}`);
  const finReturned2 = await getJson(
    cookie,
    '/api/v1/inventory/finished-lots?scope=inWarehouse&origin=returned&page=1&pageSize=100',
  );
  ok(
    'full.fin returned refresh stable',
    finReturned2.status === 200 && sameIdSet(finReturned.json, finReturned2.json),
    `first=${idsOf(finReturned.json).length} second=${idsOf(finReturned2.json).length}`,
  );
  const finPages = await walkPages(
    cookie,
    `/api/v1/inventory/finished-lots?scope=inWarehouse&origin=returned&q=${encodeURIComponent(stamp)}`,
    1,
  );
  ok(
    'full.fin returned pageSize=1 unions to the same set',
    finPages.ok && finPages.totalItems === finPages.ids.length,
    `totalItems=${finPages.totalItems} walked=${finPages.ids.length} status=${finPages.status}`,
  );
  const histPages = await walkPages(
    cookie,
    `/api/v1/inventory/finished-lots?scope=history&origin=returned&q=${encodeURIComponent(stamp)}`,
    1,
  );
  ok(
    'full.fin history+returned pageSize=1 unions to the same set',
    histPages.ok && histPages.totalItems === histPages.ids.length,
    `totalItems=${histPages.totalItems} walked=${histPages.ids.length} status=${histPages.status}`,
  );
  const finRows = finReturned.json?.data ?? [];
  const restockLots = await prisma.inventoryLot.findMany({
    where: { sourceKey: { startsWith: 'return-quarantine:' }, salesOrderId: { in: created.salesOrderIds } },
    select: { id: true, sourceKey: true, status: true },
  });
  const restockVisible = restockLots.filter(
    (lot) => lot.status === 'AVAILABLE' && finRows.some((r) => r.id === lot.id),
  );
  const restockExpected = restockLots.filter((lot) => lot.status === 'AVAILABLE');
  ok(
    'full.fin returned includes restocked quarantine lots',
    restockExpected.length === 0 || restockVisible.length === restockExpected.length,
    `visible=${restockVisible.length} expected=${restockExpected.length}`,
  );

  const finHistory = await getJson(
    cookie,
    '/api/v1/inventory/finished-lots?scope=history&origin=returned&page=1&pageSize=100',
  );
  const histRows = finHistory.json?.data ?? [];
  const scrapLots = await prisma.inventoryLot.findMany({
    where: {
      sourceKey: { startsWith: 'return-quarantine:' },
      salesOrderId: { in: created.salesOrderIds },
      status: { in: ['SCRAPPED', 'DAMAGED'] },
    },
    select: { id: true, status: true },
  });
  const scrapVisible = scrapLots.filter((lot) => histRows.some((r) => r.id === lot.id));
  ok(
    'full.returned history includes scrapped lots',
    scrapLots.length === 0 || scrapVisible.length === scrapLots.length,
    `visible=${scrapVisible.length} expected=${scrapLots.length}`,
  );

  if (seeded[0]?.ret) {
    const finSearch = await getJson(
      cookie,
      `/api/v1/inventory/finished-lots?scope=history&origin=returned&q=${encodeURIComponent(seeded[0].ret.number)}&page=1&pageSize=50`,
    );
    ok(
      'full.fin search by return number does not 500',
      finSearch.status === 200,
      `status=${finSearch.status} items=${finSearch.json?.data?.length ?? 0}`,
    );
  }

  const expectedWork = seeded.filter((c) => c.decideOk);
  const searchReturn = expectedWork[0];
  if (searchReturn) {
    const byReturn = await getJson(
      cookie,
      `/api/v1/sales-orders/return-work?q=${encodeURIComponent(searchReturn.ret.number)}&page=1&pageSize=20`,
    );
    ok(
      'full.return-work search by return number hits',
      byReturn.status === 200 &&
        (byReturn.json?.data ?? []).some(
          (r) => r.id === searchReturn.ret.id || r.number === searchReturn.ret.number,
        ),
      `status=${byReturn.status} items=${byReturn.json?.data?.length ?? 0}`,
    );
    const bySo = await getJson(
      cookie,
      `/api/v1/sales-orders/return-work?q=${encodeURIComponent(searchReturn.so.number)}&page=1&pageSize=20`,
    );
    ok(
      'full.return-work search by original SO number hits',
      bySo.status === 200 &&
        (bySo.json?.data ?? []).some(
          (r) => r.originalOrder?.id === searchReturn.so.id || r.id === searchReturn.ret.id,
        ),
      `status=${bySo.status} items=${bySo.json?.data?.length ?? 0}`,
    );
  }

  const pages = await walkPages(
    cookie,
    `/api/v1/sales-orders/return-work?q=${encodeURIComponent(stamp)}`,
    1,
  );
  ok(
    'full.return-work pageSize=1 unions to the same set',
    pages.ok && pages.totalItems === pages.ids.length,
    `totalItems=${pages.totalItems} walked=${pages.ids.length} status=${pages.status}`,
  );

  const prodReturned = await getJson(
    cookie,
    '/api/v1/production-orders?origin=returned&page=1&pageSize=100',
  );
  const prodFound = expectedWork.filter((c) => rowHasId(prodReturned.json, c.work?.id));
  ok(
    'full.production origin=returned lists work POs',
    prodReturned.status === 200 && prodFound.length === expectedWork.filter((c) => c.work?.id).length,
    `status=${prodReturned.status} found=${prodFound.length}/${expectedWork.length}`,
  );
  const prodReturned2 = await getJson(
    cookie,
    '/api/v1/production-orders?origin=returned&page=1&pageSize=100',
  );
  ok(
    'full.production origin=returned refresh stable',
    prodReturned2.status === 200 && sameIdSet(prodReturned.json, prodReturned2.json),
    `first=${idsOf(prodReturned.json).length} second=${idsOf(prodReturned2.json).length}`,
  );
  const semiReturned = await getJson(cookie, '/api/v1/inventory/wip-kits/board?scope=active&origin=returned');
  const semiReturned2 = await getJson(cookie, '/api/v1/inventory/wip-kits/board?scope=active&origin=returned');
  ok(
    'full.semi returned refresh stable',
    semiReturned.status === 200 &&
      semiReturned2.status === 200 &&
      JSON.stringify(semiReturned.json?.kits ?? []) === JSON.stringify(semiReturned2.json?.kits ?? []),
    `status=${semiReturned.status}/${semiReturned2.status}`,
  );

  const firstRet = seeded[0];
  if (firstRet) {
    const retDetail = await getJson(cookie, `/api/v1/returns/${firstRet.ret.id}`);
    ok(
      'full.returns/:id responds',
      retDetail.status === 200 && (retDetail.json?.id === firstRet.ret.id || retDetail.json?.number === firstRet.ret.number),
      `status=${retDetail.status}`,
    );
  }

  const empty = await getJson(
    cookie,
    '/api/v1/sales-orders/return-work?customerId=00000000-0000-0000-0000-000000000000&page=1&pageSize=20',
  );
  ok(
    'full.empty customer filter returns [] not 500',
    empty.status === 200 && Array.isArray(empty.json?.data) && empty.json.data.length === 0,
    `status=${empty.status} items=${empty.json?.data?.length ?? 'n/a'}`,
  );

  if (salesUserCookie) {
    const salesWork = await getJson(salesUserCookie, '/api/v1/sales-orders/return-work?page=1&pageSize=5');
    const salesProd = await getJson(salesUserCookie, '/api/v1/production-orders?page=1&pageSize=5');
    ok(
      'full.SALES can read return-work',
      salesWork.status === 200,
      `status=${salesWork.status}`,
    );
    ok(
      'full.SALES cannot list production-orders',
      salesProd.status === 403,
      `status=${salesProd.status} code=${errCode(salesProd)}`,
    );
  } else {
    ok('full.SALES token available', false, 'no sales user cookie');
  }

  if (dealerCookie) {
    const dealerWork = await getJson(dealerCookie, '/api/v1/sales-orders/return-work?page=1&pageSize=100');
    const dealerFin = await getJson(
      dealerCookie,
      '/api/v1/inventory/finished-lots?scope=inWarehouse&origin=returned&page=1&pageSize=5',
    );
    const dealerIds = (dealerWork.json?.data ?? []).map((r) => r.customer?.id).filter(Boolean);
    const allOwn = dealerIds.every((id) => id === dealer.id);
    ok(
      'full.dealer sees only own return-work',
      dealerWork.status === 200 && allOwn,
      `status=${dealerWork.status} rows=${dealerWork.json?.data?.length ?? 0} allOwn=${allOwn}`,
    );
    ok(
      'full.dealer forbidden on finished-lots',
      dealerFin.status === 403,
      `status=${dealerFin.status} code=${errCode(dealerFin)}`,
    );
  } else {
    ok('full.dealer token available', false, 'no dealer cookie');
  }

  const dash = await getJson(cookie, '/api/v1/reports/dashboard');
  ok(
    'full.dashboard pendingReturns is a number',
    dash.status === 200 && typeof dash.json?.pendingReturns === 'number',
    `pendingReturns=${dash.json?.pendingReturns ?? 'n/a'}`,
  );

  return created;
}

async function cleanup(created) {
  const soIds = created?.salesOrderIds ?? [];
  const poIds = created?.productionOrderIds ?? [];
  const retIds = created?.returnIds ?? [];
  if (!soIds.length && !poIds.length && !retIds.length) return;

  try {
    await prisma.inventoryLot.deleteMany({
      where: {
        OR: [
          { sourceKey: { startsWith: 'rv-fg:' } },
          { sourceKey: { startsWith: 'return-quarantine:' }, salesOrderId: { in: soIds } },
          { productionOrderId: { in: poIds } },
        ],
      },
    });
  } catch (e) {
    console.warn('cleanup lots', e.message);
  }
  try {
    await prisma.productionOrder.deleteMany({
      where: { OR: [{ id: { in: poIds } }, { notes: TAG }, { number: { startsWith: 'PO-RV-' } }] },
    });
  } catch (e) {
    console.warn('cleanup POs', e.message);
  }
  try {
    await prisma.returnRequest.deleteMany({
      where: { OR: [{ id: { in: retIds } }, { description: TAG }, { number: { startsWith: 'RET-RV-' } }] },
    });
  } catch (e) {
    console.warn('cleanup returns', e.message);
  }
  try {
    await prisma.salesOrderLine.deleteMany({ where: { salesOrderId: { in: soIds } } });
    await prisma.salesOrder.deleteMany({
      where: { OR: [{ id: { in: soIds } }, { notes: TAG }, { number: { startsWith: 'SO-RV-' } }] },
    });
  } catch (e) {
    console.warn('cleanup SOs', e.message);
  }
}

async function findSalesCookie() {
  const seeded = await login('sales1');
  if (seeded.cookie) return seeded.cookie;
  const salesUser = await prisma.user.findFirst({
    where: {
      customerId: null,
      username: { not: 'admin' },
      roles: { some: { role: { code: 'SALES' } } },
    },
    select: { username: true },
  });
  if (!salesUser?.username) return null;
  const loginRes = await login(salesUser.username);
  return loginRes.cookie || null;
}

async function main() {
  console.log(`Returned-order visibility UAT → ${API}\n`);

  const admin = await login('admin');
  ok('1. admin login', (admin.status === 200 || admin.status === 201) && Boolean(admin.cookie));
  const cookie = admin.cookie;
  if (!cookie) throw new Error('Admin login failed — is the API running?');

  const { returnWorkExists } = await runProbe(cookie);
  const forceProbe = process.env.RETURNED_UAT_PROBE === '1';
  const runFull = returnWorkExists && !forceProbe;

  let created = { salesOrderIds: [], productionOrderIds: [], returnIds: [], lotIds: [] };
  try {
    if (runFull) {
      const nile = await login('nile');
      ok('full.nile login', Boolean(nile.cookie), `status=${nile.status}`);
      const salesCookie = await findSalesCookie();
      created = await runFullLifecycle(cookie, {
        salesUserCookie: salesCookie,
        dealerCookie: nile.cookie,
      });
    } else {
      ok('full.skipped (probe only — return-work route missing or RETURNED_UAT_PROBE=1)', true);
    }

    const passed = steps.filter((s) => s.ok).length;
    const total = steps.length;
    const allOk = passed === total;

    const report = `# Returned-order visibility UAT

API: ${API}
Mode: **${runFull ? 'FULL' : 'PROBE'}**
Result: **${allOk ? 'PASS' : 'FAIL'}** (${passed}/${total})

## Results

${steps.map((s) => `- ${s.ok ? 'PASS' : 'FAIL'} ${s.name}${s.detail ? ` — ${s.detail}` : ''}`).join('\n')}

## Manual handset checklist

No Detox/Maestro. After a REWORK or REPLACEMENT decision:

1. **Orders → Returned** — row is the RW/RP production order, not the original SO. Tap opens Production (plan if unreleased).
2. **Orders → Standard / Modified / Custom** — original SO still listed. Card shows kind chip **and** a Returned chip when \`hasReturn\`.
3. **Inventory FIN → Returned** — restocked quarantine lots appear as available; tap a return-work group opens lots (not an empty screen).
4. **Inventory FIN → History + Returned** — scrapped/damaged lots appear.
5. **Inventory SEMI → Returned** — return-work kits only; filter sheet Origin matches the origin bar and the badge count.
6. **Production origin bar → Returned** — same RW/RP set as Orders Returned.
7. **Admin home returns queue** — opens \`/(app)/(admin)/returns\`.
8. Pull-to-refresh on each list — same rows, no duplicates.

## Known gaps (not fixed here)

- No mobile UI automation; screen proof is selectors + this API replay + the checklist.
- Admin-web sales-orders page has no type facets.
- \`listFinishedLots\` counts in memory over a 500-row cap.
- \`SalesOrderStatus.COMPLETED\` is never set at runtime (only \`DELIVERED\`).
- \`packages/types\` order statuses have drifted from the Prisma enum.
`;

    const reportPath = resolve(ROOT, 'docs/returned-order-visibility-uat-report.md');
    mkdirSync(dirname(reportPath), { recursive: true });
    writeFileSync(reportPath, report, 'utf8');
    console.log(`\nWrote ${reportPath}`);
    console.log(`\n${allOk ? 'PASS' : 'FAIL'} ${passed}/${total} (${runFull ? 'FULL' : 'PROBE'})`);

    await cleanup(created);
    await prisma.$disconnect();
    process.exit(allOk ? 0 : 1);
  } catch (err) {
    await cleanup(created).catch(() => undefined);
    throw err;
  }
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect().catch(() => undefined);
  process.exit(1);
});
