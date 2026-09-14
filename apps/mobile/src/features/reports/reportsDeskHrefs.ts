import type { Href } from 'expo-router';
import type { CostDateBasis } from './reportsPeriod';
import type { CostDesk } from './costFilters';

export function reportsDeskHref(desk: CostDesk): Href {
  if (desk === 'money') return '/(app)/(admin)/reports' as Href;
  return `/(app)/(admin)/reports/${desk}` as Href;
}

export function reportsPeriodParams(input: {
  from: string;
  to: string;
  dateBasis: CostDateBasis;
}): Record<string, string> {
  return { from: input.from, to: input.to, dateBasis: input.dateBasis };
}

export function orderDossierHref(
  id: string,
  period: { from: string; to: string; dateBasis: CostDateBasis },
): Href {
  const qs = new URLSearchParams(reportsPeriodParams(period)).toString();
  return `/(app)/(admin)/reports/order/${id}?${qs}` as Href;
}

export function returnDossierHref(
  id: string,
  period: { from: string; to: string; dateBasis: CostDateBasis },
): Href {
  const qs = new URLSearchParams(reportsPeriodParams(period)).toString();
  return `/(app)/(admin)/reports/returns/${id}?${qs}` as Href;
}

export function productProfileHref(
  productId: string,
  period: { from: string; to: string; dateBasis: CostDateBasis },
): Href {
  const qs = new URLSearchParams(reportsPeriodParams(period)).toString();
  return `/(app)/(admin)/reports/products/${productId}?${qs}` as Href;
}

export function variantProfileHref(
  productId: string,
  variantId: string,
  period: { from: string; to: string; dateBasis: CostDateBasis },
): Href {
  const qs = new URLSearchParams(reportsPeriodParams(period)).toString();
  return `/(app)/(admin)/reports/products/${productId}/variants/${variantId}?${qs}` as Href;
}

export function inventoryItemHref(
  itemId: string,
  period: { from: string; to: string; dateBasis: CostDateBasis },
): Href {
  const qs = new URLSearchParams(reportsPeriodParams(period)).toString();
  return `/(app)/(admin)/reports/inventory/${itemId}?${qs}` as Href;
}

export function coverageIssuesHref(
  type: string,
  period: { from: string; to: string; dateBasis: CostDateBasis },
): Href {
  const qs = new URLSearchParams({ ...reportsPeriodParams(period), type }).toString();
  return `/(app)/(admin)/reports/coverage/${type}?${qs}` as Href;
}

export function ordersDeskHref(params: Record<string, string | undefined>): Href {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) qs.set(key, value);
  }
  const suffix = qs.toString();
  return (`/(app)/(admin)/reports/orders${suffix ? `?${suffix}` : ''}`) as Href;
}
