/** Next allocation on this invoice — never more than free credit or remaining due. */

export function planAllocationAmountEdit(input: {
  currentAlloc: number;
  nextAmount: number;
  paymentUnallocated: number;
  invoiceOutstanding: number;
}): number {
  const current = Number(input.currentAlloc);
  const want = Number(input.nextAmount);
  const slack = Number(input.paymentUnallocated);
  const due = Number(input.invoiceOutstanding);
  if (!Number.isFinite(want) || want <= 1e-6) return 0;
  const room = Math.min(
    Number.isFinite(slack) ? Math.max(0, slack) : 0,
    Number.isFinite(due) ? Math.max(0, due) : 0,
  );
  const max = (Number.isFinite(current) ? Math.max(0, current) : 0) + room;
  return Math.min(want, max);
}
