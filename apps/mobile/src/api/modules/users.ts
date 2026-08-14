import type { PaginatedResponse } from '@maher/types';
import { apiGet, apiPatch, apiPost, apiDelete } from '../client';
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
  kind?: string | null;
  isSystem?: boolean;
  isActive?: boolean;
  iconKey?: string | null;
  descriptionEn?: string | null;
  descriptionAr?: string | null;
  descriptionHe?: string | null;
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
  _count?: { users?: number; permissions?: number };
  permissions?: Array<{ permission: { id?: string; code: string } }>;
};

export type StaffTypeRow = RoleRow;

export type DepartmentRow = UserDepartment;

export type UserListFilters = PageParams & {
  q?: string;
  isActive?: 'true' | 'false';
  roleCode?: string;
  roleKind?: string;
  staffTypeId?: string;
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

export async function deleteUser(id: string) {
  return apiDelete<{ ok: true }>(`/users/${encodeURIComponent(id)}`);
}

export async function resetUserPassword(id: string) {
  return apiPost<{ ok: boolean; temporaryPassword: string }>(
    `/users/${encodeURIComponent(id)}/reset-password`,
    {},
  );
}

export async function listRoles(filters: { kind?: string; isActive?: boolean } = {}) {
  const qs = toSearchParams({
    kind: filters.kind,
    isActive: filters.isActive === undefined ? undefined : String(filters.isActive),
  });
  return apiGet<RoleRow[]>(`/roles${qs}`);
}

export async function listStaffTypes(filters: { isActive?: boolean } = {}) {
  const qs = toSearchParams({
    isActive: filters.isActive === undefined ? undefined : String(filters.isActive),
  });
  return apiGet<StaffTypeRow[]>(`/staff-types${qs}`);
}

export async function getStaffType(id: string) {
  return apiGet<StaffTypeRow>(`/staff-types/${encodeURIComponent(id)}`);
}

export type WriteStaffTypeInput = {
  nameEn: string;
  nameAr: string;
  nameHe?: string;
  descriptionEn?: string;
  descriptionAr?: string;
  descriptionHe?: string;
  iconKey?: string | null;
  isActive?: boolean;
  permissionCodes?: string[];
};

export async function createStaffType(body: WriteStaffTypeInput) {
  return apiPost<StaffTypeRow>('/staff-types', body);
}

export async function updateStaffType(id: string, body: WriteStaffTypeInput) {
  return apiPatch<StaffTypeRow>(`/staff-types/${encodeURIComponent(id)}`, body);
}

export async function duplicateStaffType(id: string) {
  return apiPost<StaffTypeRow>(`/staff-types/${encodeURIComponent(id)}/duplicate`, {});
}

export async function deactivateStaffType(id: string) {
  return apiPost<StaffTypeRow>(`/staff-types/${encodeURIComponent(id)}/deactivate`, {});
}

export async function deleteStaffType(id: string) {
  return apiDelete<{ ok: true }>(`/staff-types/${encodeURIComponent(id)}`);
}

export async function getPermissionCatalog(staff = true) {
  return apiGet<
    Array<{
      group: string;
      nameEn: string;
      nameAr: string;
      nameHe: string;
      permissions: Array<{
        code: string;
        nameEn: string;
        nameAr: string;
        nameHe: string;
        descriptionEn: string;
        descriptionAr: string;
        descriptionHe: string;
        riskLevel: string;
        assignableToStaff: boolean;
      }>;
    }>
  >(`/roles/permission-catalog${staff ? '?staff=true' : ''}`);
}

export async function listDepartments(filters: { page?: number; pageSize?: number; q?: string } = {}) {
  const qs = toSearchParams({
    page: filters.page ?? 1,
    pageSize: filters.pageSize ?? 100,
    q: filters.q,
  });
  return apiGet<PaginatedResponse<DepartmentRow>>(`/departments${qs}`);
}
