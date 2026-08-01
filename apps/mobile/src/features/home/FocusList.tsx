import type { HomePersona } from '@maher/permissions';
import { localizedName } from '@maher/i18n';
import { useI18n } from '../../providers/i18n-provider';
import { daysUntil, formatDate, formatMoney, relativeDay } from '../../lib/format';
import { useNav } from '../../lib/nav';
import { colors } from '../../theme/tokens';
import { EmptyState } from '../../ui/States';
import { ListRow } from '../../ui/ListRow';
import { ProgressBar } from '../../ui/ProgressBar';
import { Section } from '../../ui/Screen';
import { StatusBadge } from '../../ui/StatusBadge';
import { Text } from '../../ui/Text';
import type { useHomeData } from './use-home-data';

type Data = ReturnType<typeof useHomeData>;

const LIMIT = 5;

/**
 * The "what should I do next" list. Content and ordering differ per persona so
 * the first screen after login is always actionable.
 */
export function FocusList({ persona, data }: { persona: HomePersona; data: Data }) {
  const { t, locale } = useI18n();
  const router = useNav();

  const dueLabel = (value: string | null | undefined) =>
    relativeDay(daysUntil(value), t, 'due');

  if (persona === 'production_worker' || persona === 'production_supervisor') {
    const rows = [...data.tasks.rows]
      .filter((task) => !['COMPLETED', 'CANCELLED'].includes(task.status))
      .sort(sortByDue((t2) => t2.plannedCompletion))
      .slice(0, LIMIT);

    return (
      <Section
        title={t('mobile.myTasks', 'My tasks')}
        action={<SeeAll onPress={() => router.push('/tasks')} />}
      >
        {rows.length === 0 ? (
          <EmptyState title={t('mobile.noTasks', 'No tasks assigned')} />
        ) : (
          rows.map((task) => (
            <ListRow
              key={task.id}
              title={
                task.stageDefinition
                  ? localizedName(locale, task.stageDefinition, task.name)
                  : task.name
              }
              meta={`${task.number} · ${task.productionOrder?.number ?? '—'}`}
              description={dueLabel(task.plannedCompletion)}
              right={<StatusBadge status={task.status} />}
              onPress={() => router.push(`/tasks/${task.id}`)}
              footer={
                <>
                  <ProgressBar percent={Number(task.progressPercent ?? 0)} />
                  <Text variant="micro" color="tertiary" latin style={{ marginTop: 4 }}>
                    {Number(task.progressPercent ?? 0)}%
                  </Text>
                </>
              }
            />
          ))
        )}
      </Section>
    );
  }

  if (persona === 'quality') {
    const rows = data.inspections.rows
      .filter((i) => ['PENDING', 'READY_FOR_INSPECTION', 'IN_PROGRESS'].includes(i.status))
      .slice(0, LIMIT);
    return (
      <Section
        title={t('mobile.inspectionQueue', 'Inspection queue')}
        action={<SeeAll onPress={() => router.push('/quality')} />}
      >
        {rows.length === 0 ? (
          <EmptyState title={t('mobile.noInspections', 'No pending inspections')} />
        ) : (
          rows.map((row) => (
            <ListRow
              key={row.id}
              title={row.productionOrder?.number ?? row.number}
              meta={`${row.number} · ${formatDate(row.createdAt)}`}
              right={<StatusBadge status={row.status} />}
              onPress={() => router.push('/quality')}
            />
          ))
        )}
      </Section>
    );
  }

  if (persona === 'delivery') {
    const rows = [...data.deliveries.rows]
      .filter((d) => !['DELIVERED', 'CANCELLED', 'FAILED'].includes(d.status))
      .sort(sortByDue((d) => d.scheduledDate))
      .slice(0, LIMIT);
    return (
      <Section
        title={t('mobile.todayRoute', "Today's route")}
        action={<SeeAll onPress={() => router.push('/deliveries')} />}
      >
        {rows.length === 0 ? (
          <EmptyState title={t('mobile.noDeliveries', 'No deliveries scheduled')} />
        ) : (
          rows.map((row) => (
            <ListRow
              key={row.id}
              title={localizedName(locale, row.customer, row.number)}
              meta={`${row.number} · ${formatDate(row.scheduledDate)}`}
              description={dueLabel(row.scheduledDate)}
              right={<StatusBadge status={row.status} />}
              onPress={() => router.push(`/deliveries/${row.id}`)}
            />
          ))
        )}
      </Section>
    );
  }

  if (persona === 'warehouse') {
    const rows = data.lowStock.rows.slice(0, LIMIT);
    return (
      <Section
        title={t('mobile.lowStock', 'Low stock')}
        action={<SeeAll onPress={() => router.push('/inventory')} />}
      >
        {rows.length === 0 ? (
          <EmptyState title={t('mobile.stockHealthy', 'All items above minimum')} />
        ) : (
          rows.map((row) => (
            <ListRow
              key={row.id}
              title={localizedName(locale, row, row.sku)}
              meta={row.sku}
              description={`${t('inventory.available', 'Available')}: ${Number(row.availableQty)} / ${t('inventory.minStock', 'Min')}: ${Number(row.minStock)}`}
              right={<StatusBadge status="LOW" tone="warning" />}
              accent={colors.warning}
              onPress={() => router.push('/inventory')}
            />
          ))
        )}
      </Section>
    );
  }

  if (persona === 'purchasing') {
    const rows = data.purchaseOrders.rows
      .filter((p) => !['RECEIVED', 'CANCELLED', 'CLOSED'].includes(p.status))
      .slice(0, LIMIT);
    return (
      <Section
        title={t('mobile.openPurchaseOrders', 'Open purchase orders')}
        action={<SeeAll onPress={() => router.push('/purchasing')} />}
      >
        {rows.length === 0 ? (
          <EmptyState title={t('mobile.noPurchaseOrders', 'No open purchase orders')} />
        ) : (
          rows.map((row) => (
            <ListRow
              key={row.id}
              title={localizedName(locale, row.supplier, row.number)}
              meta={`${row.number} · ${formatMoney(row.totalAmount)}`}
              right={<StatusBadge status={row.status} />}
              onPress={() => router.push('/purchasing')}
            />
          ))
        )}
      </Section>
    );
  }

  if (persona === 'accounting') {
    const rows = data.invoices.rows
      .filter((i) => i.status !== 'PAID' && i.status !== 'VOID')
      .sort(sortByDue((i) => i.dueDate))
      .slice(0, LIMIT);
    return (
      <Section
        title={t('mobile.invoicesToCollect', 'Invoices to collect')}
        action={<SeeAll onPress={() => router.push('/invoices')} />}
      >
        {rows.length === 0 ? (
          <EmptyState title={t('mobile.allInvoicesPaid', 'Nothing outstanding')} />
        ) : (
          rows.map((row) => (
            <ListRow
              key={row.id}
              title={localizedName(locale, row.customer, row.number)}
              meta={`${row.number} · ${formatMoney(row.totalAmount)}`}
              description={dueLabel(row.dueDate)}
              right={<StatusBadge status={row.status} />}
              onPress={() => router.push(`/invoices/${row.id}`)}
            />
          ))
        )}
      </Section>
    );
  }

  if (persona === 'customer') {
    const quotes = data.quotations.rows
      .filter((q) => ['SENT', 'VIEWED'].includes(q.status))
      .slice(0, 3);
    const orders = data.salesOrders.rows
      .filter((o) => !['COMPLETED', 'CANCELLED'].includes(o.status))
      .slice(0, 3);
    return (
      <>
        <Section
          title={t('mobile.quotationsToReview', 'Quotations to review')}
          action={<SeeAll onPress={() => router.push('/quotations')} />}
        >
          {quotes.length === 0 ? (
            <EmptyState title={t('mobile.noQuotations', 'Nothing to review')} />
          ) : (
            quotes.map((q) => (
              <ListRow
                key={q.id}
                title={q.number}
                meta={formatMoney(q.totalAmount, q.currency ?? 'JOD')}
                description={
                  q.validUntil
                    ? `${t('quotations.validUntil', 'Valid until')} ${formatDate(q.validUntil)}`
                    : undefined
                }
                right={<StatusBadge status={q.status} />}
                onPress={() => router.push(`/quotations/${q.id}`)}
              />
            ))
          )}
        </Section>
        <Section
          title={t('mobile.myOrders', 'My orders')}
          action={<SeeAll onPress={() => router.push('/sales-orders')} />}
        >
          {orders.length === 0 ? (
            <EmptyState title={t('mobile.noOrders', 'No active orders')} />
          ) : (
            orders.map((o) => (
              <ListRow
                key={o.id}
                title={o.number}
                meta={formatMoney(o.totalAmount)}
                description={dueLabel(o.requestedDeliveryDate)}
                right={<StatusBadge status={o.status} />}
                onPress={() => router.push(`/sales-orders/${o.id}`)}
              />
            ))
          )}
        </Section>
      </>
    );
  }

  // sales, management, admin and generic all benefit from the approval queue.
  const pending = data.quotations.rows
    .filter((q) => ['PENDING_APPROVAL', 'INTERNAL_REVIEW', 'SENT', 'VIEWED'].includes(q.status))
    .slice(0, LIMIT);
  const newRequests = data.requests.rows
    .filter((r) => ['SUBMITTED', 'UNDER_REVIEW', 'READY_FOR_QUOTATION'].includes(r.status))
    .slice(0, 3);

  return (
    <>
      {newRequests.length > 0 ? (
        <Section
          title={t('mobile.incomingRequests', 'Incoming requests')}
          action={<SeeAll onPress={() => router.push('/requests')} />}
        >
          {newRequests.map((r) => (
            <ListRow
              key={r.id}
              title={localizedName(locale, r.customer, r.number)}
              meta={`${r.number} · ${formatDate(r.createdAt)}`}
              right={<StatusBadge status={r.status} />}
              onPress={() => router.push(`/requests/${r.id}`)}
            />
          ))}
        </Section>
      ) : null}
      <Section
        title={t('mobile.quotationPipeline', 'Quotation pipeline')}
        action={<SeeAll onPress={() => router.push('/quotations')} />}
      >
        {pending.length === 0 ? (
          <EmptyState title={t('mobile.noQuotations', 'Nothing pending')} />
        ) : (
          pending.map((q) => (
            <ListRow
              key={q.id}
              title={localizedName(locale, q.customer, q.number)}
              meta={`${q.number} · ${formatMoney(q.totalAmount, q.currency ?? 'JOD')}`}
              right={<StatusBadge status={q.status} />}
              onPress={() => router.push(`/quotations/${q.id}`)}
            />
          ))
        )}
      </Section>
    </>
  );
}

function SeeAll({ onPress }: { onPress: () => void }) {
  const { t } = useI18n();
  return (
    <Text variant="caption" color="brand" onPress={onPress}>
      {t('common.viewAll', 'View all')}
    </Text>
  );
}

/** Nulls last, soonest first. */
function sortByDue<T>(pick: (row: T) => string | null | undefined) {
  return (a: T, b: T) => {
    const da = pick(a);
    const db = pick(b);
    if (!da && !db) return 0;
    if (!da) return 1;
    if (!db) return -1;
    return new Date(da).getTime() - new Date(db).getTime();
  };
}
