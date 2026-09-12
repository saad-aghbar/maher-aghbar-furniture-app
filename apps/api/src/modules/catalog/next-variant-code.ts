/** Next free V2, V3, … — STD stays the product default. */
export function nextVariantCode(existingCodes: Array<string | null | undefined>): string {
  const used = new Set(
    existingCodes.map((code) => String(code ?? '').trim().toUpperCase()).filter(Boolean),
  );
  let n = 2;
  while (used.has(`V${n}`)) n += 1;
  return `V${n}`;
}
