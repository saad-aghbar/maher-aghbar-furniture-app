export function resolveModelName(input: {
  customProductName: string;
  catalogName?: string | null;
}): string {
  const custom = input.customProductName.trim();
  if (custom) return custom;
  return (input.catalogName ?? '').trim();
}

export function isValidQuantity(raw: string): boolean {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0;
}

export function isValidDeliveryAddress(raw: string): boolean {
  return raw.trim().length > 0;
}

/** Soft check: empty is allowed; non-empty must include a few digits. */
export function isValidOptionalPhone(raw: string): boolean {
  const v = raw.trim();
  if (!v) return true;
  const digits = v.replace(/\D/g, '');
  return digits.length >= 6;
}

/** Soft check: empty is allowed (no preference); non-empty must be a real calendar date. */
export function isValidOptionalDate(raw: string): boolean {
  const v = raw.trim();
  if (!v) return true;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (!m) return false;
  const [, y, mo, d] = m;
  const date = new Date(Number(y), Number(mo) - 1, Number(d));
  return (
    date.getFullYear() === Number(y) &&
    date.getMonth() === Number(mo) - 1 &&
    date.getDate() === Number(d)
  );
}

export function clampNotes(raw: string, max: number): string {
  if (raw.length <= max) return raw;
  return raw.slice(0, max);
}

export function formatAddressLine(addr: {
  line1?: string | null;
  line2?: string | null;
  street?: string | null;
  city?: string | null;
  region?: string | null;
  country?: string | null;
}): string {
  const street = (addr.street ?? '').trim();
  // Freeform map/new-order saves store the full line in street — don't re-append city/country.
  if (street.includes(',')) return street;
  const line1 = (addr.line1 ?? street).trim();
  if (line1.includes(',')) return line1;
  return [line1 || null, addr.line2, addr.city, addr.region, addr.country]
    .map((p) => (p ?? '').trim())
    .filter(Boolean)
    .join(', ');
}

/** Best-effort city token from a freeform delivery line (API requires `city`). */
export function guessCityFromAddress(address: string): string {
  const parts = address
    .split(',')
    .map((p) => p.trim())
    .filter((p) => p && !/^\d{4,}$/.test(p) && !/^[A-Z]{2}$/i.test(p));
  const candidate =
    parts.find((p) =>
      /amman|ramallah|nablus|irbid|aqaba|tel aviv|ramla|jaffa|jerusalem|hebron/i.test(p),
    ) ||
    parts[parts.length - 2] ||
    parts[0] ||
    'Amman';
  return candidate.slice(0, 80);
}

export function suggestAddressLabel(address: string): string {
  const first = address
    .split(',')
    .map((p) => p.trim())
    .find(Boolean);
  return (first || address.trim()).slice(0, 40);
}

export function isAddressAlreadySaved(
  address: string,
  addresses: Array<{
    line1?: string | null;
    street?: string | null;
    city?: string | null;
    region?: string | null;
    country?: string | null;
    label?: string | null;
  }>,
): boolean {
  const needle = address.trim().toLowerCase();
  if (!needle) return false;
  return addresses.some((a) => formatAddressLine(a).trim().toLowerCase() === needle);
}

export function composeRequestNotes(input: {
  deliveryNotes: string;
  dimensionsNotes: string;
  orderNotes: string;
}): string | undefined {
  const parts: string[] = [];
  const delivery = input.deliveryNotes.trim();
  const dimensions = input.dimensionsNotes.trim();
  const order = input.orderNotes.trim();
  if (delivery) parts.push(`Delivery notes:\n${delivery}`);
  if (dimensions) parts.push(`Dimensions:\n${dimensions}`);
  if (order) parts.push(order);
  return parts.length ? parts.join('\n\n') : undefined;
}
