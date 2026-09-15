import type { Href, Router } from 'expo-router';

type SurfaceHrefRouter = Pick<Router, 'navigate'> & {
  canDismiss?: () => boolean;
  dismissAll?: () => void;
};

/**
 * Open a surface nested route from an app-stack sibling (inbox / search).
 * `push` from `/(app)/notifications` remounts `(admin)` at Home — pop the
 * sibling first, then `navigate`, matching catalog → New Order.
 */
export function navigateSurfaceHref(router: SurfaceHrefRouter, href: Href): void {
  if (typeof router.canDismiss === 'function' && router.canDismiss()) {
    router.dismissAll?.();
  }
  router.navigate(href);
}
