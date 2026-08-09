import type { Href } from 'expo-router';

/** Map API `linkUrl` paths to in-app Expo routes. */
export function mapNotificationLinkToHref(linkUrl: string | null): Href | null {
  if (!linkUrl) return null;
  const path = linkUrl.replace(/^https?:\/\/[^/]+/, '');
  if (path.startsWith('/sales-orders/')) {
    return `/(app)/(admin)/orders/${path.split('/').pop()}` as Href;
  }
  if (path.startsWith('/invoices/')) {
    return `/(app)/(admin)/invoices/${path.split('/').pop()}` as Href;
  }
  if (path.startsWith('/returns/')) {
    return `/(app)/(admin)/returns/${path.split('/').pop()}` as Href;
  }
  if (path.startsWith('/ai-intake/')) {
    return `/(app)/(admin)/ai-intake/${path.split('/').pop()}` as Href;
  }
  if (path.startsWith('/tasks/')) {
    return `/(app)/(employee)/tasks/${path.split('/').pop()}` as Href;
  }
  if (path.startsWith('/requests/')) {
    return '/(app)/(admin)/requests' as Href;
  }
  if (path.includes('account/statement')) {
    return '/(app)/(customer)/account/statement' as Href;
  }
  return null;
}
