export type MapCoords = {
  latitude: number;
  longitude: number;
  /** Human-readable address from reverse geocode when available. */
  address?: string;
};

/** Coerce API / draft values (number, numeric string) into a finite coordinate. */
export function parseMapCoord(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

export function normalizeMapCoords(input: unknown): MapCoords | null {
  if (!input || typeof input !== 'object') return null;
  const rec = input as Record<string, unknown>;
  const latitude = parseMapCoord(rec.latitude ?? rec.lat);
  const longitude = parseMapCoord(rec.longitude ?? rec.lng);
  if (latitude == null || longitude == null) return null;
  const address = typeof rec.address === 'string' && rec.address.trim() ? rec.address.trim() : undefined;
  return address ? { latitude, longitude, address } : { latitude, longitude };
}

export function formatMapCoord(value: number, digits = 5): string {
  return value.toFixed(digits);
}
