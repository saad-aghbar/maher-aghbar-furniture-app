export type MaterialDemandStatus = 'COVERED' | 'AT_RISK' | 'SHORTAGE' | 'NO_ETA';

export function classifyMaterialDemand(args: {
  requiredQty: number;
  freeQty: number;
  incoming: Array<{ qty: number; readyAt: Date | null }>;
  nextRequiredBy: Date | null;
}): MaterialDemandStatus {
  const required = Number(args.requiredQty) || 0;
  const free = Number(args.freeQty) || 0;
  if (!(required > 0) || free + 1e-9 >= required) return 'COVERED';

  const dated = args.incoming
    .filter(
      (row): row is { qty: number; readyAt: Date } =>
        row.qty > 0 && row.readyAt instanceof Date && !Number.isNaN(row.readyAt.getTime()),
    )
    .sort((a, b) => a.readyAt.getTime() - b.readyAt.getTime());

  let remaining = required - free;
  let late = false;
  for (const lot of dated) {
    remaining -= lot.qty;
    if (args.nextRequiredBy && lot.readyAt.getTime() > args.nextRequiredBy.getTime()) {
      late = true;
    }
    if (remaining <= 1e-9) return late ? 'AT_RISK' : 'COVERED';
  }
  if (dated.length) return 'SHORTAGE';
  return 'NO_ETA';
}
