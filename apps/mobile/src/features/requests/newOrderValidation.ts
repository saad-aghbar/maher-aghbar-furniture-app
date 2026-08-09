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

export function clampNotes(raw: string, max: number): string {
  if (raw.length <= max) return raw;
  return raw.slice(0, max);
}

export function formatAddressLine(addr: {
  line1: string;
  line2?: string | null;
  city?: string | null;
  region?: string | null;
  country?: string | null;
}): string {
  return [addr.line1, addr.line2, addr.city, addr.region, addr.country]
    .map((p) => (p ?? '').trim())
    .filter(Boolean)
    .join(', ');
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
