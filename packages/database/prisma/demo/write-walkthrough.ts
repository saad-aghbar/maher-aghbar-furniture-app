import { promises as fs } from 'fs';
import path from 'path';
import type { PrismaClient } from '@prisma/client';
import { demoAsOf } from './clock';

/** Compact flagship cast — matches stories.ts / EXPECTED_FLAGSHIP in validate.ts. */
export const FLAGSHIP_PROJECT_NAMES = [
  'Abdoun lounge set',
  'Sweifieh sectional',
  'Nile blank production start',
  'Golden factory path',
  'Oasis Italian velvet sofa',
  'Oasis club armchair QC',
  'Oasis armchair scuff',
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
    'Use these **real seeded numbers** after `pnpm demo:reset`. Logins: `admin` (factory), `nile` / `oasis` (dealers), `carpenter` / `inspector` (floor).',
    '',
    '**Compact demo world:** nile + oasis only · Model 204 / Luna / Classic Chair / Queen bed · `SO-GOLDEN-001` · `SO-FB1042` · `RT-DEMO-001` · `PORD-DEMO-LATE` · low-stock `MAT-BEECH`.',
    '',
    '## Scenarios',
    '',
  ];

  const byName = new Map(rows.map((r) => [r.projectName ?? '', r]));
  const scenarioText: Record<string, string> = {
    'Abdoun lounge set':
      '**Delivered commercial history.** Admin: sales order → production snapshot → QC pass → delivery → paid invoice. Dealer `nile`: Schedule tab shows Delivered on the actual day.',
    'Sweifieh sectional':
      '**Live production + multi-item basket.** Oasis Luna corner + chairs + bed mid-flow. Admin scheduling + worker tasks. Dealer sees committed/suggested dates, not carpentry dates.',
    'Nile blank production start':
      '**Just entered production — empty floor.** Two-line basket; first stages READY, **0%** progress. Use Admin Orders → In production → this SO for production setup checks.',
    'Golden factory path':
      '**Released multi-kind basket (`SO-GOLDEN-001`).** Four manufacturing kinds on one sales order (STD qty2, KARINA STANDARD, MODIFIED width 280, CUSTOM photo). Staggered sub-order progress for My Tasks.',
    'Oasis Italian velvet sofa':
      '**Material at-risk / may-be-late.** Waiting for inbound Italian velvet. Admin may-be-late / materials. Dealer has no committed date yet.',
    'Oasis club armchair QC':
      '**Current rework.** Inspection failed; rework awaiting stage; PO on hold. Must not appear delivered.',
    'Oasis armchair scuff':
      '**Dealer return.** Delivered armchairs with an approved delivery-damage return.',
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
  const oasisAccepted = await prisma.quotation.findFirst({
    where: { status: 'ACCEPTED', request: { projectName: { in: [...FLAGSHIP_PROJECT_NAMES] } } },
    select: {
      number: true,
      version: true,
      acceptedBy: { select: { username: true } },
      parentQuotation: { select: { number: true, version: true, status: true } },
      salesOrders: { select: { number: true, status: true } },
      request: { select: { projectName: true } },
    },
  });
  if (oasisAccepted) {
    lines.push(
      `- **${oasisAccepted.request?.projectName ?? 'Flagship'}** quote **${oasisAccepted.number}** v${oasisAccepted.version} ACCEPTED by \`${oasisAccepted.acceptedBy?.username ?? '—'}\`; SO ${oasisAccepted.salesOrders[0]?.number ?? '—'} (${oasisAccepted.salesOrders[0]?.status ?? 'none'}).`,
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
  const golden = byName.get('Golden factory path');
  const oasisAtRisk = byName.get('Oasis Italian velvet sofa');
  const nileDel = nile?.deliveries[0];
  const oasisSch = oasisAtRisk?.productionOrders[0]?.schedules[0];
  lines.push(
    `- **Nile** ${nile?.number ?? 'SO-…'} — delivered chrome on the actual day (${ymd(nileDel?.status === 'DELIVERED' ? nileDel.deliveryDate : null) ?? 'see actual above'}).`,
  );
  lines.push(
    `- **Golden** ${golden?.number ?? 'SO-GOLDEN-001'} — in production with four-line STD / KARINA / MODIFIED / CUSTOM mix.`,
  );
  lines.push(
    `- **Oasis Italian velvet** ${oasisAtRisk?.number ?? 'SO-…'} — material at-risk / may-be-late; requested ${ymd(oasisSch?.requestedDeliveryDate) ?? ymd(oasisAtRisk?.requiredDeliveryDate) ?? '—'}; committed ${ymd(oasisSch?.committedDeliveryDate) ?? '—'}.`,
  );
  lines.push('- Isolation: `oasis` must not see Nile sales orders.');
  lines.push('- Arabic pass: nav **الجدول**; requested labels are not **مؤكد**.');
  lines.push('- Do not invent extra demo orders for this walkthrough.');
  lines.push('');

  const repoDocs = path.resolve(__dirname, '../../../../docs/father-demo-walkthrough.md');
  const target = repoDocs;
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, lines.join('\n'), 'utf8');
  console.log(`Wrote ${target}`);
  return target;
}
