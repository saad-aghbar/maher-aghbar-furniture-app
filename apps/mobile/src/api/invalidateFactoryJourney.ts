import type { QueryClient } from '@tanstack/react-query';
import { queryKeys } from './queryKeys';

/** Targeted cache refresh after commercial → factory hops. Never wipe the whole client. */
export async function invalidateFactoryJourney(qc: QueryClient): Promise<void> {
  await Promise.all([
    qc.invalidateQueries({ queryKey: queryKeys.salesOrders.all }),
    qc.invalidateQueries({ queryKey: queryKeys.production.all }),
    qc.invalidateQueries({ queryKey: queryKeys.scheduling.all }),
    qc.invalidateQueries({ queryKey: queryKeys.reports.all }),
    qc.invalidateQueries({ queryKey: queryKeys.tasks.all }),
  ]);
}
