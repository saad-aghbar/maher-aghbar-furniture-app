import {
  emptyUserIdentityForm,
  hydrateUserIdentityForm,
  submittedRoleId,
  submittedStageDefinitionIds,
  type UserIdentityForm,
} from '@maher/permissions';
import type { CreateUserInput, UpdateUserInput, UserRow } from '@/api/modules/users';
import { hourlyRateDisplay, parseHourlyRateInput } from './hourlyRate';

export function formFromUser(user: UserRow): {
  username: string;
  password: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  departmentId: string;
  identity: UserIdentityForm;
  hourlyRate: string;
} {
  const assigned = user.roles?.[0]?.role;
  const identity = assigned
    ? {
        ...hydrateUserIdentityForm(assigned),
        stageDefinitionIds:
          assigned.kind === 'PRODUCTION_WORKER' || assigned.code === 'PRODUCTION_WORKER'
            ? (user.stageDefinitionIds ?? [])
            : [],
      }
    : emptyUserIdentityForm();
  return {
    username: user.username ?? '',
    password: '',
    firstName: user.firstName ?? '',
    lastName: user.lastName ?? '',
    isActive: user.isActive,
    departmentId: user.departmentId ?? user.department?.id ?? '',
    identity,
    hourlyRate: hourlyRateDisplay(user.hourlyRate),
  };
}

function hourlyRateForWorker(identity: UserIdentityForm, hourlyRate: string, clearWhenEmpty: boolean) {
  if (identity.identityRoleCode !== 'PRODUCTION_WORKER' || identity.employeeType !== 'WORKER') {
    return {};
  }
  const parsed = parseHourlyRateInput(hourlyRate);
  if (parsed !== undefined) return { hourlyRate: parsed };
  return clearWhenEmpty ? { hourlyRate: null } : {};
}

export function createUserBody(input: {
  username: string;
  firstName: string;
  lastName: string;
  roleId: string;
  departmentId?: string;
  password?: string;
  identity: UserIdentityForm;
  hourlyRate: string;
}): CreateUserInput {
  return {
    username: input.username,
    firstName: input.firstName,
    lastName: input.lastName,
    roleIds: [input.roleId],
    ...(input.departmentId ? { departmentId: input.departmentId } : {}),
    ...(input.password ? { password: input.password } : {}),
    stageDefinitionIds: submittedStageDefinitionIds(input.identity),
    ...hourlyRateForWorker(input.identity, input.hourlyRate, false),
  };
}

export function updateUserBody(input: {
  username: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  roleId: string;
  departmentId: string | null;
  identity: UserIdentityForm;
  hourlyRate: string;
}): UpdateUserInput {
  return {
    username: input.username,
    firstName: input.firstName,
    lastName: input.lastName,
    isActive: input.isActive,
    roleIds: [input.roleId],
    departmentId: input.departmentId,
    stageDefinitionIds: submittedStageDefinitionIds(input.identity),
    ...hourlyRateForWorker(input.identity, input.hourlyRate, true),
  };
}

export function roleIdOrNull(
  identity: UserIdentityForm,
  roles: Array<{ id: string; code: string; kind?: string | null }>,
) {
  return submittedRoleId(identity, roles);
}
