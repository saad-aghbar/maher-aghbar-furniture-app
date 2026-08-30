import type { Href } from 'expo-router';

/** Resolve a global search hit to an in-app route (never the retired /search page). */
export function searchHitHref(
  type: string,
  id: string,
  userCustomerId?: string | null,
): Href {
  switch (type) {
    case 'product':
      return (userCustomerId
        ? `/(app)/(customer)/catalog/${id}`
        : `/(app)/(admin)/products/${id}`) as Href;
    case 'sales_order':
      return (userCustomerId
        ? `/(app)/(customer)/orders/${id}`
        : `/(app)/(admin)/orders/${id}`) as Href;
    case 'invoice':
      return (userCustomerId
        ? `/(app)/(customer)/invoices/${id}`
        : `/(app)/(admin)/invoices/${id}`) as Href;
    case 'inventory':
      return `/(app)/(admin)/inventory/items/${id}` as Href;
    case 'request':
      return (userCustomerId
        ? `/(app)/(customer)/requests`
        : `/(app)/(admin)/requests/${id}`) as Href;
    case 'customer':
      return `/(app)/(admin)/dealers/${id}` as Href;
    default:
      return '/(app)/(admin)/(tabs)' as Href;
  }
}
