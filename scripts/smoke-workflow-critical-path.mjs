/**
 * Critical-path smoke:
 *   RFQ → Quotation → SO → Production/QC → Delivery → Invoice → Payment
 *   PR → offer → PO → GRN
 * Usage: node scripts/smoke-workflow-critical-path.mjs
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

async function approveQuotation(quoteId, cookie) {
  await request('POST', `/api/v1/quotations/${quoteId}/submit-for-approval`, { cookie });
  let approve = await request('POST', `/api/v1/quotations/${quoteId}/approve`, { cookie });
  for (let i = 0; i < 3 && approve.json?.status === 'INTERNAL_REVIEW'; i += 1) {
    approve = await request('POST', `/api/v1/quotations/${quoteId}/approve`, { cookie });
  }
  return approve;
}

async function completeProductionForDelivery(poId, cookie) {
  const detail = await request('GET', `/api/v1/production-orders/${poId}`, { cookie });
  const stages = detail.json?.stages ?? [];
  for (const stage of stages) {
    for (const task of stage.tasks ?? []) {
      if (task.status === 'COMPLETED') continue;
      await request('POST', `/api/v1/tasks/${task.id}/start`, { cookie });
      const done = await request('POST', `/api/v1/tasks/${task.id}/complete`, {
        cookie,
        body: {},
      });
      if (!(done.status === 200 || done.status === 201)) {
        // Inspection stages may require QC — create/pass inspection then retry
        const insp = await request('POST', '/api/v1/quality-inspections', {
          cookie,
          body: {
            productionOrderId: poId,
            stageCode: stage.stageDefinition?.code ?? 'INSPECTION',
          },
        });
        if (insp.json?.id) {
          await request('POST', `/api/v1/quality-inspections/${insp.json.id}/submit`, {
            cookie,
            body: { result: 'PASSED', notes: 'smoke pass' },
          });
        }
        await request('POST', `/api/v1/tasks/${task.id}/complete`, { cookie, body: {} });
      }
    }
  }
  return request('GET', `/api/v1/production-orders/${poId}`, { cookie });
}

// ── Auth ─────────────────────────────────────────────────────────────────────
const adminLogin = await request('POST', '/api/v1/auth/login', {
  body: { username: 'admin', password: '123' },
});
const adminCookie = cookieHeader(adminLogin.setCookie);
ok('admin login', adminLogin.status === 200 || adminLogin.status === 201, String(adminLogin.status));

const customers = await request('GET', '/api/v1/customers?pageSize=50&q=nile', {
  cookie: adminCookie,
});
const customerId =
  (customers.json?.data ?? []).find((c) => String(c.email ?? '').includes('nile'))?.id ??
  customers.json?.data?.[0]?.id;
ok('customer exists', Boolean(customerId), customerId ?? '');

// ── RFQ → Quotation → accept ─────────────────────────────────────────────────
const rfq = await request('POST', '/api/v1/requests', {
  cookie: adminCookie,
  body: {
    customerId,
    source: 'SALES',
    projectName: 'Smoke RFQ project',
    items: [
      {
        productName: 'Smoke RFQ sofa',
        quantity: 1,
        description: 'Velvet navy sofa',
        fabric: 'Velvet',
        color: 'Navy',
      },
    ],
  },
});
ok('create RFQ', Boolean(rfq.json?.id), rfq.json?.id ?? String(rfq.status));
const rfqId = rfq.json?.id;

if (rfqId) {
  await request('POST', `/api/v1/requests/${rfqId}/submit`, { cookie: adminCookie });
  await request('POST', `/api/v1/requests/${rfqId}/under-review`, { cookie: adminCookie });
  const ready = await request('POST', `/api/v1/requests/${rfqId}/ready-for-quotation`, {
    cookie: adminCookie,
  });
  ok(
    'RFQ ready for quotation',
    ready.json?.status === 'READY_FOR_QUOTATION' || ready.status === 200 || ready.status === 201,
    ready.json?.status ?? String(ready.status),
  );
}

const products = await request('GET', '/api/v1/products?pageSize=20', { cookie: adminCookie });
const productRows = products.json?.data ?? (Array.isArray(products.json) ? products.json : []);
const catalogProduct =
  productRows.find((p) => /sofa|ottoman|armchair|chair/i.test(String(p.nameEn ?? p.name ?? ''))) ??
  productRows[0];

const quote = await request('POST', '/api/v1/quotations', {
  cookie: adminCookie,
  body: {
    customerId,
    requestId: rfqId,
    paymentTerms: '30% deposit',
    deliveryTerms: 'Delivery by 2026-12-15',
    offeredDeliveryDate: '2026-12-15',
    lines: [
      {
        description: catalogProduct?.nameEn ?? 'Smoke sofa',
        quantity: 1,
        unitPrice: 1200,
        fabric: 'Velvet',
        color: 'Navy',
        taxRate: 0.16,
        productId: catalogProduct?.id,
      },
    ],
  },
});
ok('create quotation from RFQ', Boolean(quote.json?.id), quote.json?.id ?? String(quote.status));
const quoteId = quote.json?.id;

if (rfqId) {
  const rfqAfter = await request('GET', `/api/v1/requests/${rfqId}`, { cookie: adminCookie });
  ok('RFQ marked QUOTED', rfqAfter.json?.status === 'QUOTED', rfqAfter.json?.status ?? '');
}

let approve1 = { json: { status: null } };
if (quoteId) {
  approve1 = await approveQuotation(quoteId, adminCookie);
  ok('quotation approved', approve1.json?.status === 'APPROVED', approve1.json?.status);
  const sent = await request('POST', `/api/v1/quotations/${quoteId}/send`, { cookie: adminCookie });
  ok(
    'send quotation',
    sent.json?.status === 'SENT' || sent.json?.status === 'VIEWED',
    sent.json?.status ?? sent.json?.message ?? String(sent.status),
  );
}

const custLogin = await request('POST', '/api/v1/auth/login', {
  body: { username: 'nile', password: '123' },
});
const custCookie = cookieHeader(custLogin.setCookie);
ok('customer login', custLogin.status === 200 || custLogin.status === 201);

const acceptQuoteId = quoteId;

const accepted = await request('POST', `/api/v1/quotations/${acceptQuoteId}/accept`, {
  cookie: custCookie,
  body: { signatureData: 'data:image/png;base64,smoke' },
});
ok(
  'accept creates SO',
  accepted.status === 200 || accepted.status === 201,
  `${accepted.status} ${accepted.json?.status ?? accepted.json?.message ?? ''}`,
);

const soList = await request('GET', '/api/v1/sales-orders?pageSize=10', { cookie: adminCookie });
let so =
  accepted.json?.salesOrders?.[0] ??
  (soList.json?.data ?? []).find((s) => s.quotation?.id === acceptQuoteId);
ok('sales order present', Boolean(so?.id), so?.number ?? '');

if (so?.id) {
  const soFull = await request('GET', `/api/v1/sales-orders/${so.id}`, { cookie: adminCookie });
  if (soFull.json?.id) so = soFull.json;
  const priceLines = (so.lines ?? []).map((l) => ({
    lineId: l.id,
    unitPrice: Number(l.unitPrice) > 0 ? Number(l.unitPrice) : 1200,
  }));
  if (priceLines.length) {
    await request('POST', `/api/v1/sales-orders/${so.id}/confirm-commercial-prices`, {
      cookie: adminCookie,
      body: { lines: priceLines },
    });
  }
}

let plan = { status: 0, json: null };
if (so?.id) {
  await request('GET', `/api/v1/sales-orders/${so.id}/production-setup`, {
    cookie: adminCookie,
  });
  plan = await request('POST', `/api/v1/sales-orders/${so.id}/production-setup/ensure-plan`, {
    cookie: adminCookie,
  });
  const soNow = await request('GET', `/api/v1/sales-orders/${so.id}`, { cookie: adminCookie });
  if (soNow.json?.id) so = soNow.json;

  if (so.status === 'DRAFT') {
    const confirmed = await request('POST', `/api/v1/sales-orders/${so.id}/confirm`, {
      cookie: adminCookie,
    });
    ok(
      'confirm sales order',
      confirmed.json?.status === 'READY_FOR_PRODUCTION' ||
        confirmed.json?.status === 'WAITING_FOR_MATERIALS' ||
        confirmed.json?.status === 'CONFIRMED' ||
        confirmed.status === 200 ||
        confirmed.status === 201,
      confirmed.json?.status ?? confirmed.json?.message ?? String(confirmed.status),
    );
    if (confirmed.json?.id) so = confirmed.json;
  } else {
    ok(
      'confirm sales order',
      ['READY_FOR_PRODUCTION', 'WAITING_FOR_MATERIALS', 'CONFIRMED', 'IN_PRODUCTION'].includes(
        so.status,
      ),
      so.status ?? `plan=${plan.status} ${plan.json?.message ?? ''}`,
    );
  }
}

const poId =
  plan.json?.primaryProductionOrderId ??
  plan.json?.productionOrderIds?.[0] ??
  so?.productionOrders?.[0]?.id;
const poDetail = poId
  ? await request('GET', `/api/v1/production-orders/${poId}`, { cookie: adminCookie })
  : { json: null };
const po = poDetail.json?.id ? poDetail.json : null;
ok('production order from accept/confirm', Boolean(po?.id), po?.number ?? '');

if (po?.id) {
  const workflows = await request('GET', '/api/v1/production-workflows', { cookie: adminCookie });
  const wfRows = Array.isArray(workflows.json) ? workflows.json : (workflows.json?.data ?? []);
  const wf =
    wfRows.find((w) => /standard furniture/i.test(String(w.nameEn ?? w.name ?? ''))) ??
    wfRows.find((w) => (w.activeVersion?._count?.nodes ?? 0) >= 5) ??
    wfRows.find((w) => w.activeVersion?.id);
  if (wf?.id) {
    const assigned = await request('POST', `/api/v1/production-orders/${po.id}/workflow/assign`, {
      cookie: adminCookie,
      body: { workflowId: wf.id },
    });
    if (!(assigned.status === 200 || assigned.status === 201)) {
      ok(
        'assign workflow to PO',
        false,
        `${assigned.status} ${assigned.json?.message ?? wf.id}`,
      );
    }
  }
  await request('POST', `/api/v1/production-orders/${po.id}/start`, { cookie: adminCookie });
  const afterStages = await completeProductionForDelivery(po.id, adminCookie);
  ok(
    'PO ready for delivery after stages',
    ['READY_FOR_DELIVERY', 'COMPLETED', 'READY_FOR_PACKAGING'].includes(afterStages.json?.status),
    afterStages.json?.status ?? '',
  );
  const soReady = await request('GET', `/api/v1/sales-orders/${so.id}`, { cookie: adminCookie });
  ok(
    'SO READY_FOR_DELIVERY',
    soReady.json?.status === 'READY_FOR_DELIVERY',
    soReady.json?.status ?? '',
  );
}

const delivery = await request('POST', '/api/v1/deliveries', {
  cookie: adminCookie,
  body: {
    customerId: so?.customer?.id ?? customerId,
    salesOrderId: so?.id,
    deliveryAddress: 'Amman smoke address',
  },
});
ok('create delivery', Boolean(delivery.json?.id), delivery.json?.id ?? String(delivery.status));
if (delivery.json?.id && so?.id) {
  await request('PATCH', `/api/v1/deliveries/${delivery.json.id}/status`, {
    cookie: adminCookie,
    body: { status: 'READY' },
  });
  const sheet = await request('GET', `/api/v1/deliveries/${delivery.json.id}/load-sheet`, {
    cookie: adminCookie,
  });
  for (const product of sheet.json?.products ?? []) {
    for (const piece of product.pieces ?? []) {
      if (!piece.loadedAt && piece.id) {
        await request(
          'POST',
          `/api/v1/deliveries/${delivery.json.id}/load-pieces/${piece.id}/check`,
          { cookie: adminCookie },
        );
      }
    }
  }
  const departed = await request('POST', `/api/v1/deliveries/${delivery.json.id}/depart`, {
    cookie: adminCookie,
  });
  const receipt = await request('POST', `/api/v1/deliveries/${delivery.json.id}/confirm-receipt`, {
    cookie: custCookie,
    body: { recipientName: 'Smoke Tester', signatureData: 'sig' },
  });
  ok(
    'delivery delivered',
    receipt.json?.status === 'DELIVERED',
    receipt.json?.status ??
      `${receipt.status} ${receipt.json?.message ?? departed.json?.message ?? ''}`,
  );
  const soAfter = await request('GET', `/api/v1/sales-orders/${so.id}`, { cookie: adminCookie });
  ok('SO closed on delivery', soAfter.json?.status === 'DELIVERED', soAfter.json?.status ?? '');
}

const invoice = so?.id
  ? await request('POST', '/api/v1/invoices', {
      cookie: adminCookie,
      body: { salesOrderId: so.id },
    })
  : { status: 0, json: null };
ok(
  'invoice from SO',
  Boolean(invoice.json?.id),
  invoice.json?.id ?? '',
);

if (invoice.json?.id) {
  const payment = await request('POST', '/api/v1/payments', {
    cookie: adminCookie,
    body: {
      customerId: so?.customer?.id ?? customerId,
      invoiceId: invoice.json.id,
      amount: Number(invoice.json.outstandingAmount ?? invoice.json.total ?? 1),
      method: 'BANK_TRANSFER',
      referenceNumber: `SMOKE-${Date.now()}`,
      idempotencyKey: `smoke-pay-${invoice.json.id}`,
    },
  });
  ok('record payment', Boolean(payment.json?.id), payment.json?.id ?? String(payment.status));
}

// ── PR → offer → PO → GRN ────────────────────────────────────────────────────
const warehouses = await request('GET', '/api/v1/inventory/warehouses', { cookie: adminCookie });
const warehouseId = (Array.isArray(warehouses.json)
  ? warehouses.json
  : (warehouses.json?.data ?? []))[0]?.id;
const suppliers = await request('GET', '/api/v1/suppliers?pageSize=5', { cookie: adminCookie });
const supplierId = (suppliers.json?.data ?? [])[0]?.id;
const invItems = await request('GET', '/api/v1/inventory/items?pageSize=20&isPurchasable=true', {
  cookie: adminCookie,
});
let inventoryItemId = (invItems.json?.data ?? []).find((i) => i.isPurchasable)?.id;

if (!inventoryItemId) {
  const createdItem = await request('POST', '/api/v1/inventory/items', {
    cookie: adminCookie,
    body: {
      sku: `SMOKE-${Date.now()}`,
      nameAr: 'مادة دخان',
      nameEn: 'Smoke material',
      unit: 'pcs',
      category: 'WOOD',
      minStock: 10,
    },
  });
  inventoryItemId = createdItem.json?.id;
}
ok('inventory item for PR', Boolean(inventoryItemId), inventoryItemId ?? '');
ok('supplier for PR', Boolean(supplierId), supplierId ?? '');
ok('warehouse for GRN', Boolean(warehouseId), warehouseId ?? '');

const pr = await request('POST', '/api/v1/purchase-requests', {
  cookie: adminCookie,
  body: {
    reason: 'Smoke PR',
    warehouseId,
    lines: [
      {
        description: 'Smoke foam',
        quantity: 5,
        inventoryItemId,
      },
    ],
  },
});
ok(
  'create PR',
  Boolean(pr.json?.id),
  pr.json?.id ?? `${pr.status} ${pr.json?.message ?? ''}`,
);

if (pr.json?.id && supplierId) {
  await request('POST', `/api/v1/purchase-requests/${pr.json.id}/approve`, {
    cookie: adminCookie,
  });
  const offer = await request('POST', `/api/v1/purchase-requests/${pr.json.id}/offers`, {
    cookie: adminCookie,
    body: { supplierId, unitPrice: 12.5, leadTimeDays: 3, isSelected: true },
  });
  ok('add supplier offer', Boolean(offer.json?.id), offer.json?.id ?? String(offer.status));

  const converted = await request('POST', `/api/v1/purchase-requests/${pr.json.id}/convert`, {
    cookie: adminCookie,
  });
  ok('convert PR to PO', Boolean(converted.json?.id), converted.json?.id ?? String(converted.status));

  if (converted.json?.id) {
    await request('POST', `/api/v1/purchase-orders/${converted.json.id}/approve`, {
      cookie: adminCookie,
    });
    const sentPo = await request('POST', `/api/v1/purchase-orders/${converted.json.id}/send`, {
      cookie: adminCookie,
    });
    ok(
      'send PO',
      sentPo.json?.status === 'SENT' || sentPo.status === 200 || sentPo.status === 201,
      sentPo.json?.status ?? String(sentPo.status),
    );

    const grn = await request(
      'POST',
      `/api/v1/purchase-orders/${converted.json.id}/goods-receipts`,
      {
        cookie: adminCookie,
        body: {
          warehouseId,
          notes: 'Smoke GRN',
          lines: [
            {
              inventoryItemId,
              orderedQty: 5,
              receivedQty: 5,
            },
          ],
        },
      },
    );
    ok('GRN received', Boolean(grn.json?.id), grn.json?.id ?? String(grn.status));

    const poAfter = await request('GET', `/api/v1/purchase-orders/${converted.json.id}`, {
      cookie: adminCookie,
    });
    ok(
      'PO RECEIVED',
      poAfter.json?.status === 'RECEIVED' || poAfter.json?.status === 'PARTIALLY_RECEIVED',
      poAfter.json?.status ?? '',
    );
  }
}

const dash = await request('GET', '/api/v1/reports/dashboard', { cookie: adminCookie });
ok(
  'dashboard factory KPIs',
  dash.status === 200 &&
    dash.json?.newOrders != null &&
    dash.json?.ordersInProduction != null &&
    dash.json?.ordersNearingDelivery != null &&
    dash.json?.completedOrders != null &&
    dash.json?.delayedOrders != null,
  JSON.stringify({
    newOrders: dash.json?.newOrders,
    inProduction: dash.json?.ordersInProduction,
    nearingDelivery: dash.json?.ordersNearingDelivery,
    completed: dash.json?.completedOrders,
    delayed: dash.json?.delayedOrders,
  }),
);

const rfqs = await request('GET', '/api/v1/requests?pageSize=5', { cookie: adminCookie });
ok('admin RFQ list', rfqs.status === 200, String(rfqs.status));

const contracts = await request('GET', '/api/v1/contracts?pageSize=5', { cookie: custCookie });
ok('customer contracts scoped', contracts.status === 200, String(contracts.status));

const failed = steps.filter((s) => !s.ok);
console.log(`\n${steps.length - failed.length}/${steps.length} passed`);
process.exit(failed.length ? 1 : 0);
