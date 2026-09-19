'use client';

import {
  deriveProductionLifecycle,
  productionLifecycleSteps,
  type ProductionLifecycleStep,
} from '@/lib/production-lifecycle';
import { cn } from '@maher/ui';
import { useTranslations } from 'next-intl';

type StageRow = {
  status: string;
  stageDefinition: { code: string; nameEn: string; nameAr: string };
};

type Props = {
  poStatus: string;
  currentStageCode?: string | null;
  stages?: StageRow[];
  deliveryStatus?: string | null;
  className?: string;
};

function stepLabel(step: ProductionLifecycleStep, tl: ReturnType<typeof useTranslations>): string {
  switch (step) {
    case 'production':
      return tl('timelineProduction');
    case 'inspection':
      return tl('timelineInspection');
    case 'packaging':
      return tl('timelinePackaging');
    case 'ready':
      return tl('readyForDelivery');
    case 'shipped':
      return tl('shipped');
    case 'delivered':
      return tl('tabs.delivered');
    default:
      return step;
  }
}

function factoryHint(
  step: ProductionLifecycleStep,
  current: ProductionLifecycleStep,
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
  step: ProductionLifecycleStep,
  current: ProductionLifecycleStep,
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

export function ProductionLifecyclePanel({
  poStatus,
  currentStageCode,
  stages,
  deliveryStatus,
  className,
}: Props) {
  const tl = useTranslations('lifecycle');
  const current = deriveProductionLifecycle({
    poStatus,
    currentStageCode,
    stages,
    deliveryStatus,
  });
  const steps = productionLifecycleSteps();
  const currentIdx = steps.indexOf(current);

  return (
    <section
      className={cn('rounded-xl border border-border bg-surface p-4', className)}
      aria-label={tl('timelineProduction')}
    >
      <h2 className="mb-3 text-sm font-semibold text-text-primary">
        {tl('timelineProduction')}
      </h2>
      <ol className="flex flex-wrap items-start gap-2">
        {steps.map((step, idx) => {
          const done = idx < currentIdx;
          const active = step === current;
          const hint = factoryHint(step, current, tl);
          const delHint = deliveryHint(step, current, tl);
          return (
            <li key={step} className="flex min-w-0 flex-1 flex-col items-stretch gap-1">
              <div
                className={cn(
                  'rounded-lg border px-2 py-2 text-center text-xs font-medium transition',
                  done && 'border-brand/30 bg-brand/5 text-brand',
                  active && 'border-brand bg-[var(--maher-brand-soft)] text-brand shadow-sm',
                  !done && !active && 'border-border bg-surface-secondary text-text-tertiary',
                )}
              >
                {stepLabel(step, tl)}
              </div>
              {active && (hint || delHint) ? (
                <div className="space-y-0.5 px-1 text-[10px] leading-snug text-text-secondary">
                  {hint ? <p>{hint}</p> : null}
                  {delHint ? <p className="text-text-tertiary">{delHint}</p> : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
