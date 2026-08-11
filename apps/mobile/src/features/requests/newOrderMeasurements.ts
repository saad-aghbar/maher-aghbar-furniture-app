export type NewOrderCustomMeasurement = {
  id: string;
  label: string;
  value: string;
};

export type NewOrderDimensionFields = {
  width: string;
  height: string;
  depth: string;
  seat: string;
  custom: NewOrderCustomMeasurement[];
};

export function emptyDimensionFields(): NewOrderDimensionFields {
  return { width: '', height: '', depth: '', seat: '', custom: [] };
}

export function parseDimNumber(raw: string): number | undefined {
  const n = Number(String(raw).trim());
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

export function formatDimensionsNotes(fields: NewOrderDimensionFields): string {
  const parts: string[] = [];
  const w = fields.width.trim();
  const h = fields.height.trim();
  const d = fields.depth.trim();
  const seat = fields.seat.trim();
  if (w) parts.push(`W ${w}`);
  if (h) parts.push(`H ${h}`);
  if (d) parts.push(`D ${d}`);
  if (seat) parts.push(`Seat ${seat}`);
  for (const m of fields.custom) {
    const label = m.label.trim();
    const value = m.value.trim();
    if (!label && !value) continue;
    parts.push(label && value ? `${label} ${value}` : label || value);
  }
  return parts.length ? `${parts.join(' × ')} cm` : '';
}

/** Custom rows for the API, including seat height when set. */
export function toRequestCustomMeasurements(
  fields: NewOrderDimensionFields,
  seatLabel: string,
): { label: string; value: string }[] {
  const rows: { label: string; value: string }[] = [];
  const seat = fields.seat.trim();
  if (seat) rows.push({ label: seatLabel, value: seat });
  for (const m of fields.custom) {
    const label = m.label.trim();
    const value = m.value.trim();
    if (!label || !value) continue;
    rows.push({ label, value });
  }
  return rows;
}

export function seedDimensionsFromProduct(
  product: {
    width?: number | string | null;
    height?: number | string | null;
    depth?: number | string | null;
    seatHeight?: number | string | null;
    customMeasurements?:
      | {
          nameEn: string;
          nameAr: string;
          nameHe?: string | null;
          value?: number | null;
        }[]
      | null;
  },
  locale: string,
): NewOrderDimensionFields {
  const fmt = (v: number | string | null | undefined) => {
    if (v == null || v === '') return '';
    const n = Number(v);
    return Number.isFinite(n) ? String(n) : '';
  };
  const custom: NewOrderCustomMeasurement[] = [];
  for (const m of product.customMeasurements ?? []) {
    const label =
      locale === 'ar'
        ? m.nameAr || m.nameEn
        : locale === 'he'
          ? m.nameHe || m.nameEn || m.nameAr
          : m.nameEn || m.nameAr;
    if (!label?.trim()) continue;
    custom.push({
      id: `seed-${label}-${custom.length}`,
      label: label.trim(),
      value: m.value != null && Number.isFinite(Number(m.value)) ? String(m.value) : '',
    });
  }
  return {
    width: fmt(product.width),
    height: fmt(product.height),
    depth: fmt(product.depth),
    seat: fmt(product.seatHeight),
    custom,
  };
}

/** When loading an old draft that only has a freeform dimensions note. */
export function migrateLegacyDimensionsNotes(
  notes: string,
): Partial<NewOrderDimensionFields> | null {
  const raw = notes.trim();
  if (!raw) return null;
  const width = raw.match(/\bW\s*(\d+(?:\.\d+)?)/i)?.[1] ?? '';
  const height = raw.match(/\bH\s*(\d+(?:\.\d+)?)/i)?.[1] ?? '';
  const depth = raw.match(/\bD\s*(\d+(?:\.\d+)?)/i)?.[1] ?? '';
  const seat = raw.match(/\bSeat\s*(\d+(?:\.\d+)?)/i)?.[1] ?? '';
  if (!width && !height && !depth && !seat) {
    return {
      custom: [{ id: 'legacy-notes', label: 'Notes', value: raw }],
    };
  }
  return { width, height, depth, seat, custom: [] };
}
