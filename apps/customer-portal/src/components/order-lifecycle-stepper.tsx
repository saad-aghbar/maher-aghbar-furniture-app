'use client';

import {
  deriveOrderLifecycle,
  orderLifecycleSteps,
  stepLabelKey,
  type OrderLifecycleStep,
} from '@/lib/order-lifecycle';
import { cn } from '@maher/ui';
import { useTranslations } from 'next-intl';

type Props = {
  salesOrderStatus: string;
  deliveryStatus?: string | null;
  productionOrders?: Array<{
    status?: string;
    currentStageCode?: string | null;
    progressPercent?: number | null;
  }>;
  className?: string;
};

function factoryHint(
  step: OrderLifecycleStep,
  current: OrderLifecycleStep,
  tl: ReturnType<typeof useTranslations>,
): string | null {
  if (step !== current) return null;
  switch (step) {
    case 'ready':
      return tl('factoryStoredInFg');
    case 'shipped':
      return tl('leftFactory');
    case 'delivered':
      return tl('deliveryConfirmedByDealer');
    case 'packaging':
      return tl('factoryFinished');
    default:
      return null;
  }
}

function deliveryHint(
  step: OrderLifecycleStep,
  current: OrderLifecycleStep,
  tl: ReturnType<typeof useTranslations>,
): string | null {
  if (step !== current) return null;
  switch (step) {
    case 'ready':
      return tl('deliveryReady');
    case 'shipped':
      return tl('shippedAwaitingConfirm');
    case 'delivered':
      return tl('deliveryDelivered');
    default:
      return null;
  }
}

export function OrderLifecycleStepper({
  salesOrderStatus,
  deliveryStatus,
  productionOrders,
  className,
}: Props) {
  const tl = useTranslations('lifecycle');
  const current = deriveOrderLifecycle({
    salesOrderStatus,
    deliveryStatus,
    productionOrders,
  });
  const steps = orderLifecycleSteps();
  const currentIdx = steps.indexOf(current);

  return (
    <section
      className={cn('rounded-2xl border border-border bg-surface p-4 shadow-sm', className)}
      aria-label={tl('timelineProduction')}
    >
      <h2 className="mb-3 text-sm font-semibold text-text-primary">{tl('timelineProduction')}</h2>
      <ol className="flex flex-wrap items-start gap-2">
        {steps.map((step, idx) => {
          const done = idx < currentIdx;
          const active = step === current;
          const factory = factoryHint(step, current, tl);
          const hint = deliveryHint(step, current, tl);
          return (
            <li key={step} className="flex min-w-[4.5rem] flex-1 flex-col gap-1">
              <div
                className={cn(
                  'rounded-lg border px-2 py-2 text-center text-xs font-medium',
                  done && 'border-brand/30 bg-brand/5 text-brand',
                  active && 'border-brand bg-[var(--maher-brand-soft)] text-brand shadow-sm',
                  !done && !active && 'border-border bg-surface-secondary text-text-tertiary',
                )}
              >
                {tl(stepLabelKey(step))}
              </div>
              {active && (factory || hint) ? (
                <div className="space-y-0.5 px-0.5 text-center text-[10px] leading-snug text-text-secondary">
                  {factory ? <p>{factory}</p> : null}
                  {hint ? <p>{hint}</p> : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
