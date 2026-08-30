'use client';

import { apiFetch } from '@/lib/api-client';
import { Badge, Card, EmptyState, Skeleton, StatusBadge } from '@maher/ui';
import { useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';

type WipKit = {
  id: string;
  status: string;
  qrCode: string;
  expectedPieceCount: number;
  custody?: string | null;
  handoffCount?: number;
  pieces: Array<{ id: string }>;
  location?: { code: string; name?: string | null } | null;
  claimedByUser?: { firstName: string; lastName: string } | null;
  productionOrder: { number: string };
  stageInstance?: {
    stageDefinition?: {
      code: string;
      nameEn: string;
      nameAr: string;
      nameHe?: string | null;
    };
  };
};

type WipSection = {
  stageCode: string;
  stageNameEn: string;
  stageNameAr: string;
  stageNameHe: string | null;
  kits: WipKit[];
};

type Props = {
  productionOrderId: string;
};

function stageName(section: WipSection, locale: string): string {
  if (locale === 'ar') return section.stageNameAr || section.stageNameEn;
  if (locale === 'he') return section.stageNameHe || section.stageNameEn;
  return section.stageNameEn;
}

function directionForKit(status: string): 'outgoing' | 'incoming' | 'in_use' | 'other' {
  const s = String(status ?? '').toUpperCase();
  if (s === 'READY' || s === 'OPEN') return 'outgoing';
  if (s === 'CLAIMED') return 'incoming';
  if (s === 'CONSUMED') return 'in_use';
  return 'other';
}

export function ProductionWipPanel({ productionOrderId }: Props) {
  const tp = useTranslations('production');
  const locale = useLocale();

  const boardQuery = useQuery({
    queryKey: ['production-order-wip', productionOrderId],
    queryFn: () =>
      apiFetch<{ sections: WipSection[]; totalKits: number }>(
        `/api/v1/inventory/wip-kits/board?productionOrderId=${encodeURIComponent(productionOrderId)}&scope=active`,
      ),
    enabled: Boolean(productionOrderId),
  });

  const sections = boardQuery.data?.sections ?? [];
  const total = boardQuery.data?.totalKits ?? 0;
  const flat = sections.flatMap((s) =>
    s.kits.map((kit) => ({ kit, stage: stageName(s, locale), stageCode: s.stageCode })),
  );

  const outgoing = flat.filter(({ kit }) => directionForKit(kit.status) === 'outgoing');
  const incoming = flat.filter(({ kit }) => directionForKit(kit.status) === 'incoming');
  const other = flat.filter(({ kit }) => {
    const d = directionForKit(kit.status);
    return d !== 'outgoing' && d !== 'incoming';
  });

  function renderKitRow(
    kit: WipKit,
    stage: string,
    lane: 'outgoing' | 'incoming' | 'other',
  ) {
    const loc =
      kit.location?.name?.trim() || kit.location?.code || tp('hubWipNoBin');
    const custody =
      kit.custody ??
      (kit.status === 'READY'
        ? 'WAITING_PICKUP'
        : kit.status === 'CLAIMED'
          ? 'RECEIVED'
          : kit.status === 'OPEN'
            ? 'AT_STATION'
            : kit.status === 'CONSUMED'
              ? 'IN_USE'
              : null);
    return (
      <li
        key={kit.id}
        className="rounded-[var(--maher-radius-md)] border border-border bg-[var(--maher-surface-muted)] p-3"
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 space-y-1">
            <p className="text-xs font-semibold text-[var(--maher-brand)]">
              {lane === 'outgoing'
                ? tp('hubWipOutgoing')
                : lane === 'incoming'
                  ? tp('hubWipIncoming')
                  : tp('hubWipOther')}
              {' · '}
              {stage}
            </p>
            <p className="font-medium" dir="ltr">
              {kit.qrCode}
            </p>
            <p className="text-xs text-text-secondary" dir="ltr">
              {tp('hubWipLocation')}: {loc}
              {` · ${kit.pieces.length}/${kit.expectedPieceCount}`}
            </p>
            {custody ? (
              <p className="text-xs text-text-secondary">
                {tp('hubWipCustody')}: {custody.replace(/_/g, ' ')}
              </p>
            ) : null}
            {kit.claimedByUser ? (
              <p className="text-xs text-text-secondary">
                {tp('hubWipClaimedBy', {
                  name: `${kit.claimedByUser.firstName} ${kit.claimedByUser.lastName}`.trim(),
                })}
              </p>
            ) : null}
          </div>
          <StatusBadge status={kit.status} />
        </div>
      </li>
    );
  }

  return (
    <Card className="space-y-4 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--maher-brand)]">
            {tp('hubWipEyebrow')}
          </p>
          <h2 className="text-base font-semibold">{tp('hubWip')}</h2>
          <p className="text-sm text-text-secondary">{tp('hubWipHint')}</p>
        </div>
        {total > 0 ? <Badge>{total}</Badge> : null}
      </div>

      {boardQuery.isLoading ? (
        <Skeleton className="h-24 w-full" />
      ) : boardQuery.isError ? (
        <p className="text-sm text-[var(--maher-error)]">{tp('hubWipError')}</p>
      ) : flat.length === 0 ? (
        <EmptyState title={tp('hubWipEmptyTitle')} description={tp('hubWipEmptyBody')} />
      ) : (
        <div className="space-y-4">
          {outgoing.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">
                {tp('hubWipOutgoingSection')}
              </p>
              <ul className="space-y-2">
                {outgoing.map(({ kit, stage }) => renderKitRow(kit, stage, 'outgoing'))}
              </ul>
            </div>
          ) : null}
          {incoming.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">
                {tp('hubWipIncomingSection')}
              </p>
              <ul className="space-y-2">
                {incoming.map(({ kit, stage }) => renderKitRow(kit, stage, 'incoming'))}
              </ul>
            </div>
          ) : null}
          {other.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">
                {tp('hubWipOtherSection')}
              </p>
              <ul className="space-y-2">
                {other.map(({ kit, stage }) => renderKitRow(kit, stage, 'other'))}
              </ul>
            </div>
          ) : null}
        </div>
      )}
    </Card>
  );
}
