import type { Href, Router } from 'expo-router';
import type { AppSurface } from '@maher/permissions';
import { activeTabFromPath } from './activeTabFromPath';
import { isTabRootPath } from './isTabRootPath';
import type { TabName } from './tabConfig';

export function tabHref(surface: AppSurface, name: TabName): Href {
  const root =
    surface === 'admin'
      ? '/(app)/(admin)/(tabs)'
      : surface === 'customer'
        ? '/(app)/(customer)/(tabs)'
        : '/(app)/(employee)/(tabs)';
  if (name === 'index') return root as Href;
  return `${root}/${name}` as Href;
}

type TabRouter = Pick<Router, 'navigate' | 'replace'> & {
  canDismiss?: () => boolean;
  dismissAll?: () => void;
  dismissTo?: (href: Href) => void;
};

/**
 * Switch bottom tabs without leaving nested stack history behind.
 * Nested → tab: clear pushed screens first so iOS swipe-back cannot
 * resurrect order/product detail after landing on More/Home/etc.
 */
export function navigateToTab(
  router: TabRouter,
  surface: AppSurface,
  name: TabName,
  pathname: string,
): void {
  const href = tabHref(surface, name);
  const onRoot = isTabRootPath(pathname, surface);
  const active = activeTabFromPath(surface, pathname);

  if (onRoot && active === name) return;

  if (!onRoot) {
    // Prefer popping the whole surface stack to its root, then switch tab.
    if (typeof router.canDismiss === 'function' && router.canDismiss()) {
      router.dismissAll?.();
      router.navigate(href);
      return;
    }
    // No dismissable stack layer — replace so back doesn't restore the nested screen.
    router.replace(href);
    return;
  }

  router.navigate(href);
}
