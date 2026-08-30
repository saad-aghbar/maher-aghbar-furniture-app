import { promises as fs } from 'fs';
import path from 'path';
import type { PrismaClient } from '@prisma/client';
import { demoAsOf } from './clock';

export const FLAGSHIP_PROJECT_NAMES = [
  'Abdoun lounge set',
  'Sweifieh sectional',
  'Nile blank production start',
  'Abdali hotel banquettes',
  'Cedar Italian velvet recliner',
  'Diwan wingback frame gate',
  'Noor banquettes 4 of 6 frames',
  'Jabal contract dining',
  'Oasis club armchair QC',
  'Nile loveseat recovered',
  'Zaatar ottoman scuff',
  'Qasr suite dining',
  'Noor club chair hold',
  'Rawnaq dining six',
];

function ymd(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const sliced = typeof value === 'string' ? value.slice(0, 10) : value.toISOString().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(sliced) ? sliced : null;
}

export async function writeFatherWalkthrough(prisma: PrismaClient): Promise<string> {
  const asOf = demoAsOf().toISOString().slice(0, 10);
  const rows = await prisma.salesOrder.findMany({
    where: { projectName: { in: [...FLAGSHIP_PROJECT_NAMES] } },
    select: {
      number: true,
      status: true,
      projectName: true,
      requiredDeliveryDate: true,
      customer: { select: { nameEn: true, code: true } },
      productionOrders: {
        select: {
          number: true,
          status: true,
          committedDeliveryDate: true,
          requiredDeliveryDate: true,
          schedules: {
            orderBy: { version: 'desc' },
            take: 1,
            select: {
              requestedDeliveryDate: true,
              suggestedDeliveryDate: true,
              committedDeliveryDate: true,
              earliestAvailableDate: true,
              promiseState: true,
            },
          },
        },
      },
      invoices: { select: { number: true, status: true, outstandingAmount: true } },
      deliveries: { select: { number: true, status: true, deliveryDate: true } },
    },
    orderBy: { orderDate: 'asc' },
  });

  const quoteRows = await prisma.quotation.findMany({
    where: { request: { projectName: { in: [...FLAGSHIP_PROJECT_NAMES] } } },
    select: {
      number: true,
      version: true,
      status: true,
      acceptedAt: true,
      acceptedBy: { select: { username: true } },
      request: { select: { projectName: true, number: true } },
      salesOrders: { select: { number: true, status: true } },
    },
    orderBy: [{ number: 'asc' }, { version: 'asc' }],
  });

  const lines: string[] = [
    '# Father demo walkthrough',
    '',
    `**As of:** ${asOf} (Asia/Amman) · password \`123\``,
    '',
    'Use these **real seeded numbers** after `pnpm demo:reset`. Logins: `admin` (factory), `nile` / `oasis` / `balqis` (dealers), `carpenter` / `inspector` (floor).',
    '',
    '**Physical inventory storyline (factory truth):** Inventory → Semi-finished shows Sweifieh / Noor (4 of 6) frames as lots tied to POs. Finished shows Balqis banquettes waiting for truck (days waiting / RESERVED). Nile delivered has FIN receipt + departure issue (0 left in factory). Oasis QC hold has no deliverable FIN. Diwan has **0** SEMI while WIP_NOT_READY. Worker finish on materials opens Confirm materials (scan is identify-only). Item report PDF includes usage / return / scrap when seeded (Sweifieh carpentry).',
    '',
    '## Scenarios',
    '',
  ];

  const byName = new Map(rows.map((r) => [r.projectName ?? '', r]));
  const scenarioText: Record<string, string> = {
    'Abdoun lounge set':
      '**Delivered commercial history.** Admin: sales order → production snapshot → QC pass → delivery → paid invoice. Dealer `nile`: Schedule tab shows Delivered on the actual day. Worker: completed tasks. **Inventory:** historical FIN receipt then `DELIVERY_ISSUE` when the truck left — no finished lot left in factory.',
    'Sweifieh sectional':
      '**Live production + hybrid material usage.** Oasis L-sectional mid-flow (carpentry done → SEMI frames exist). Admin scheduling + worker tasks. Dealer sees committed/suggested dates, not carpentry dates. **Inventory:** SEMI lots for this PO; carpentry task has seeded expected/actual usage (equal + return/scrap on a second line).',
    'Nile blank production start':
      '**Just entered production — empty floor.** Sales order and PO are in production, but nothing has started: first stage READY, **0%** progress, no material issues, no WIP kits, no usage. Use Admin Orders → In production → this SO, then Production hub Materials / WIP / Tasks to see what is still missing and walk production setup yourself.',
    'Abdali hotel banquettes':
      '**Ready for delivery + FIN waiting for truck.** Balqis hospitality qty 6. Admin deliveries planned; dealer Schedule calendar uses the planned logistics day, not production completion. **Inventory:** FIN lots RESERVED in finished warehouse until truck goes OUT_FOR_DELIVERY.',
    'Cedar Italian velvet recliner':
      '**Material at-risk.** Waiting for inbound Italian velvet PO. Admin may-be-late / materials. Dealer has no committed date yet — Requested / Expected · not confirmed. Factory workers and capacity stay hidden. No started floor tasks. **No FIN** — truthful material wait only.\n\n**Warehouse scan (identify only).** Inventory → Scan → `MAT-ITAL-VEL`. Photo + 0 on hand + inbound fabric purchase PO (24 m, sequential `PORD-…`). Stop before Confirm receive — or `pnpm demo:reset` after a mutation demo.',
    'Diwan wingback frame gate':
      '**WIP at-risk.** Materials prepped; carpentry frames (SEMI lots) not produced yet. Scheduling NEEDS_REVIEW with WIP_NOT_READY — matches missing SEMI, not a status-only flag. **Inventory:** 0 SEMI lots for this PO.',
    'Noor banquettes 4 of 6 frames':
      '**Partial quantity.** Order qty 6; carpentry completedQty 4; SEMI lot qty 4. Remaining 2 frames still open — status never claims 6 physical frames.',
    'Jabal contract dining':
      '**Committed date vs capacity.** Approved plan cannot meet the committed delivery. Late chip from canonical classifier. Dealer calendar stays on the committed day. A past factory earliest-available date is not shown as current expected — copy is Delayed · Schedule being updated.',
    'Oasis club armchair QC':
      '**Current rework.** Inspection failed; rework awaiting stage; PO on hold. Must not appear delivered. **Inventory:** no deliverable FIN for this PO.',
    'Nile loveseat recovered':
      '**Historical rework.** Fail → completed rework → later pass → delivered. Partial payment.',
    'Zaatar ottoman scuff':
      '**Dealer return.** Delivered ottomans with an approved delivery-damage return.',
    'Qasr suite dining':
      '**Schedule awaiting approval.** Proposed plan — dealer Schedule shows Requested / Expected · not confirmed, not a fake confirmed date.',
    'Noor club chair hold':
      '**Dealer accept still pending.** Quote is SENT. Noor has not accepted — **اعتماد** (internal Approve) already happened at the factory; **قبول** (dealer Accept) has not. **No sales order** and no production.',
    'Rawnaq dining six':
      '**Confirmed, not started.** READY_FOR_PRODUCTION with no started floor tasks.',
  };

  let n = 1;
  for (const name of FLAGSHIP_PROJECT_NAMES) {
    const so = byName.get(name);
    lines.push(`### ${n}. ${name}`);
    lines.push('');
    lines.push(scenarioText[name] ?? '');
    lines.push('');
    if (so) {
      const po = so.productionOrders[0];
      const inv = so.invoices[0];
      const del = so.deliveries[0];
      const sch = po?.schedules[0];
      lines.push(`- Dealer: ${so.customer.nameEn} (\`${so.customer.code}\`)`);
      lines.push(`- Sales order: **${so.number}** (${so.status})`);
      if (po) lines.push(`- Production: **${po.number}** (${po.status})`);
      if (del) {
        const planned = ymd(del.deliveryDate);
        lines.push(
          `- Delivery: **${del.number}** (${del.status}${planned ? `, ${planned}` : ''})`,
        );
      }
      if (inv) {
        lines.push(
          `- Invoice: **${inv.number}** (${inv.status}, outstanding ${inv.outstandingAmount} ILS)`,
        );
      }
      if (sch) {
        const requested = ymd(sch.requestedDeliveryDate) ?? ymd(so.requiredDeliveryDate);
        const suggested = ymd(sch.suggestedDeliveryDate);
        const committed = ymd(sch.committedDeliveryDate) ?? ymd(po?.committedDeliveryDate);
        const factoryProjected = ymd(sch.earliestAvailableDate);
        const planned =
          del && del.status !== 'DELIVERED' && del.status !== 'CANCELLED'
            ? ymd(del.deliveryDate)
            : null;
        const actual = del?.status === 'DELIVERED' ? ymd(del.deliveryDate) : null;
        lines.push(
          `- Dates: requested ${requested ?? '—'} · suggested ${suggested ?? '—'} · committed ${committed ?? '—'} · factory earliest ${factoryProjected ?? '—'} · planned ${planned ?? '—'} · actual ${actual ?? '—'}`,
        );
      }
    } else {
      const quote = quoteRows.find((q) => q.request?.projectName === name);
      if (quote) {
        lines.push(`- Quotation: **${quote.number}** v${quote.version} (${quote.status})`);
        if (quote.request?.number) lines.push(`- RFQ: **${quote.request.number}**`);
        if (quote.acceptedBy?.username) {
          lines.push(`- Accepted by dealer \`${quote.acceptedBy.username}\``);
        }
        const linkedSo = quote.salesOrders[0];
        lines.push(
          linkedSo
            ? `- Sales order: **${linkedSo.number}** (${linkedSo.status})`
            : '- Sales order: **none** — dealer has not accepted (قبول) yet.',
        );
      } else {
        lines.push('- _Not found after reset — re-run `pnpm demo:reset`._');
      }
    }
    lines.push('');
    n += 1;
  }

  lines.push('## Commercial quotations (اعتماد vs قبول)');
  lines.push('');
  lines.push(
    'Internal **Approve** (AR **اعتماد**) is a send gate only — it never writes `ACCEPTED`, never creates a sales order, and never starts production. Dealer **Accept** (AR **قبول**) is the only commercial acceptance. Admin/Sales have no Accept button and `quotation.accept` is dealer-only. Quotations live under **Orders** / Account Places / portal `/quotations` — **Schedule / الجدول is unchanged**.',
  );
  lines.push('');
  const noorQuote = quoteRows.find((q) => q.request?.projectName === 'Noor club chair hold');
  if (noorQuote) {
    lines.push(
      `- **Noor** quote **${noorQuote.number}** v${noorQuote.version} is \`${noorQuote.status}\`${noorQuote.salesOrders[0] ? ` with SO ${noorQuote.salesOrders[0].number}` : ' with **no sales order**'}. Log in as \`noor\` to Accept.`,
    );
  }
  const oasisAccepted = await prisma.quotation.findFirst({
    where: { status: 'ACCEPTED', request: { projectName: 'Oasis revised quote accepted' } },
    select: {
      number: true,
      version: true,
      acceptedBy: { select: { username: true } },
      parentQuotation: { select: { number: true, version: true, status: true } },
      salesOrders: { select: { number: true, status: true } },
    },
  });
  if (oasisAccepted) {
    lines.push(
      `- **Oasis** revised quote **${oasisAccepted.number}** v${oasisAccepted.version} ACCEPTED by \`${oasisAccepted.acceptedBy?.username ?? '—'}\`; v1 ${oasisAccepted.parentQuotation?.status ?? 'CANCELLED'}; SO ${oasisAccepted.salesOrders[0]?.number ?? '—'} (${oasisAccepted.salesOrders[0]?.status ?? 'none'}).`,
    );
  }
  lines.push('');

  lines.push('## Dealer Schedule');
  lines.push('');
  lines.push(
    'Product: EN **Schedule** / AR **الجدول**. Mobile tab + portal `/deliveries` (Account calendar is an alias). Upcoming | Calendar. Dealers never see workers, capacity, or the factory occupancy calendar.',
  );
  lines.push('');
  lines.push(
    'Same sales order must agree on Requested / Suggested / Committed / Planned delivery / Current expected / Actual and the primary `calendarDate` across Dealer Home, Schedule, order detail, Customer Portal, and Admin customer-facing schedule fields. `calendarDate` is delivered → actual; else active logistics `deliveryDate`; else committed; else a trustworthy expected proxy; else requested. **Never** a stale historical `earliestAvailableDate`, and **never** production completion when a truck is booked.',
  );
  lines.push('');
  const nile = byName.get('Abdoun lounge set');
  const balqis = byName.get('Abdali hotel banquettes');
  const qasr = byName.get('Qasr suite dining');
  const cedar = byName.get('Cedar Italian velvet recliner');
  const jabal = byName.get('Jabal contract dining');
  const nileDel = nile?.deliveries[0];
  const balqisDel = balqis?.deliveries[0];
  const jabalSch = jabal?.productionOrders[0]?.schedules[0];
  lines.push(
    `- **Nile** ${nile?.number ?? 'SO-…'} — delivered chrome on the actual day (${ymd(nileDel?.status === 'DELIVERED' ? nileDel.deliveryDate : null) ?? 'see actual above'}).`,
  );
  lines.push(
    `- **Balqis** ${balqis?.number ?? 'SO-…'} / ${balqisDel?.number ?? 'DLV-…'} — ready; planned logistics ${ymd(balqisDel?.deliveryDate) ?? '—'}. Calendar marker is the truck day, not production suggested.`,
  );
  lines.push(
    `- **Qasr** ${qasr?.number ?? 'SO-…'} — unconfirmed. Copy is Requested / Expected · not confirmed.`,
  );
  lines.push(
    `- **Cedar** ${cedar?.number ?? 'SO-…'} / **Jabal** ${jabal?.number ?? 'SO-…'} — Cedar is unconfirmed (no committed date). Jabal is delayed: calendar stays on committed ${ymd(jabalSch?.committedDeliveryDate) ?? '—'}; no current expected (factory earliest available is stale); copy is Delayed · Schedule being updated.`,
  );
  lines.push('- Isolation: `oasis` must not see Nile sales orders.');
  lines.push('- Arabic pass: nav **الجدول**; requested labels are not **مؤكد**.');
  lines.push('- Do not invent extra demo orders for this walkthrough.');
  lines.push('');

  const out = path.join(process.cwd(), 'docs/father-demo-walkthrough.md');
  // When run from packages/database, cwd is that package — write to repo docs.
  const repoDocs = path.resolve(__dirname, '../../../../docs/father-demo-walkthrough.md');
  const target = repoDocs;
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, lines.join('\n'), 'utf8');
  void out;
  console.log(`Wrote ${target}`);
  return target;
}
