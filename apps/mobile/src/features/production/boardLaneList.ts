/**
 * Board lane list contract helpers — Count N ⇒ list of N.
 * Never paint another lane's rows under a 0 chip (keepPreviousData trap).
 */

export function boardCountForBucket(
  bucket: string,
  counts: {
    needsSetup: number;
    readyToStart: number;
    onFloor: number;
    blocked: number;
    inspectionPackaging: number;
  } | null,
): number | null {
  if (!counts) return null;
  switch (bucket) {
    case 'needs_setup':
      return counts.needsSetup;
    case 'ready_to_start':
      return counts.readyToStart;
    case 'on_floor':
      return counts.onFloor;
    case 'blocked':
      return counts.blocked;
    case 'inspection_packaging':
      return counts.inspectionPackaging;
    default:
      return null;
  }
}

export function productionListItemsForBoard<T>(args: {
  isPlaceholderData: boolean;
  selectedLaneCount: number | null;
  flattened: T[];
}): T[] {
  if (args.isPlaceholderData) return [];
  if (args.selectedLaneCount === 0) return [];
  return args.flattened;
}
