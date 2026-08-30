import type { Href } from 'expo-router';
import type { AppSurface } from '@maher/permissions';

function lastSegment(path: string): string {
  const parts = path.split('/').filter(Boolean);
  return parts[parts.length - 1] ?? '';
}

/**
 * Map API `linkUrl` paths to in-app Expo routes.
 * When `surface` is `customer`, never route into `(admin)`.
 */
export function mapNotificationLinkToHref(
  linkUrl: string | null,
  surface: AppSurface = 'admin',
): Href | null {
  if (!linkUrl) return null;
  const path = linkUrl.replace(/^https?:\/\/[^/]+/, '');
  const id = lastSegment(path);

  if (path.startsWith('/sales-orders/') || path.startsWith('/orders/')) {
    if (surface === 'customer') {
      return `/(app)/(customer)/orders/${id}` as Href;
    }
    return `/(app)/(admin)/orders/${id}` as Href;
  }

  if (path.startsWith('/invoices/')) {
    if (surface === 'customer') {
      return `/(app)/(customer)/invoices/${id}` as Href;
    }
    return `/(app)/(admin)/invoices/${id}` as Href;
  }

  if (path.startsWith('/returns/')) {
    if (surface === 'customer') {
      return `/(app)/(customer)/returns/${id}` as Href;
    }
    return `/(app)/(admin)/returns/${id}` as Href;
  }

  if (path.includes('account/statement') || path.includes('/statements/')) {
    return '/(app)/(customer)/account/statement' as Href;
  }

  if (path.startsWith('/quotations/')) {
    if (surface === 'customer') {
      return `/(app)/(customer)/quotations/${id}` as Href;
    }
    return `/(app)/(admin)/quotations/${id}` as Href;
  }

  if (path.startsWith('/requests/')) {
    if (surface === 'customer') {
      return `/(app)/(customer)/requests/${id}` as Href;
    }
    return '/(app)/(admin)/requests' as Href;
  }

  if (path.startsWith('/ai-intake/')) {
    if (surface === 'customer') return null;
    return `/(app)/(admin)/ai-intake/${id}` as Href;
  }

  if (path.startsWith('/tasks/')) {
    if (surface === 'customer') return null;
    return `/(app)/(employee)/tasks/${id}` as Href;
  }

  return null;
}
