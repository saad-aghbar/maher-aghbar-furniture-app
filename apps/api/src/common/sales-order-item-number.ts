/**
 * Keep in sync with packages/database/src/sales-order-item-number.ts
 * Stable basket-line letters: A…Z then AA, AB…
 */

export function itemLetterAtIndex(index: number): string {
  if (!Number.isInteger(index) || index < 0) {
    throw new Error('itemLetter index must be a non-negative integer');
  }
  let n = index + 1;
  let out = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

export function nextItemLetter(used: Iterable<string>): string {
  const taken = new Set(
    [...used]
      .map((value) => value.trim().toUpperCase())
      .filter(Boolean),
  );
  for (let i = 0; i < 10_000; i += 1) {
    const letter = itemLetterAtIndex(i);
    if (!taken.has(letter)) return letter;
  }
  throw new Error('Could not allocate a sales-order item letter.');
}

export function formatSalesOrderItemNumber(
  salesOrderNumber: string,
  itemLetter: string,
): string {
  const number = salesOrderNumber.trim();
  const letter = itemLetter.trim().toUpperCase();
  if (!number || !letter) {
    throw new Error('Sales order item number needs a parent number and letter.');
  }
  return `${number}.${letter}`;
}

export function withLineItemLetters<T extends object>(
  lines: T[],
  used: Iterable<string> = [],
): Array<T & { itemLetter: string }> {
  const taken = [...used];
  return lines.map((line) => {
    const itemLetter = nextItemLetter(taken);
    taken.push(itemLetter);
    return { ...line, itemLetter };
  });
}
