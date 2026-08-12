/**
 * Pure helpers for legacy snapshot edge inference (unit-tested without DB).
 */
export function inferLegacySnapshotEdges(
  stages: Array<{ code: string; dependsOnCodes: string[] }>,
): Array<{ from: string; to: string }> {
  const codes = new Set(stages.map((s) => s.code));
  const edges: Array<{ from: string; to: string }> = [];
  const seen = new Set<string>();
  for (const stage of stages) {
    for (const from of stage.dependsOnCodes) {
      if (!codes.has(from)) continue;
      const key = `${from}->${stage.code}`;
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push({ from, to: stage.code });
    }
  }
  return edges;
}

export function isBackfillIdempotentKey(productionOrderId: string) {
  return `snapshot:${productionOrderId}`;
}
