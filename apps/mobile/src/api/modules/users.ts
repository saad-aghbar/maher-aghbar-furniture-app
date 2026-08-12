import type { PaginatedResponse } from '@maher/types';
import { apiGet, apiPatch, apiPost } from '../client';
import { toSearchParams, type PageParams } from '../pagination';

export type UserDepartment = {
  id: string;
  code: string;
  nameAr?: string | null;
  nameEn?: string | null;
  nameHe?: string | null;
};

export type UserRoleRef = {
  id: string;
  code: string;
  nameEn: string;
  nameAr?: string | null;
  nameHe?: string | null;
};

export type UserRow = {
  id: string;
  username: string | null;
  email: string | null;
  phone: string | null;
  firstName: string;
  lastName: string;
  preferredLanguage: string;
  isActive: boolean;
  lastLoginAt: string | null;
  customerId: string | null;
  departmentId?: string | null;
  department?: UserDepartment | null;
  roles?: Array<{ role: UserRoleRef }>;
  stageDefinitionIds?: string[];
  temporaryPassword?: string;
};

export type RoleRow = UserRoleRef & {
  description?: string | null;
};

export type DepartmentRow = UserDepartment;

export type UserListFilters = PageParams & {
  q?: string;
  isActive?: 'true' | 'false';
  roleCode?: string;
  departmentId?: string;
};

export type CreateUserInput = {
  username: string;
  firstName: string;
  lastName: string;
  password?: string;
  roleIds: string[];
  departmentId?: string | null;
  isActive?: boolean;
  email?: string;
  phone?: string;
  preferredLanguage?: string;
  customerId?: string | null;
  stageDefinitionIds?: string[];
};

export type UpdateUserInput = {
  username?: string;
  firstName?: string;
  lastName?: string;
  password?: string;
  roleIds?: string[];
  departmentId?: string | null;
  isActive?: boolean;
  email?: string | null;
  phone?: string | null;
  preferredLanguage?: string;
  customerId?: string | null;
  stageDefinitionIds?: string[];
};

export async function listUsers(filters: UserListFilters = {}) {
  const qs = toSearchParams(filters);
  return apiGet<PaginatedResponse<UserRow>>(`/users${qs}`);
}

export async function getUser(id: string) {
  return apiGet<UserRow & { effectivePermissions?: string[] }>(
    `/users/${encodeURIComponent(id)}`,
  );
}

export async function createUser(body: CreateUserInput) {
  return apiPost<UserRow & { temporaryPassword?: string }>('/users', body);
}

export async function updateUser(id: string, body: UpdateUserInput) {
  return apiPatch<UserRow>(`/users/${encodeURIComponent(id)}`, body);
}

export async function activateUser(id: string) {
  return apiPost<UserRow>(`/users/${encodeURIComponent(id)}/activate`, {});
}

export async function deactivateUser(id: string) {
  return apiPost<UserRow>(`/users/${encodeURIComponent(id)}/deactivate`, {});
}

export async function resetUserPassword(id: string) {
  return apiPost<{ ok: boolean; temporaryPassword: string }>(
    `/users/${encodeURIComponent(id)}/reset-password`,
    {},
  );
}

export async function listRoles() {
  return apiGet<RoleRow[]>('/roles');
}

export async function listDepartments(filters: { page?: number; pageSize?: number; q?: string } = {}) {
  const qs = toSearchParams({
    page: filters.page ?? 1,
    pageSize: filters.pageSize ?? 100,
    q: filters.q,
  });
  return apiGet<PaginatedResponse<DepartmentRow>>(`/departments${qs}`);
}
