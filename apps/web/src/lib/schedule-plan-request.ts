export function schedulePlanRequest(
  kind: 'preview' | 'apply',
  productionOrderId: string,
  draftStartYmd: string,
): { path: string; method: 'POST'; body?: { plannedStartDate: string } } {
  if (kind === 'preview') {
    return {
      path: `/api/v1/scheduling/orders/${productionOrderId}/generate`,
      method: 'POST',
    };
  }
  return {
    path: `/api/v1/production-orders/${productionOrderId}/suggest-plan-schedule`,
    method: 'POST',
    body: { plannedStartDate: `${draftStartYmd}T12:00:00.000Z` },
  };
}
