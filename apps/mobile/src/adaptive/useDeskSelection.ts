import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { isAtLeast } from './breakpoints';
import { useMaherLayout } from './useMaherLayout';

export function firstSearchParam(
  value: string | string[] | undefined,
): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value || undefined;
}

/**
 * EXPANDED/WIDE list|detail selection via `?selected=` (no stack push).
 * COMPACT/MEDIUM keep today's `router.push`.
 */
export function useDeskSelection(param = 'selected') {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { windowClass } = useMaherLayout();
  const split = isAtLeast(windowClass, 'expanded');
  const selected = firstSearchParam(
    (params as Record<string, string | string[] | undefined>)[param],
  );

  const selectOrPush = (id: string, compactHref: Href) => {
    if (split) {
      router.setParams({ [param]: id });
      return;
    }
    router.push(compactHref);
  };

  return { split, selected, selectOrPush };
}
