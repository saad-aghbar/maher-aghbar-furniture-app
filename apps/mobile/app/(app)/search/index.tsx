import { GlobalSearchScreen } from '@/features/search/GlobalSearchScreen';

/** Deep link `/(app)/search` — present global search, do not bounce to Home. */
export default function SearchRoute() {
  return <GlobalSearchScreen />;
}
