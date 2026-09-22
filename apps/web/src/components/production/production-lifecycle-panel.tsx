'use client';

import {
  deriveProductionLifecycle,
  productionLifecycleSteps,
  type ProductionLifecycleStep,
} from '@/lib/production-lifecycle';
import { StageStrip, cn, type StageStripStage } from '@maher/ui';
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
  const blocked = poStatus === 'ON_HOLD' || poStatus === 'WAITING_FOR_MATERIALS';
  const items: StageStripStage[] = steps.map((step, idx) => {
    const active = step === current;
    const hint = active ? factoryHint(step, current, tl) ?? deliveryHint(step, current, tl) : null;
    return {
      key: step,
      label: stepLabel(step, tl),
      state: idx < currentIdx ? 'done' : active ? (blocked ? 'blocked' : 'current') : 'todo',
      meta: hint ?? undefined,
    };
  });

  return (
    <div className={cn('px-5 py-4', className)} aria-label={tl('timelineProduction')}>
      <StageStrip stages={items} />
    </div>
  );
}
