import { promises as fs } from 'fs';
import path from 'path';
import type { PrismaClient } from '@prisma/client';
import { demoAsOf } from './clock';

export const FLAGSHIP_PROJECT_NAMES = [
  'Abdoun lounge set',
  'Sweifieh sectional',
  'Abdali hotel banquettes',
  'Cedar Italian velvet recliner',
  'Diwan wingback foam gate',
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

  const lines: string[] = [
    '# Father demo walkthrough',
    '',
    `**As of:** ${asOf} (Asia/Amman) · password \`123\``,
    '',
    'Use these **real seeded numbers** after `pnpm demo:reset`. Logins: `admin` (factory), `nile` / `oasis` / `balqis` (dealers), `carpenter` / `inspector` (floor).',
    '',
    '## Scenarios',
    '',
  ];

  const byName = new Map(rows.map((r) => [r.projectName ?? '', r]));
  const scenarioText: Record<string, string> = {
    'Abdoun lounge set':
      '**Delivered commercial history.** Admin: sales order → production snapshot → QC pass → delivery → paid invoice. Dealer `nile`: Schedule tab shows Delivered on the actual day. Worker: completed tasks.',
    'Sweifieh sectional':
      '**Live production.** Oasis L-sectional mid-flow (parallel foam template). Admin scheduling + worker tasks. Dealer sees committed/suggested dates, not carpentry dates.',
    'Abdali hotel banquettes':
      '**Ready for delivery.** Balqis hospitality qty 6. Admin deliveries planned; dealer Schedule calendar uses the planned logistics day, not production completion.',
    'Cedar Italian velvet recliner':
      '**Material at-risk.** Waiting for inbound Italian velvet PO. Admin may-be-late / materials. Dealer has no committed date yet — Requested / Expected · not confirmed. Factory workers and capacity stay hidden. No started floor tasks.',
    'Diwan wingback foam gate':
      '**WIP at-risk.** Frame done; foam/upholstery gated. Scheduling NEEDS_REVIEW with WIP_NOT_READY.',
    'Jabal contract dining':
      '**Committed date vs capacity.** Approved plan cannot meet the committed delivery. Late chip from canonical classifier. Dealer calendar stays on the committed day. A past factory earliest-available date is not shown as current expected — copy is Delayed · Schedule being updated.',
    'Oasis club armchair QC':
      '**Current rework.** Inspection failed; rework awaiting stage; PO on hold. Must not appear delivered.',
    'Nile loveseat recovered':
      '**Historical rework.** Fail → completed rework → later pass → delivered. Partial payment.',
    'Zaatar ottoman scuff':
      '**Dealer return.** Delivered ottomans with an approved delivery-damage return.',
    'Qasr suite dining':
      '**Schedule awaiting approval.** Proposed plan — dealer Schedule shows Requested / Expected · not confirmed, not a fake confirmed date.',
    'Noor club chair hold':
      '**Draft sales order.** Quote sent; SO still DRAFT — no production yet.',
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
      lines.push('- _Not found after reset — re-run `pnpm demo:reset`._');
    }
    lines.push('');
    n += 1;
  }

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
