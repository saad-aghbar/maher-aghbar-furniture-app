/**
 * Human-facing create/update never requires typing Prisma `code` / `nodeKey`.
 * Explicit values stay accepted for mobile and seeds.
 */

export function normalizeExplicitCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, '_');
}

export function slugFromEnglishName(nameEn: string, fallback = 'ITEM'): string {
  const slug = nameEn
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase();
  return slug || fallback;
}

export function nextUniqueCode(base: string, existing: Iterable<string>): string {
  const taken = new Set(existing);
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}_${n}`)) n += 1;
  return `${base}_${n}`;
}

/** Prefer unique slug from English name. Explicit code is normalized, then uniquified on collision. */
export function resolveGeneratedCode(
  explicitCode: string | undefined | null,
  nameEn: string,
  existing: Iterable<string>,
): string {
  const base = explicitCode?.trim()
    ? normalizeExplicitCode(explicitCode)
    : slugFromEnglishName(nameEn);
  return nextUniqueCode(base, existing);
}

/** Omit nodeKey → stage.code, unique within the version. Explicit key is normalized as-is. */
export function resolveNodeKey(
  explicitKey: string | undefined | null,
  stageCode: string,
  existingKeys: Iterable<string>,
): string {
  if (explicitKey?.trim()) {
    return normalizeExplicitCode(explicitKey);
  }
  return nextUniqueCode(stageCode, existingKeys);
}

export function nextLibrarySortOrder(maxSort: number | null | undefined): number {
  return (maxSort ?? 0) + 10;
}

export function nextNodeSortOrder(maxSort: number | null | undefined): number {
  return (maxSort ?? -1) + 1;
}

/** Cartesian pred × succ used when removing a node with reconnect=true. */
export function cartesianReconnect(
  incomingFromIds: string[],
  outgoingToIds: string[],
): Array<{ fromNodeId: string; toNodeId: string }> {
  const pairs: Array<{ fromNodeId: string; toNodeId: string }> = [];
  for (const fromNodeId of incomingFromIds) {
    for (const toNodeId of outgoingToIds) {
      if (fromNodeId !== toNodeId) {
        pairs.push({ fromNodeId, toNodeId });
      }
    }
  }
  return pairs;
}

const STAGE_PATCH_FIELDS = [
  'nameAr',
  'nameEn',
  'nameHe',
  'sortOrder',
  'estimatedHours',
  'requiresInspection',
  'requiresPhotos',
  'responsibleDepartment',
  'isActive',
  'schedulingResourceMode',
  'resourceSlots',
] as const;

const STAGE_NAME_PATCH_FIELDS = ['nameAr', 'nameEn', 'nameHe'] as const;

export function lockedAnchorNameChanged(
  existing: { nameEn: string; nameAr: string; nameHe?: string | null },
  dto: Record<string, unknown>,
): boolean {
  for (const key of STAGE_NAME_PATCH_FIELDS) {
    if (dto[key] === undefined) continue;
    const next = dto[key] == null ? '' : String(dto[key]).trim();
    const prev = existing[key] == null ? '' : String(existing[key]).trim();
    if (next !== prev) return true;
  }
  return false;
}

/** Strip `code` and any unknown fields so rename never mutates the stored identifier. */
export function pickStagePatch(
  dto: Record<string, unknown>,
  options?: { omitNames?: boolean },
): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  for (const key of STAGE_PATCH_FIELDS) {
    if (options?.omitNames && (STAGE_NAME_PATCH_FIELDS as readonly string[]).includes(key)) {
      continue;
    }
    if (dto[key] !== undefined) data[key] = dto[key];
  }
  return data;
}
