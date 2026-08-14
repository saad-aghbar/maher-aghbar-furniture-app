import type { RoleKind } from '@maher/database';

export function stageSkillsForAssignedRoles(
  kinds: Array<RoleKind | string>,
  stageDefinitionIds: string[] | undefined,
): string[] | undefined {
  if (stageDefinitionIds === undefined) {
    const keepSkills = kinds.some((kind) => kind === 'PRODUCTION_WORKER');
    return keepSkills ? undefined : [];
  }
  if (!kinds.some((kind) => kind === 'PRODUCTION_WORKER')) return [];
  return stageDefinitionIds;
}

export function rolesOmitDepartment(kinds: Array<RoleKind | string>): boolean {
  return kinds.some(
    (kind) => kind === 'PRODUCTION_WORKER' || kind === 'ADMIN' || kind === 'STAFF' || kind === 'CUSTOMER',
  );
}
