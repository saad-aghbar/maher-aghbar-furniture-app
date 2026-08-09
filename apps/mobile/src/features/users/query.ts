import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { flattenPaginatedPages, getNextPageParamFromMeta } from '@/api/infinite';
import { queryKeys } from '@/api/queryKeys';
import {
  activateUser,
  createUser,
  deactivateUser,
  listDepartments,
  listRoles,
  listUsers,
  resetUserPassword,
  updateUser,
  type CreateUserInput,
  type UpdateUserInput,
  type UserListFilters,
} from '@/api/modules/users';

export type UsersListQueryFilters = Omit<UserListFilters, 'page' | 'pageSize'>;

export function useUsersInfiniteQuery(filters: UsersListQueryFilters, enabled: boolean) {
  return useInfiniteQuery({
    queryKey: queryKeys.users.list(filters),
    queryFn: ({ pageParam }) =>
      listUsers({ page: pageParam, pageSize: 20, ...filters }),
    initialPageParam: 1,
    getNextPageParam: getNextPageParamFromMeta,
    enabled,
    placeholderData: keepPreviousData,
  });
}

export function flattenUsers(data: ReturnType<typeof useUsersInfiniteQuery>['data']) {
  return flattenPaginatedPages(data?.pages);
}

export function useRolesQuery(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.users.roles(),
    queryFn: () => listRoles(),
    enabled,
    staleTime: 60_000,
  });
}

export function useDepartmentsQuery(enabled: boolean, q?: string) {
  return useQuery({
    queryKey: queryKeys.users.departments({ q: q?.trim() || undefined }),
    queryFn: () => listDepartments({ page: 1, pageSize: 100, q: q?.trim() || undefined }),
    enabled,
    staleTime: 60_000,
    retry: false,
  });
}

function invalidateUsers(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ queryKey: queryKeys.users.lists() });
}

export function useCreateUserMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateUserInput) => createUser(body),
    onSuccess: () => invalidateUsers(qc),
  });
}

export function useUpdateUserMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateUserInput }) => updateUser(id, body),
    onSuccess: () => invalidateUsers(qc),
  });
}

export function useActivateUserMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => activateUser(id),
    onSuccess: () => invalidateUsers(qc),
  });
}

export function useDeactivateUserMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deactivateUser(id),
    onSuccess: () => invalidateUsers(qc),
  });
}

export function useResetUserPasswordMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => resetUserPassword(id),
    onSuccess: () => invalidateUsers(qc),
  });
}
