import type { DiscountType } from '@maher/database';

export function roundMoney(value: number): string {
  return Number(value).toFixed(3);
}

export function calcLineTotals(
  qty: number,
  unitPrice: number,
  discountType: DiscountType,
  discountValue: number,
  taxRate: number,
) {
  const gross = qty * unitPrice;
  let discount = 0;
  if (discountType === 'PERCENT') discount = gross * (discountValue / 100);
  else if (discountType === 'AMOUNT') discount = discountValue;
  const subtotal = gross - discount;
  const taxAmount = subtotal * taxRate;
  const lineTotal = subtotal + taxAmount;
  return {
    subtotal: roundMoney(subtotal),
    taxAmount: roundMoney(taxAmount),
    lineTotal: roundMoney(lineTotal),
    discountAmount: roundMoney(discount),
  };
}
