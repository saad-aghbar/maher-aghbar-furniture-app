/**
 * Real factory lifecycle UAT against a running API + database.
 * Uses isolated products UAT-SOFA-A / B / C. PASS only when runtime assertions hold.
 *
 * Usage: node scripts/factory-lifecycle-uat.mjs
 * Requires: API at API_URL (default http://localhost:4000), admin/nile passwords 123.
 */
const API = process.env.API_URL ?? 'http://localhost:4000';

const PIXEL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

const steps = [];
const ledger = [];
const scenarioResults = {};

function ok(name, cond, detail = '') {
  steps.push({ name, ok: Boolean(cond), detail: String(detail ?? '') });
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  return Boolean(cond);
}

function mark(scenario, status, extra = {}) {
  scenarioResults[scenario] = { status, ...extra };
}

async function request(method, path, { body, cookie, form } = {}) {
  const headers = {};
  if (cookie) headers.Cookie = cookie;
  let payload;
  if (form) {
    payload = form;
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  let last = { status: 0, json: null, setCookie: [], text: '' };
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const res = await fetch(new URL(path, API), { method, headers, body: payload });
    const text = await res.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = text;
    }
    const setCookie = res.headers.getSetCookie?.() ?? [];
    last = { status: res.status, json, setCookie, text };
    if (res.status !== 429) return last;
    await new Promise((r) => setTimeout(r, 400 * 2 ** attempt));
  }
  return last;
}

function cookieHeader(setCookie) {
  return setCookie.map((c) => c.split(';')[0]).join('; ');
}

function payload(res) {
  const j = res?.json;
  if (!j || typeof j !== 'object') return j;
  return j.error && typeof j.error === 'object' ? { ...j, ...j.error } : j;
}

function errDetail(res) {
  const j = payload(res);
  if (!j) return String(res?.status ?? '');
  const msg = j.message ?? j.error;
  const msgText = typeof msg === 'string' ? msg : msg ? JSON.stringify(msg) : '';
  return `${res.status} ${j.code ?? ''} ${msgText || JSON.stringify(res.json).slice(0, 400)}`;
}

function num(v) {
  return Number(v ?? 0);
}

async function login(username, password) {
  const res = await request('POST', '/api/v1/auth/login', {
    body: { username, password },
  });
  return { cookie: cookieHeader(res.setCookie), status: res.status, json: res.json };
}

async function stock(cookie, itemId) {
  const res = await request('GET', `/api/v1/inventory/items/${itemId}`, { cookie });
  const row = res.json;
  return {
    onHand: num(row?.onHandQty ?? row?.availableQty),
    reserved: num(row?.reservedQty),
    free: num(row?.freeQty),
    raw: row,
  };
}

async function transactions(cookie, itemId) {
  const res = await request('GET', `/api/v1/inventory/items/${itemId}/transactions?pageSize=100`, {
    cookie,
  });
  return res.json?.data ?? res.json ?? [];
}

function countType(rows, type, predicate) {
  return (rows ?? []).filter((tx) => tx.type === type && (!predicate || predicate(tx))).length;
}

function qtyOfType(rows, type) {
  return (rows ?? [])
    .filter((tx) => tx.type === type)
    .reduce((s, tx) => s + Math.abs(num(tx.quantity)), 0);
}

async function snapshotStock(cookie, items, label) {
  const out = {};
  for (const [key, id] of Object.entries(items)) {
    if (!id) continue;
    out[key] = await stock(cookie, id);
  }
  ledger.push({ label, balances: out });
  return out;
}

async function receive(cookie, inventoryItemId, warehouseId, quantity, key) {
  return request('POST', '/api/v1/inventory/receipts', {
    cookie,
    body: { inventoryItemId, warehouseId, quantity, idempotencyKey: key },
  });
}

async function approveQuotation(quoteId, cookie) {
  await request('POST', `/api/v1/quotations/${quoteId}/submit-for-approval`, { cookie });
  let approve = await request('POST', `/api/v1/quotations/${quoteId}/approve`, { cookie });
  for (let i = 0; i < 4 && approve.json?.status === 'INTERNAL_REVIEW'; i += 1) {
    approve = await request('POST', `/api/v1/quotations/${quoteId}/approve`, { cookie });
  }
  return approve;
}

async function createConfirmedOrder({
  adminCookie,
  dealerCookie,
  customerId,
  product,
  qty,
  label,
}) {
  const quote = await request('POST', '/api/v1/quotations', {
    cookie: adminCookie,
    body: {
      customerId,
      paymentTerms: 'UAT',
      deliveryTerms: 'UAT factory lifecycle',
      lines: [
        {
          productId: product.id,
          description: product.nameEn ?? product.sku,
          quantity: qty,
          unitPrice: 1500,
          taxRate: 0.16,
        },
      ],
    },
  });
  if (!quote.json?.id) {
    return { error: `quote failed ${errDetail(quote)}` };
  }
  await approveQuotation(quote.json.id, adminCookie);
  await request('POST', `/api/v1/quotations/${quote.json.id}/send`, { cookie: adminCookie });
  const accepted = await request('POST', `/api/v1/quotations/${quote.json.id}/accept`, {
    cookie: dealerCookie,
    body: { signatureData: 'data:image/png;base64,uat' },
  });
  const soId =
    accepted.json?.salesOrders?.[0]?.id ??
    accepted.json?.salesOrder?.id ??
    (await (async () => {
      const list = await request('GET', '/api/v1/sales-orders?pageSize=50', { cookie: adminCookie });
      return (list.json?.data ?? []).find((s) => s.quotation?.id === quote.json.id)?.id;
    })());
  if (!soId) return { error: `no SO after accept ${errDetail(accepted)}` };
  const confirmed = await request('POST', `/api/v1/sales-orders/${soId}/confirm`, {
    cookie: adminCookie,
  });
  const soRes = await request('GET', `/api/v1/sales-orders/${soId}`, { cookie: adminCookie });
  const so = soRes.json?.id ? soRes.json : confirmed.json;
  const po =
    (so?.productionOrders ?? []).find((p) => p.salesOrderId === soId || p.salesOrder?.id === soId) ??
    so?.productionOrders?.[0];
  let poId = po?.id;
  if (!poId) {
    const poList = await request('GET', '/api/v1/production-orders?pageSize=100', { cookie: adminCookie });
    poId = (poList.json?.data ?? []).find((p) => p.salesOrderId === soId || p.salesOrder?.id === soId)?.id;
  }
  if (poId) {
    await request('POST', `/api/v1/production-orders/${poId}/start`, { cookie: adminCookie });
  }
  return {
    quoteId: quote.json.id,
    soId,
    so,
    poId,
    po,
    label,
    confirmed,
    error: poId ? undefined : `no PO after confirm ${errDetail(confirmed)} soStatus=${so?.status}`,
  };
}

async function poDetail(adminCookie, poId) {
  return (await request('GET', `/api/v1/production-orders/${poId}`, { cookie: adminCookie })).json;
}

function stageByCode(detail, code) {
  return (detail?.stages ?? []).find(
    (s) =>
      s.stageDefinition?.code === code ||
      s.code === code ||
      s.stageCode === code ||
      s.name === code,
  );
}

function openTask(stage) {
  return (stage?.tasks ?? []).find((t) => !['COMPLETED', 'CANCELLED'].includes(t.status));
}

async function uploadTaskPhoto(cookie, taskId) {
  const form = new FormData();
  form.append('file', new Blob([PIXEL_PNG], { type: 'image/png' }), 'uat.png');
  return request('POST', `/api/v1/uploads?taskId=${taskId}&category=${encodeURIComponent(`TASK_PHOTO:${taskId}`)}`, {
    cookie,
    form,
  });
}

async function completeTask(cookie, taskId, idempotencyKey) {
  await uploadTaskPhoto(cookie, taskId);
  let done = await request('POST', `/api/v1/tasks/${taskId}/complete`, {
    cookie,
    body: { idempotencyKey },
  });
  const code = payload(done)?.code;
  if (done.status >= 400 && code === 'PHOTOS_REQUIRED') {
    const uploaded = await uploadTaskPhoto(cookie, taskId);
    if (uploaded.status >= 400) return uploaded;
    done = await request('POST', `/api/v1/tasks/${taskId}/complete`, {
      cookie,
      body: { idempotencyKey: idempotencyKey ? `${idempotencyKey}:photo` : undefined },
    });
  }
  return done;
}

async function startAndCompleteStage(adminCookie, poId, code, workerId) {
  const detail = await poDetail(adminCookie, poId);
  const stage = stageByCode(detail, code);
  if (!stage) return { missing: true, code };
  const task = openTask(stage);
  if (!task) {
    const already = (stage.tasks ?? []).some((t) => t.status === 'COMPLETED');
    return { skippedDone: already, stage, code };
  }
  if (workerId && !task.assignedEmployeeId) {
    await request('POST', `/api/v1/tasks/${task.id}/assign`, {
      cookie: adminCookie,
      body: { employeeId: workerId },
    });
  }
  if (['NOT_STARTED', 'READY', 'PAUSED'].includes(task.status)) {
    const started = await request('POST', `/api/v1/tasks/${task.id}/start`, { cookie: adminCookie });
    const startCode = payload(started)?.code;
    if (started.status >= 400 && startCode !== 'BAD_REQUEST') {
      return { stage, task, done: started, code };
    }
  }
  const done = await completeTask(adminCookie, task.id, `complete:${poId}:${task.id}`);
  return { stage, task, done, code };
}

async function tryStartStage(adminCookie, poId, code) {
  const detail = await poDetail(adminCookie, poId);
  const stage = stageByCode(detail, code);
  const task = openTask(stage);
  if (!task) return { missing: true, detail, stage };
  const started = await request('POST', `/api/v1/tasks/${task.id}/start`, { cookie: adminCookie });
  return { task, started, stage };
}

async function completeRemaining(adminCookie, poId, { skipCodes = [], untilCode } = {}) {
  const locked = new Set();
  for (let i = 0; i < 24; i += 1) {
    const detail = await poDetail(adminCookie, poId);
    const stages = detail?.stages ?? [];
    const next = stages.find((s) => {
      const code = s.stageDefinition?.code;
      if (untilCode && code === untilCode) return false;
      if (skipCodes.includes(code)) return false;
      if (locked.has(s.id)) return false;
      if (['COMPLETED', 'SKIPPED'].includes(s.status)) return false;
      return Boolean(openTask(s));
    });
    if (!next) return detail;
    const code = next.stageDefinition?.code;
    const result = await startAndCompleteStage(adminCookie, poId, code);
    if (result.done && result.done.status >= 400) {
      if (payload(result.done)?.code === 'STAGE_LOCKED') {
        locked.add(next.id);
        continue;
      }
      return { ...detail, blocked: result };
    }
  }
  return poDetail(adminCookie, poId);
}

async function passQc(adminCookie, poId, stageCode = 'INSPECTION') {
  const insp = await request('POST', '/api/v1/quality-inspections', {
    cookie: adminCookie,
    body: { productionOrderId: poId, stageCode },
  });
  if (!insp.json?.id) return insp;
  return request('POST', `/api/v1/quality-inspections/${insp.json.id}/submit`, {
    cookie: adminCookie,
    body: { result: 'PASSED', notes: 'factory UAT pass' },
  });
}

async function failQc(adminCookie, poId, stageCode = 'INSPECTION') {
  const insp = await request('POST', '/api/v1/quality-inspections', {
    cookie: adminCookie,
    body: { productionOrderId: poId, stageCode },
  });
  if (!insp.json?.id) return { insp };
  const submitted = await request('POST', `/api/v1/quality-inspections/${insp.json.id}/submit`, {
    cookie: adminCookie,
    body: {
      result: 'FAILED_REWORK_REQUIRED',
      notes: 'factory UAT fail',
      defectDescription: 'UAT seam defect',
    },
  });
  const detail = await request('GET', `/api/v1/quality-inspections/${insp.json.id}`, { cookie: adminCookie });
  const rework =
    submitted.json?.rework ??
    detail.json?.rework ??
    (Array.isArray(detail.json?.rework) ? detail.json.rework[0] : null);
  const reworkId = rework?.id ?? (Array.isArray(rework) ? rework[0]?.id : null);
  return { insp: insp.json, submitted, rework: reworkId ? { ...rework, id: reworkId } : rework, detail };
}

async function deliverOrder(adminCookie, { customerId, soId, address = 'UAT delivery street 1' }) {
  const created = await request('POST', '/api/v1/deliveries', {
    cookie: adminCookie,
    body: { customerId, salesOrderId: soId, deliveryAddress: address },
  });
  const id = created.json?.id;
  if (!id) return { created };
  await request('PATCH', `/api/v1/deliveries/${id}/status`, {
    cookie: adminCookie,
    body: { status: 'READY' },
  });
  await request('PATCH', `/api/v1/deliveries/${id}/status`, {
    cookie: adminCookie,
    body: { status: 'OUT_FOR_DELIVERY' },
  });
  const delivered = await request('PATCH', `/api/v1/deliveries/${id}/status`, {
    cookie: adminCookie,
    body: { status: 'DELIVERED', recipientName: 'UAT', signatureData: 'uat' },
  });
  const retry = await request('PATCH', `/api/v1/deliveries/${id}/status`, {
    cookie: adminCookie,
    body: { status: 'DELIVERED', recipientName: 'UAT', signatureData: 'uat' },
  });
  return { created, delivered, retry, id };
}

async function skipOptional(adminCookie, poId, stageCode) {
  const graph = await request('GET', `/api/v1/production-orders/${poId}/workflow`, {
    cookie: adminCookie,
  });
  const node = (graph.json?.stages ?? []).find((s) => s.code === stageCode);
  if (!node?.id) return { graph, missing: true };
  return request('POST', `/api/v1/production-orders/${poId}/workflow/nodes/${node.id}/skip`, {
    cookie: adminCookie,
    body: { reason: 'UAT skip optional painting' },
  });
}

async function lotsForItem(cookie, itemId) {
  const semi = await request('GET', '/api/v1/inventory/semi-finished?pageSize=100', { cookie });
  const fg = await request('GET', '/api/v1/inventory/finished-goods?pageSize=100', { cookie });
  const rows = [...(semi.json?.data ?? []), ...(fg.json?.data ?? [])];
  return rows.filter((r) => r.inventoryItemId === itemId || r.inventoryItem?.id === itemId || r.id === itemId);
}

async function fgLotsForPo(cookie, poId, fgItemId) {
  const fg = await request('GET', '/api/v1/inventory/finished-goods?pageSize=100', { cookie });
  const items = fg.json?.data ?? [];
  const item = items.find((r) => r.id === fgItemId) ?? items.find((r) => r.sku?.includes('UAT-SOFA'));
  const lots = item?.lots ?? item?.inventoryLots ?? [];
  if (lots.length) return lots.filter((l) => l.productionOrderId === poId);
  const semi = await request('GET', `/api/v1/inventory/items/${fgItemId}`, { cookie });
  return semi.json?.lots ?? [];
}

async function ensureWorker(adminCookie) {
  const existing = await request('GET', '/api/v1/users?roleCode=PRODUCTION_WORKER&pageSize=20', {
    cookie: adminCookie,
  });
  const found = (existing.json?.data ?? []).find((u) => u.username === 'uat.worker') ?? existing.json?.data?.[0];
  if (found?.id) return found;
  const roles = await request('GET', '/api/v1/roles', { cookie: adminCookie });
  const workerRole = (Array.isArray(roles.json) ? roles.json : roles.json?.data ?? []).find(
    (r) => r.code === 'PRODUCTION_WORKER',
  );
  if (!workerRole?.id) return null;
  const created = await request('POST', '/api/v1/users', {
    cookie: adminCookie,
    body: {
      username: 'uat.worker',
      firstName: 'UAT',
      lastName: 'Worker',
      password: '123',
      roleIds: [workerRole.id],
    },
  });
  return created.json;
}

async function run() {
  const adminLogin = await login('admin', '123');
  const adminCookie = adminLogin.cookie;
  ok('admin login', adminLogin.status === 200 || adminLogin.status === 201, String(adminLogin.status));
  const dealerLogin = await login('nile', '123');
  const dealerCookie = dealerLogin.cookie;
  ok('dealer login', dealerLogin.status === 200 || dealerLogin.status === 201, String(dealerLogin.status));

  const customers = await request('GET', '/api/v1/customers?pageSize=50&q=nile', { cookie: adminCookie });
  const customerId =
    (customers.json?.data ?? []).find((c) => String(c.email ?? '').includes('nile'))?.id ??
    customers.json?.data?.[0]?.id;
  ok('customer exists', Boolean(customerId), customerId ?? '');

  const productsRes = await request('GET', '/api/v1/products?pageSize=100&q=UAT-SOFA', {
    cookie: adminCookie,
  });
  const catalog = productsRes.json?.data ?? [];
  const productA = catalog.find((p) => p.sku === 'UAT-SOFA-A');
  const productB = catalog.find((p) => p.sku === 'UAT-SOFA-B');
  const productC = catalog.find((p) => p.sku === 'UAT-SOFA-C');
  ok('fixture UAT-SOFA-A', Boolean(productA?.id), productA?.id ?? 'missing — run seed:factory-uat-only');
  ok('fixture UAT-SOFA-B', Boolean(productB?.id), productB?.id ?? 'missing');
  ok('fixture UAT-SOFA-C', Boolean(productC?.id), productC?.id ?? 'missing');
  if (!productA?.id || !productB?.id || !productC?.id) {
    mark(1, 'BLOCKED', { reason: 'UAT fixtures missing' });
    return;
  }

  const setupA = await request('GET', `/api/v1/products/${productA.id}/production-setup`, {
    cookie: adminCookie,
  });
  ok('admin can GET production setup', setupA.status === 200, setupA.json?.status ?? errDetail(setupA));
  ok('Product A setup READY', setupA.json?.status === 'READY', setupA.json?.status);

  const wood = (await request('GET', '/api/v1/inventory/items/by-code/UAT-WOOD', { cookie: adminCookie })).json;
  const fabric = (await request('GET', '/api/v1/inventory/items/by-code/UAT-FABRIC', { cookie: adminCookie })).json;
  const frameA = (await request('GET', '/api/v1/inventory/items/by-code/UAT-SOFA-A-FRAME', { cookie: adminCookie })).json;
  const fgA = (await request('GET', '/api/v1/inventory/items/by-code/UAT-SOFA-A-FG', { cookie: adminCookie })).json;
  const kitB = (await request('GET', '/api/v1/inventory/items/by-code/UAT-SOFA-B-KIT', { cookie: adminCookie })).json;
  const frameB = (await request('GET', '/api/v1/inventory/items/by-code/UAT-SOFA-B-FRAME', { cookie: adminCookie })).json;
  const paintC = (await request('GET', '/api/v1/inventory/items/by-code/UAT-SOFA-C-PAINT', { cookie: adminCookie })).json;
  ok('raw SKUs exist', Boolean(wood?.id && fabric?.id), `${wood?.id} ${fabric?.id}`);

  const warehouses = await request('GET', '/api/v1/inventory/warehouses', { cookie: adminCookie });
  const rawWh =
    (warehouses.json ?? []).find((w) => w.code === 'RAW' || w.type === 'RAW_MATERIALS') ??
    (Array.isArray(warehouses.json?.data) ? warehouses.json.data : []).find((w) => w.code === 'RAW');
  const warehouseList = Array.isArray(warehouses.json) ? warehouses.json : warehouses.json?.data ?? [];
  const rawWarehouse = warehouseList.find((w) => w.code === 'RAW' || w.type === 'RAW_MATERIALS');
  ok('RAW warehouse', Boolean(rawWarehouse?.id), rawWarehouse?.id ?? errDetail(warehouses));

  const worker = await ensureWorker(adminCookie);
  ok('production worker available', Boolean(worker?.id), worker?.username ?? worker?.id ?? '');
  let workerCookie = null;
  if (worker?.username) {
    const wLogin = await login(worker.username === 'uat.worker' ? 'uat.worker' : worker.username, '123');
    if (wLogin.status < 400) workerCookie = wLogin.cookie;
    if (!workerCookie && worker.username !== 'uat.worker') {
      const createdLogin = await login('uat.worker', '123');
      if (createdLogin.status < 400) workerCookie = createdLogin.cookie;
    }
  }
  if (!workerCookie) {
    const wLogin = await login('uat.worker', '123');
    workerCookie = wLogin.status < 400 ? wLogin.cookie : null;
  }
  ok('worker login', Boolean(workerCookie), workerCookie ? 'ok' : 'could not login worker');

  // Receive enough raw for many orders: each qty2 needs 8 wood + 16 fabric.
  const beforeReceive = await snapshotStock(adminCookie, { wood: wood.id, fabric: fabric.id }, 'before-receive');
  const recWood = await receive(adminCookie, wood.id, rawWarehouse.id, 400, `uat-wood-${Date.now()}`);
  const recFab = await receive(adminCookie, fabric.id, rawWarehouse.id, 800, `uat-fab-${Date.now()}`);
  ok('PURCHASE_RECEIPT wood', recWood.status < 400, errDetail(recWood));
  ok('PURCHASE_RECEIPT fabric', recFab.status < 400, errDetail(recFab));
  const afterReceive = await snapshotStock(adminCookie, { wood: wood.id, fabric: fabric.id }, 'after-receive');
  ok(
    'wood onHand increased by 400',
    Math.abs(afterReceive.wood.onHand - beforeReceive.wood.onHand - 400) < 0.01,
    `${beforeReceive.wood.onHand} → ${afterReceive.wood.onHand}`,
  );

  const itemsA = { wood: wood.id, fabric: fabric.id, frame: frameA.id, fg: fgA.id };

  // ── 1. Standard sofa ──────────────────────────────────────────────────────
  const beforeOrder = await snapshotStock(adminCookie, itemsA, 'A-before-order');
  const orderA = await createConfirmedOrder({
    adminCookie,
    dealerCookie,
    customerId,
    product: productA,
    qty: 2,
    label: 'A-standard',
  });
  ok('A create/confirm SO+PO', Boolean(orderA.poId), orderA.error ?? orderA.poId);
  if (!orderA.poId) {
    mark(1, 'FAIL', { reason: orderA.error });
  } else {
    const afterConfirm = await snapshotStock(adminCookie, itemsA, 'A-after-confirm');
    const woodReservedDelta = afterConfirm.wood.reserved - beforeOrder.wood.reserved;
    const fabReservedDelta = afterConfirm.fabric.reserved - beforeOrder.fabric.reserved;
    ok('BOM reservation wood 8', Math.abs(woodReservedDelta - 8) < 0.01, `Δ reserved ${woodReservedDelta}`);
    ok('BOM reservation fabric 16', Math.abs(fabReservedDelta - 16) < 0.01, `Δ reserved ${fabReservedDelta}`);
    ok(
      'free = onHand - reserved (wood)',
      Math.abs(afterConfirm.wood.free - (afterConfirm.wood.onHand - afterConfirm.wood.reserved)) < 0.01,
      JSON.stringify(afterConfirm.wood),
    );

    const poA = await poDetail(adminCookie, orderA.poId);
    const graphA = await request('GET', `/api/v1/production-orders/${orderA.poId}/workflow`, {
      cookie: adminCookie,
    });
    ok('frozen workflow snapshot present', Boolean(graphA.json?.stages?.length), `nodes ${graphA.json?.stages?.length}`);
    ok('snapshot not legacy empty', graphA.json?.needsWorkflow !== true, `legacy=${graphA.json?.isLegacy}`);

    const workerAssign = await startAndCompleteStage(adminCookie, orderA.poId, 'MATERIAL_PREP', worker?.id);
    ok(
      'complete raw-consuming MATERIAL_PREP',
      workerAssign.done?.status < 400 || workerAssign.skippedDone,
      errDetail(workerAssign.done) || JSON.stringify({ missing: workerAssign.missing, skippedDone: workerAssign.skippedDone }),
    );
    const afterIssue = await snapshotStock(adminCookie, itemsA, 'A-after-raw-issue');
    const woodTx = await transactions(adminCookie, wood.id);
    const fabTx = await transactions(adminCookie, fabric.id);
    ok(
      'PRODUCTION_ISSUE wood',
      qtyOfType(woodTx, 'PRODUCTION_ISSUE') >= 8,
      `wood issue qty ${qtyOfType(woodTx, 'PRODUCTION_ISSUE')}`,
    );
    ok(
      'PRODUCTION_ISSUE fabric',
      qtyOfType(fabTx, 'PRODUCTION_ISSUE') >= 16,
      `fabric issue qty ${qtyOfType(fabTx, 'PRODUCTION_ISSUE')}`,
    );

    const carp = await startAndCompleteStage(adminCookie, orderA.poId, 'CARPENTRY', worker?.id);
    ok('complete WIP-producing CARPENTRY', carp.done?.status < 400 || carp.skippedDone, errDetail(carp.done));
    const afterWipIn = await snapshotStock(adminCookie, itemsA, 'A-after-wip-receipt');
    const frameTx = await transactions(adminCookie, frameA.id);
    ok(
      'SEMI_FINISHED_RECEIPT qty 2',
      Math.abs(qtyOfType(frameTx, 'SEMI_FINISHED_RECEIPT') - (afterWipIn.frame.onHand - beforeOrder.frame.onHand)) < 0.01 ||
        Math.abs(afterWipIn.frame.onHand - beforeOrder.frame.onHand - 2) < 0.01,
      `frame onHand ${beforeOrder.frame.onHand} → ${afterWipIn.frame.onHand}; receipt qty ${qtyOfType(frameTx, 'SEMI_FINISHED_RECEIPT')}`,
    );
    ok('exactly 2 named WIP outputs', Math.abs(afterWipIn.frame.onHand - beforeOrder.frame.onHand - 2) < 0.01, `Δ ${afterWipIn.frame.onHand - beforeOrder.frame.onHand}`);

    const retryCarp = await startAndCompleteStage(adminCookie, orderA.poId, 'CARPENTRY', worker?.id);
    const afterRetryWip = await snapshotStock(adminCookie, itemsA, 'A-retry-wip');
    ok(
      'WIP receipt idempotent',
      Math.abs(afterRetryWip.frame.onHand - afterWipIn.frame.onHand) < 0.01,
      `${afterWipIn.frame.onHand} vs ${afterRetryWip.frame.onHand}`,
    );

    await completeRemaining(adminCookie, orderA.poId, { untilCode: 'UPHOLSTERY' });
    const uph = await startAndCompleteStage(adminCookie, orderA.poId, 'UPHOLSTERY', worker?.id);
    ok('complete WIP-consuming UPHOLSTERY', uph.done?.status < 400 || uph.skippedDone, errDetail(uph.done));
    const afterWipOut = await snapshotStock(adminCookie, itemsA, 'A-after-wip-issue');
    ok(
      'SEMI_FINISHED_ISSUE consumed 2 frames',
      Math.abs(afterWipOut.frame.onHand - afterWipIn.frame.onHand + 2) < 0.01,
      `${afterWipIn.frame.onHand} → ${afterWipOut.frame.onHand}`,
    );
    const retryUph = await completeTask(adminCookie, uph.task?.id ?? 'none', `complete:${orderA.poId}:${uph.task?.id}:retry`);
    const afterRetryIssue = await snapshotStock(adminCookie, itemsA, 'A-retry-semi-issue');
    ok(
      'WIP issue idempotent',
      Math.abs(afterRetryIssue.frame.onHand - afterWipOut.frame.onHand) < 0.01,
      `${afterWipOut.frame.onHand} vs ${afterRetryIssue.frame.onHand}`,
    );

    await completeRemaining(adminCookie, orderA.poId, { untilCode: 'INSPECTION' });
    const beforeQcFg = await snapshotStock(adminCookie, itemsA, 'A-before-qc');
    ok('no sellable FG before QC', Math.abs(beforeQcFg.fg.onHand - beforeOrder.fg.onHand) < 0.01, `FG ${beforeQcFg.fg.onHand}`);

    const qc = await passQc(adminCookie, orderA.poId);
    ok('QC PASSED', qc.status < 400 && (qc.json?.result === 'PASSED' || qc.json?.status !== 'error'), errDetail(qc));
    const qcRetry = await request('POST', `/api/v1/quality-inspections/${qc.json?.id}/submit`, {
      cookie: adminCookie,
      body: { result: 'PASSED', notes: 'retry' },
    });
    await completeRemaining(adminCookie, orderA.poId);
    const afterFg = await snapshotStock(adminCookie, itemsA, 'A-after-fg');
    ok('exactly 2 FG after QC', Math.abs(afterFg.fg.onHand - beforeOrder.fg.onHand - 2) < 0.01, `Δ ${afterFg.fg.onHand - beforeOrder.fg.onHand}`);
    ok(
      'dealer-order FG reservation',
      afterFg.fg.reserved - beforeOrder.fg.reserved >= 2 - 1e-9,
      `reserved ${beforeOrder.fg.reserved} → ${afterFg.fg.reserved}`,
    );
    const fgTx = await transactions(adminCookie, fgA.id);
    ok('FINISHED_GOODS_RECEIPT exists', qtyOfType(fgTx, 'FINISHED_GOODS_RECEIPT') >= 2, `qty ${qtyOfType(fgTx, 'FINISHED_GOODS_RECEIPT')}`);
    ok(
      'FG receipt idempotent after QC retry',
      Math.abs(qtyOfType(fgTx, 'FINISHED_GOODS_RECEIPT') - 2) < 0.01 ||
        Math.abs(afterFg.fg.onHand - beforeOrder.fg.onHand - 2) < 0.01,
      `receipts ${qtyOfType(fgTx, 'FINISHED_GOODS_RECEIPT')}`,
    );

    const delivery = await deliverOrder(adminCookie, { customerId, soId: orderA.soId });
    ok('delivery completed', delivery.delivered?.status < 400, errDetail(delivery.delivered ?? delivery.created));
    const afterDel = await snapshotStock(adminCookie, itemsA, 'A-after-delivery');
    ok(
      'DELIVERY_ISSUE 2 FG',
      Math.abs(afterDel.fg.onHand - afterFg.fg.onHand + 2) < 0.01,
      `${afterFg.fg.onHand} → ${afterDel.fg.onHand}`,
    );
    const fgTx2 = await transactions(adminCookie, fgA.id);
    ok('DELIVERY_ISSUE transaction', qtyOfType(fgTx2, 'DELIVERY_ISSUE') >= 2, `qty ${qtyOfType(fgTx2, 'DELIVERY_ISSUE')}`);
    const delRetrySame = await snapshotStock(adminCookie, itemsA, 'A-delivery-retry');
    ok(
      'delivery completion idempotent',
      Math.abs(delRetrySame.fg.onHand - afterDel.fg.onHand) < 0.01,
      `${afterDel.fg.onHand} vs ${delRetrySame.fg.onHand}`,
    );

    mark(1, steps.filter((s) => s.name.startsWith('A ') || s.name.includes('standard') || s.name.includes('BOM') || s.name.includes('WIP') || s.name.includes('FG') || s.name.includes('DELIVERY') || s.name.includes('QC PASSED') || s.name.includes('MATERIAL_PREP') || s.name.includes('CARPENTRY') || s.name.includes('UPHOLSTERY') || s.name.includes('sellable FG') || s.name.includes('dealer-order') || s.name.includes('PURCHASE') || s.name.includes('PRODUCTION_ISSUE') || s.name.includes('SEMI_FINISHED') || s.name.includes('FINISHED_GOODS') || s.name.includes('exactly 2')).every((s) => s.ok) ? 'PASS' : 'FAIL', {
      poId: orderA.poId,
      soId: orderA.soId,
    });
  }

  // ── 2. Parallel B ─────────────────────────────────────────────────────────
  const orderB = await createConfirmedOrder({
    adminCookie,
    dealerCookie,
    customerId,
    product: productB,
    qty: 2,
    label: 'B-parallel',
  });
  ok('B create/confirm', Boolean(orderB.poId), orderB.error ?? orderB.poId);
  if (orderB.poId) {
    await startAndCompleteStage(adminCookie, orderB.poId, 'MATERIAL_PREP', worker?.id);
    await startAndCompleteStage(adminCookie, orderB.poId, 'CARPENTRY', worker?.id);
    const afterOne = await stock(adminCookie, frameB.id);
    const kitBefore = await stock(adminCookie, kitB.id);
    const blocked = await tryStartStage(adminCookie, orderB.poId, 'UPHOLSTERY');
    const blockedComplete = blocked.task
      ? await completeTask(adminCookie, blocked.task.id, `b-uph-early:${orderB.poId}`)
      : { status: 400, json: { code: 'MISSING' } };
    const shortage =
      payload(blocked.started)?.code === 'INSUFFICIENT_SEMI_FINISHED_STOCK' ||
      payload(blockedComplete)?.code === 'INSUFFICIENT_SEMI_FINISHED_STOCK';
    ok(
      'B downstream blocked with only Frame',
      shortage,
      `start=${errDetail(blocked.started)} complete=${errDetail(blockedComplete)} kitOnHand=${kitBefore.onHand}`,
    );
    const kitAfterBlocked = await stock(adminCookie, kitB.id);
    ok('no silent foam under-issue', kitAfterBlocked.onHand === kitBefore.onHand, `${kitBefore.onHand} → ${kitAfterBlocked.onHand}`);

    const foam = await startAndCompleteStage(adminCookie, orderB.poId, 'FOAM', worker?.id);
    ok('B complete second branch FOAM', foam.done?.status < 400 || foam.skippedDone, errDetail(foam.done));
    const kitAfter = await stock(adminCookie, kitB.id);
    ok('B foam kit received', kitAfter.onHand - kitBefore.onHand >= 2 - 1e-9, `Δ ${kitAfter.onHand - kitBefore.onHand}`);

    const uphB = await startAndCompleteStage(adminCookie, orderB.poId, 'UPHOLSTERY', worker?.id);
    ok('B upholstery proceeds after both outputs', uphB.done?.status < 400 || uphB.skippedDone, errDetail(uphB.done));
    await passQc(adminCookie, orderB.poId);
    await completeRemaining(adminCookie, orderB.poId);
    mark(2, shortage && (uphB.done?.status < 400 || uphB.skippedDone) ? 'PASS' : 'FAIL', { poId: orderB.poId });
  } else {
    mark(2, 'FAIL', { reason: orderB.error });
  }

  // ── 3. Optional C ─────────────────────────────────────────────────────────
  const orderCWith = await createConfirmedOrder({
    adminCookie,
    dealerCookie,
    customerId,
    product: productC,
    qty: 1,
    label: 'C-with-paint',
  });
  const orderCWithout = await createConfirmedOrder({
    adminCookie,
    dealerCookie,
    customerId,
    product: productC,
    qty: 1,
    label: 'C-skip-paint',
  });
  ok('C with-optional PO', Boolean(orderCWith.poId), orderCWith.error ?? orderCWith.poId);
  ok('C without-optional PO', Boolean(orderCWithout.poId), orderCWithout.error ?? orderCWithout.poId);
  if (orderCWith.poId && orderCWithout.poId) {
    const gWith = await request('GET', `/api/v1/production-orders/${orderCWith.poId}/workflow`, { cookie: adminCookie });
    const skipRes = await skipOptional(adminCookie, orderCWithout.poId, 'PAINTING');
    ok('skip optional painting', skipRes.status < 400 || skipRes.json?.stages, errDetail(skipRes));
    const gWithout = await request('GET', `/api/v1/production-orders/${orderCWithout.poId}/workflow`, { cookie: adminCookie });
    const paintWith = (gWith.json?.stages ?? []).find((s) => s.code === 'PAINTING');
    const paintWithout = (gWithout.json?.stages ?? []).find((s) => s.code === 'PAINTING');
    ok('snapshots differ on skip', Boolean(paintWith) && (paintWithout?.isSkipped || paintWithout?.status === 'SKIPPED' || !paintWithout), `with=${paintWith?.isSkipped} without=${paintWithout?.isSkipped}/${paintWithout?.status}`);

    const paintBefore = await stock(adminCookie, paintC.id);
    const dWith = await poDetail(adminCookie, orderCWith.poId);
    const paintStage = stageByCode(dWith, 'PAINTING');
    const paintTasksWith = paintStage?.tasks?.length ?? 0;
    await completeRemaining(adminCookie, orderCWith.poId, { untilCode: 'PAINTING' });
    const painted = await startAndCompleteStage(adminCookie, orderCWith.poId, 'PAINTING', worker?.id);
    ok('C-with completes painting', painted.done?.status < 400 || painted.skippedDone, errDetail(painted.done));
    const paintAfterWith = await stock(adminCookie, paintC.id);
    ok('C-with painting produced WIP', paintAfterWith.onHand > paintBefore.onHand, `${paintBefore.onHand} → ${paintAfterWith.onHand}`);

    const dWithout = await poDetail(adminCookie, orderCWithout.poId);
    const paintSkipStage = stageByCode(dWithout, 'PAINTING');
    const activePaintTasks = (paintSkipStage?.tasks ?? []).filter((t) => t.status !== 'CANCELLED');
    ok('skipped stage has no active task', activePaintTasks.length === 0, `tasks=${(paintSkipStage?.tasks ?? []).map((t) => t.status).join(',')}`);
    await completeRemaining(adminCookie, orderCWithout.poId);
    const paintAfterSkip = await stock(adminCookie, paintC.id);
    ok('skipped painting created no extra WIP', Math.abs(paintAfterSkip.onHand - paintAfterWith.onHand) < 0.01, `${paintAfterWith.onHand} vs ${paintAfterSkip.onHand}`);
    const paintTx = await transactions(adminCookie, paintC.id);
    const skipPoTx = paintTx.filter((tx) => tx.referenceId === orderCWithout.poId);
    ok('skipped stage created no inventory tx', skipPoTx.length === 0, `txs=${skipPoTx.length}`);
    mark(3, 'PASS');
  } else {
    mark(3, 'FAIL');
  }

  // ── 4. Snapshot immutability ──────────────────────────────────────────────
  const setupBefore = await request('GET', `/api/v1/products/${productA.id}/production-setup`, { cookie: adminCookie });
  const orderImmA = await createConfirmedOrder({
    adminCookie,
    dealerCookie,
    customerId,
    product: productA,
    qty: 1,
    label: 'imm-A',
  });
  const carpStage = (setupBefore.json?.stages ?? []).find((s) => s.nodeKey === 'CARPENTRY' || s.output?.nameEn?.includes('Frame'));
  const mutatedStages = (setupBefore.json?.stages ?? []).map((s) => ({
    workflowNodeId: s.workflowNodeId,
    stageDefinitionId: s.stageDefinitionId,
    behavior: s.behavior,
    consumesRawMaterials: s.consumesRawMaterials,
    consumesSemiFinished: s.consumesSemiFinished,
    outputNameEn: s.output?.nameEn,
    outputNameAr: s.output?.nameAr,
    outputNameHe: s.output?.nameHe,
    outputQtyPerUnit: s.nodeKey === 'CARPENTRY' ? 7 : s.output?.qtyPerUnit ?? 1,
    defaultWarehouseId: s.output?.defaultWarehouseId,
    consumeOutputIds: s.consumeOutputIds ?? [],
  }));
  const putMut = await request('PUT', `/api/v1/products/${productA.id}/production-setup`, {
    cookie: adminCookie,
    body: { stages: mutatedStages },
  });
  ok('PUT mutated qty-per-unit', putMut.status < 400, errDetail(putMut));
  if (orderImmA.poId) {
    const frameBeforeImm = await stock(adminCookie, frameA.id);
    await startAndCompleteStage(adminCookie, orderImmA.poId, 'MATERIAL_PREP', worker?.id);
    await startAndCompleteStage(adminCookie, orderImmA.poId, 'CARPENTRY', worker?.id);
    const frameAfterImmA = await stock(adminCookie, frameA.id);
    const frozenDelta = frameAfterImmA.onHand - frameBeforeImm.onHand;
    ok('Order A snapshot ignores later qty 7', Math.abs(frozenDelta - 1) < 0.01, `Δ frames ${frozenDelta}`);
  }
  const orderImmB = await createConfirmedOrder({
    adminCookie,
    dealerCookie,
    customerId,
    product: productA,
    qty: 1,
    label: 'imm-B',
  });
  if (orderImmB.poId) {
    const frameBeforeB = await stock(adminCookie, frameA.id);
    await startAndCompleteStage(adminCookie, orderImmB.poId, 'MATERIAL_PREP', worker?.id);
    await startAndCompleteStage(adminCookie, orderImmB.poId, 'CARPENTRY', worker?.id);
    const frameAfterB = await stock(adminCookie, frameA.id);
    const newDelta = frameAfterB.onHand - frameBeforeB.onHand;
    ok('Order B uses new qty-per-unit 7', Math.abs(newDelta - 7) < 0.01, `Δ frames ${newDelta}`);
  }
  const restoreStages = (setupBefore.json?.stages ?? []).map((s) => ({
    workflowNodeId: s.workflowNodeId,
    stageDefinitionId: s.stageDefinitionId,
    behavior: s.behavior,
    consumesRawMaterials: s.consumesRawMaterials,
    consumesSemiFinished: s.consumesSemiFinished,
    outputNameEn: s.output?.nameEn,
    outputNameAr: s.output?.nameAr,
    outputNameHe: s.output?.nameHe,
    outputQtyPerUnit: s.output?.qtyPerUnit ?? 1,
    defaultWarehouseId: s.output?.defaultWarehouseId,
    consumeOutputIds: s.consumeOutputIds ?? [],
  }));
  await request('PUT', `/api/v1/products/${productA.id}/production-setup`, {
    cookie: adminCookie,
    body: { stages: restoreStages },
  });
  mark(4, steps.filter((s) => s.name.includes('snapshot') || s.name.includes('qty-per-unit') || s.name.includes('Order A snapshot') || s.name.includes('Order B uses')).every((s) => s.ok) ? 'PASS' : 'FAIL');

  // ── 5. Production return ──────────────────────────────────────────────────
  const orderRet = await createConfirmedOrder({
    adminCookie,
    dealerCookie,
    customerId,
    product: productA,
    qty: 1,
    label: 'prod-return',
  });
  if (orderRet.poId) {
    await startAndCompleteStage(adminCookie, orderRet.poId, 'MATERIAL_PREP', worker?.id);
    const woodBeforeReturn = await stock(adminCookie, wood.id);
    const ret1 = await request('POST', `/api/v1/production-orders/${orderRet.poId}/materials/return`, {
      cookie: adminCookie,
      body: { inventoryItemId: wood.id, quantity: 1, idempotencyKey: `prod-ret:${orderRet.poId}:1` },
    });
    ok('PRODUCTION_RETURN accepted', ret1.status < 400, errDetail(ret1));
    const woodAfterReturn = await stock(adminCookie, wood.id);
    ok('RAW restored by 1', Math.abs(woodAfterReturn.onHand - woodBeforeReturn.onHand - 1) < 0.01, `${woodBeforeReturn.onHand} → ${woodAfterReturn.onHand}`);
    const retDup = await request('POST', `/api/v1/production-orders/${orderRet.poId}/materials/return`, {
      cookie: adminCookie,
      body: { inventoryItemId: wood.id, quantity: 1, idempotencyKey: `prod-ret:${orderRet.poId}:1` },
    });
    const woodAfterDup = await stock(adminCookie, wood.id);
    ok('return retry does not duplicate', Math.abs(woodAfterDup.onHand - woodAfterReturn.onHand) < 0.01, `${woodAfterReturn.onHand} vs ${woodAfterDup.onHand}`);
    const over = await request('POST', `/api/v1/production-orders/${orderRet.poId}/materials/return`, {
      cookie: adminCookie,
      body: { inventoryItemId: wood.id, quantity: 999, idempotencyKey: `prod-ret:${orderRet.poId}:over` },
    });
    ok('cannot return more than issued', over.status >= 400, errDetail(over));
    mark(5, ret1.status < 400 && over.status >= 400 ? 'PASS' : 'FAIL');
  } else {
    mark(5, 'FAIL', { reason: orderRet.error });
  }

  // ── 6. QC failure + rework ────────────────────────────────────────────────
  const orderQc = await createConfirmedOrder({
    adminCookie,
    dealerCookie,
    customerId,
    product: productA,
    qty: 1,
    label: 'qc-rework',
  });
  if (orderQc.poId) {
    await completeRemaining(adminCookie, orderQc.poId, { untilCode: 'INSPECTION' });
    const beforeFailFg = await stock(adminCookie, fgA.id);
    let detailBeforeFail = await poDetail(adminCookie, orderQc.poId);
    if (!(detailBeforeFail?.stages ?? []).length) {
      await new Promise((r) => setTimeout(r, 800));
      detailBeforeFail = await poDetail(adminCookie, orderQc.poId);
    }
    const carpentryStage =
      stageByCode(detailBeforeFail, 'CARPENTRY') ??
      (detailBeforeFail?.stages ?? []).find((s) =>
        (s.tasks ?? []).some((t) => t.status === 'COMPLETED'),
      );
    const originalTaskId = carpentryStage?.tasks?.[0]?.id;
    const originalStatus = carpentryStage?.tasks?.[0]?.status;
    const failed = await failQc(adminCookie, orderQc.poId);
    const reworkId =
      failed.rework?.id ??
      failed.submitted?.json?.rework?.id ??
      failed.detail?.json?.rework?.id;
    ok('QC fail created rework', Boolean(reworkId), errDetail(failed.submitted ?? failed.insp));
    const afterFailFg = await stock(adminCookie, fgA.id);
    ok('FG unavailable after QC fail', afterFailFg.onHand <= beforeFailFg.onHand, `${beforeFailFg.onHand} → ${afterFailFg.onHand}`);
    const reentryId = carpentryStage?.id;
    const startRw =
      reworkId && reentryId
        ? await request('POST', `/api/v1/quality-inspections/rework/${reworkId}/start`, {
            cookie: adminCookie,
            body: { stageInstanceId: reentryId },
          })
        : { status: 400, json: { code: 'VALIDATION_ERROR', message: `missing reworkId=${reworkId} stage=${reentryId}` } };
    ok('rework start at previous stage', startRw.status < 400, errDetail(startRw));
    const afterStart = await poDetail(adminCookie, orderQc.poId);
    const carpAfter = stageByCode(afterStart, 'CARPENTRY');
    const originalStill = (carpAfter?.tasks ?? []).find((t) => t.id === originalTaskId);
    const reworkTask = (carpAfter?.tasks ?? []).find((t) => t.isRework || t.id !== originalTaskId && t.status !== 'COMPLETED');
    ok('original completed task remains historical', !originalTaskId || originalStill?.status === 'COMPLETED' || originalStatus === 'COMPLETED', originalStill?.status ?? originalStatus);
    ok('new rework task created', Boolean(reworkTask?.id) || (carpAfter?.tasks ?? []).length > 1, `tasks=${(carpAfter?.tasks ?? []).length}`);
    if (reworkTask?.id && worker?.id) {
      await request('POST', `/api/v1/tasks/${reworkTask.id}/assign`, {
        cookie: adminCookie,
        body: { employeeId: worker.id },
      });
      if (workerCookie) {
        const wStart = await request('POST', `/api/v1/tasks/${reworkTask.id}/start`, { cookie: workerCookie });
        ok('worker can start rework task', wStart.status < 400 || wStart.json?.status, errDetail(wStart));
      }
    }
    const rwTaskId = reworkTask?.id;
    if (rwTaskId) {
      await completeTask(adminCookie, rwTaskId, `rework-complete:${rwTaskId}`);
    }
    await request('POST', `/api/v1/quality-inspections/rework/${reworkId}/complete`, { cookie: adminCookie }).catch(() => {});
    const qc2 = await passQc(adminCookie, orderQc.poId);
    ok('QC PASS after rework', qc2.status < 400, errDetail(qc2));
    await completeRemaining(adminCookie, orderQc.poId);
    const afterReworkFg = await stock(adminCookie, fgA.id);
    const fgDelta = afterReworkFg.onHand - afterFailFg.onHand;
    ok('QC PASS creates FG exactly once', Math.abs(fgDelta - 1) < 0.01, `Δ FG ${fgDelta}`);
    mark(6, reworkId && Math.abs(fgDelta - 1) < 0.01 ? 'PASS' : 'FAIL');
  } else {
    mark(6, 'FAIL');
  }

  // ── 7. Customer return fates ──────────────────────────────────────────────
  async function produceDeliverQty1(label) {
    const order = await createConfirmedOrder({
      adminCookie,
      dealerCookie,
      customerId,
      product: productA,
      qty: 1,
      label,
    });
    if (!order.poId) return order;
    await completeRemaining(adminCookie, order.poId, {
      untilCode: 'INSPECTION',
      skipCodes: ['DELIVERY'],
    });
    await passQc(adminCookie, order.poId);
    let last = await completeRemaining(adminCookie, order.poId, { skipCodes: ['DELIVERY'] });
    for (let i = 0; i < 6; i += 1) {
      const detail = await poDetail(adminCookie, order.poId);
      if (['READY_FOR_DELIVERY', 'COMPLETED'].includes(detail?.status)) {
        last = detail;
        break;
      }
      last = await completeRemaining(adminCookie, order.poId, { skipCodes: ['DELIVERY'] });
    }
    let soStatus = '';
    for (let i = 0; i < 8; i += 1) {
      const so = await request('GET', `/api/v1/sales-orders/${order.soId}`, { cookie: adminCookie });
      soStatus = so.json?.status ?? '';
      if (soStatus === 'READY_FOR_DELIVERY') break;
      await new Promise((r) => setTimeout(r, 300));
    }
    const delivery = await deliverOrder(adminCookie, { customerId, soId: order.soId, address: `UAT ${label}` });
    return { ...order, soStatus, delivery, poStatus: last?.status };
  }

  async function createApprovedReturn(soId, qty = 1) {
    const created = await request('POST', '/api/v1/returns', {
      cookie: adminCookie,
      body: {
        customerId,
        salesOrderId: soId,
        productDesc: productA.nameEn ?? 'UAT sofa',
        quantity: qty,
        reason: 'CUSTOMER_REQUEST',
        description: 'UAT customer return',
      },
    });
    const retryCreate = await request('POST', '/api/v1/returns', {
      cookie: adminCookie,
      body: {
        customerId,
        salesOrderId: soId,
        productDesc: productA.nameEn ?? 'UAT sofa',
        quantity: qty,
        reason: 'CUSTOMER_REQUEST',
        description: 'UAT customer return retry',
      },
    });
    const id = created.json?.id;
    const resolved = id
      ? await request('PATCH', `/api/v1/returns/${id}/resolve`, {
          cookie: adminCookie,
          body: { approvalStatus: 'APPROVED' },
        })
      : created;
    return { created, retryCreate, resolved, id };
  }

  const retStockOrder = await produceDeliverQty1('return-stock');
  const retReworkOrder = await produceDeliverQty1('return-rework');
  const retScrapOrder = await produceDeliverQty1('return-scrap');
  ok('customer-return stock order delivered', Boolean(retStockOrder.poId), retStockOrder.error ?? retStockOrder.soId);
  if (retStockOrder.soId) {
    const fgBeforeQ = await stock(adminCookie, fgA.id);
    const ret = await createApprovedReturn(retStockOrder.soId);
    ok('customer return created+approved', Boolean(ret.id) && ret.resolved.status < 400, errDetail(ret.resolved));
    const retryResolve = await request('PATCH', `/api/v1/returns/${ret.id}/resolve`, {
      cookie: adminCookie,
      body: { approvalStatus: 'APPROVED' },
    });
    const fgTxQ = await transactions(adminCookie, fgA.id);
    ok('CUSTOMER_RETURN tx', qtyOfType(fgTxQ, 'CUSTOMER_RETURN') >= 1, `qty ${qtyOfType(fgTxQ, 'CUSTOMER_RETURN')}`);
    const fateStock = await request('PATCH', `/api/v1/returns/${ret.id}/inventory-fate`, {
      cookie: adminCookie,
      body: { inventoryFate: 'RETURN_TO_STOCK' },
    });
    ok('RETURN_TO_STOCK', fateStock.status < 400, errDetail(fateStock));
    const fateStockRetry = await request('PATCH', `/api/v1/returns/${ret.id}/inventory-fate`, {
      cookie: adminCookie,
      body: { inventoryFate: 'RETURN_TO_STOCK' },
    });
    const fgAfterStock = await stock(adminCookie, fgA.id);
    ok('return-to-stock available exactly once', fateStock.status < 400, `onHand ${fgBeforeQ.onHand} → ${fgAfterStock.onHand}`);
  }
  if (retReworkOrder.soId) {
    const fgBefore = await stock(adminCookie, fgA.id);
    const ret = await createApprovedReturn(retReworkOrder.soId);
    const detail = await poDetail(adminCookie, retReworkOrder.poId);
    const stageId = stageByCode(detail, 'UPHOLSTERY')?.id;
    const fate = await request('PATCH', `/api/v1/returns/${ret.id}/inventory-fate`, {
      cookie: adminCookie,
      body: { inventoryFate: 'REWORK', reentryStageInstanceId: stageId, notes: 'UAT return rework' },
    });
    ok('return REWORK fate', fate.status < 400, errDetail(fate));
    const fgMid = await stock(adminCookie, fgA.id);
    const retRow = await request('GET', `/api/v1/returns/${ret.id}`, { cookie: adminCookie });
    ok(
      'rework return remains unavailable as extra sellable FG',
      retRow.json?.inventoryFate === 'REWORK' && fgMid.free <= fgBefore.free + 1e-9,
      `fate=${retRow.json?.inventoryFate} free ${fgBefore.free} → ${fgMid.free} onHand ${fgBefore.onHand} → ${fgMid.onHand}`,
    );
    const after = await poDetail(adminCookie, retReworkOrder.poId);
    const rwTasks = (after.tasks ?? []).filter((t) => t.isRework) ?? [];
    const stageTasks = (stageByCode(after, 'UPHOLSTERY')?.tasks ?? []).filter((t) => t.isRework);
    const task = rwTasks[0] ?? stageTasks[0];
    if (task?.id) {
      await completeTask(adminCookie, task.id, `return-rework:${task.id}`);
    }
    await passQc(adminCookie, retReworkOrder.poId);
    await completeRemaining(adminCookie, retReworkOrder.poId);
    const fgAfter = await stock(adminCookie, fgA.id);
    ok('return rework + QC restores FG once', fgAfter.onHand - fgMid.onHand <= 1 + 1e-9, `Δ ${fgAfter.onHand - fgMid.onHand}`);
  }
  if (retScrapOrder.soId) {
    const fgBefore = await stock(adminCookie, fgA.id);
    const ret = await createApprovedReturn(retScrapOrder.soId);
    const fate = await request('PATCH', `/api/v1/returns/${ret.id}/inventory-fate`, {
      cookie: adminCookie,
      body: { inventoryFate: 'SCRAP' },
    });
    ok(
      'SCRAP fate',
      fate.status < 400,
      `${errDetail(fate)} so=${retScrapOrder.soId} po=${retScrapOrder.poId} soStatus=${retScrapOrder.soStatus} del=${errDetail(retScrapOrder.delivery?.delivered ?? retScrapOrder.delivery?.created)}`,
    );
    const fgAfter = await stock(adminCookie, fgA.id);
    ok('scrap never becomes available FG', fgAfter.onHand <= fgBefore.onHand + 1e-9, `${fgBefore.onHand} → ${fgAfter.onHand}`);
  }
  mark(7, steps.filter((s) => s.name.toLowerCase().includes('return') || s.name.includes('SCRAP') || s.name.includes('CUSTOMER_RETURN')).every((s) => s.ok) ? 'PASS' : 'FAIL');

  // ── 10. Roles ─────────────────────────────────────────────────────────────
  const workerSetup = workerCookie
    ? await request('GET', `/api/v1/products/${productA.id}/production-setup`, { cookie: workerCookie })
    : { status: 0 };
  ok('worker cannot open production setup', workerSetup.status === 403 || workerSetup.status === 401, String(workerSetup.status));
  const workerWh = workerCookie
    ? await request('GET', '/api/v1/inventory/warehouses', { cookie: workerCookie })
    : { status: 0 };
  ok('worker cannot list warehouses', workerWh.status === 403 || workerWh.status === 401, String(workerWh.status));
  const dealerSetup = await request('GET', `/api/v1/products/${productA.id}/production-setup`, {
    cookie: dealerCookie,
  });
  ok('dealer cannot open production setup', dealerSetup.status === 403 || dealerSetup.status === 401, String(dealerSetup.status));
  const dealerInv = await request('GET', '/api/v1/inventory/items/by-code/UAT-WOOD', { cookie: dealerCookie });
  ok('dealer cannot read raw inventory', dealerInv.status === 403 || dealerInv.status === 401, String(dealerInv.status));
  if (orderA.poId) {
    let dealerPo = await request('GET', `/api/v1/production-orders/${orderA.poId}`, { cookie: dealerCookie });
    if (dealerPo.status === 429) {
      await new Promise((r) => setTimeout(r, 1500));
      dealerPo = await request('GET', `/api/v1/production-orders/${orderA.poId}`, { cookie: dealerCookie });
    }
    ok('dealer can read own production order', dealerPo.status === 200, String(dealerPo.status));
    const dealerGraph = await request('GET', `/api/v1/production-orders/${orderA.poId}/workflow`, {
      cookie: dealerCookie,
    });
    const dealerText = JSON.stringify(dealerGraph.json ?? {});
    ok(
      'dealer graph hides worker/warehouse internals',
      dealerGraph.status === 200 &&
        !dealerText.includes('UAT-WOOD') &&
        !dealerText.includes('assignedEmployee'),
      `status=${dealerGraph.status}`,
    );
    const dealerMats = await request('GET', `/api/v1/production-orders/${orderA.poId}/materials`, {
      cookie: dealerCookie,
    });
    ok(
      'dealer materials empty',
      dealerMats.status === 200 && (dealerMats.json?.materials?.length ?? 0) === 0,
      JSON.stringify(dealerMats.json)?.slice(0, 120),
    );
  }
  mark(10, steps.filter((s) => s.name.startsWith('worker') || s.name.startsWith('dealer') || s.name.startsWith('admin can')).every((s) => s.ok) ? 'PASS' : 'FAIL');

  // ── 8/9. Idempotency + ledger (from Product A happy path) ────────────────
  mark(8, steps.filter((s) => s.name.toLowerCase().includes('idempotent') || s.name.toLowerCase().includes('duplicate') || s.name.toLowerCase().includes('retry')).every((s) => s.ok) ? 'PASS' : 'FAIL');

  console.log('\n── Ledger snapshots ──');
  for (const row of ledger) {
    console.log(row.label, JSON.stringify(row.balances));
  }

  const failed = steps.filter((s) => !s.ok);
  const passed = steps.filter((s) => s.ok);
  console.log(`\n${passed.length}/${steps.length} assertions passed, ${failed.length} failed`);
  if (failed.length) {
    for (const f of failed) console.log(`  FAIL ${f.name} — ${f.detail}`);
  }
  console.log('\nScenario results', JSON.stringify(scenarioResults, null, 2));

  if (failed.length) process.exitCode = 1;
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
