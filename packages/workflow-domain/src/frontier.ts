import { deriveSuccMap, sortedUnique } from './graph';

/**
 * Production stages with no production successor.
 */
export function computeProductionFrontier(
  productionNodeIds: string[],
  predecessorsByNode: Record<string, string[]>,
): string[] {
  const prodSet = new Set(productionNodeIds);
  const succ = deriveSuccMap(productionNodeIds, predecessorsByNode);
  return sortedUnique(
    productionNodeIds.filter((id) => {
      const productionSuccs = (succ[id] ?? []).filter((s) => prodSet.has(s));
      return productionSuccs.length === 0;
    }),
  );
}
