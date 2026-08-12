'use client';

import { apiFetch } from '@/lib/api-client';
import { Alert, Card, Ltr, Skeleton } from '@maher/ui';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';

export interface AvailabilityItemInput {
  productId: string;
  quantity: number;
}

export interface AvailabilityResult {
  estimateStatus: 'CALCULATED' | 'PRELIMINARY' | 'UNAVAILABLE';
  earliestAvailableDate: string | null;
  requestedDateFeasible: boolean;
  suggestedDeliveryDate: string | null;
  alternativeDates: string[];
  estimateConfidence: 'LOW' | 'MEDIUM' | 'HIGH';
  requiresAdminEstimateReview: boolean;
}

function toDateOnly(value: string | null | undefined) {
  if (!value) return null;
  return value.slice(0, 10);
}

/**
 * Dealer-safe production availability check. Never surfaces workers,
 * departments, or capacity — only commercial dates and confidence.
 */
export function AvailabilityCard({
  items,
  requestedDeliveryDate,
}: {
  items: AvailabilityItemInput[];
  requestedDeliveryDate?: string;
}) {
  const tc = useTranslations('catalog');
  const validItems = items.filter((i) => i.productId && i.quantity > 0);
  const queryKey = [
    'scheduling-availability',
    validItems.map((i) => `${i.productId}:${i.quantity}`).join(','),
    requestedDeliveryDate ?? '',
  ];

  const { data, isLoading, isError } = useQuery({
    queryKey,
    enabled: validItems.length > 0,
    queryFn: () =>
      apiFetch<AvailabilityResult>('/api/v1/scheduling/availability', {
        method: 'POST',
        body: JSON.stringify({
          items: validItems,
          requestedDeliveryDate: requestedDeliveryDate || undefined,
        }),
      }),
    staleTime: 30_000,
  });

  if (validItems.length === 0) return null;

  return (
    <Card title={tc('availabilityTitle')} className="maher-form-section">
      {isLoading ? (
        <Skeleton className="h-16 w-full rounded-xl" />
      ) : isError || !data || data.estimateStatus === 'UNAVAILABLE' ? (
        <Alert variant="info">{tc('availabilityUnavailable')}</Alert>
      ) : (
        <div className="space-y-3 text-sm">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-xs text-text-tertiary">{tc('availabilityEarliestDate')}</p>
              <p className="mt-0.5 font-semibold tracking-tight" dir="ltr">
                {toDateOnly(data.earliestAvailableDate) ?? '—'}
              </p>
            </div>
            {requestedDeliveryDate ? (
              <div>
                <p className="text-xs text-text-tertiary">{tc('availabilityRequestedFeasible')}</p>
                <p className="mt-0.5 font-semibold tracking-tight">
                  {data.requestedDateFeasible
                    ? tc('availabilityFeasibleYes')
                    : tc('availabilityFeasibleNo')}
                </p>
              </div>
            ) : null}
          </div>

          {!data.requestedDateFeasible && data.suggestedDeliveryDate ? (
            <Alert variant="warning">
              {tc('availabilitySuggestedInstead')}{' '}
              <Ltr className="font-semibold">{toDateOnly(data.suggestedDeliveryDate)}</Ltr>
            </Alert>
          ) : null}

          {data.alternativeDates.length > 0 ? (
            <div>
              <p className="mb-1 text-xs text-text-tertiary">{tc('availabilityAlternativeDates')}</p>
              <div className="flex flex-wrap gap-2">
                {data.alternativeDates.map((d) => (
                  <span
                    key={d}
                    className="rounded-full border border-border bg-[var(--maher-surface-muted)] px-2.5 py-1 text-xs"
                    dir="ltr"
                  >
                    {toDateOnly(d)}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          {data.estimateStatus === 'PRELIMINARY' ? (
            <p className="text-xs text-text-tertiary">{tc('availabilityPreliminaryHint')}</p>
          ) : null}
        </div>
      )}
    </Card>
  );
}
