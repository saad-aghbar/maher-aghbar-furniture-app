"use client";

import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { type DepartmentOption } from "@/components/admin/department-search-picker";
import { useRouter } from "@/i18n/navigation";
import { apiFetch, ApiClientError } from "@/lib/api-client";
import { mutationErrorMessage } from "@/hooks/use-api-mutation";
import { useAuthMe } from "@/hooks/use-auth-me";
import {
  Alert,
  Button,
  EmptyState,
  ErrorState,
  FilterChip,
  Input,
  Ltr,
  Checkbox,
  Sheet,
  Select,
  Skeleton,
  StatusBadge,
  Board,
  DataBoard,
  Figure,
  Menu,
  Pagination,
  Ribbon,
  Stamp,
  StatusChips,
  type DataColumn,
} from "@maher/ui";
import { localizedName } from "@maher/i18n";
import {
  applyEmployeeTypeChange,
  applyIdentityChange,
  can,
  emptyUserIdentityForm,
  hydrateUserIdentityForm,
  IDENTITY_ROLE_CODES,
  isIdentityRoleCode,
  submittedRoleId,
  submittedStageDefinitionIds,
  type IdentityRoleCode,
  type UserIdentityForm,
} from "@maher/permissions";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { KeyRound, MoreHorizontal, Pencil, Power } from "lucide-react";
import { useKitCopy } from "@/lib/kit-copy";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";

interface UserRow {
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
  department?: {
    id: string;
    code: string;
    nameAr?: string | null;
    nameEn?: string | null;
  } | null;
  stageDefinitionIds?: string[];
  hourlyRate?: number | null;
  roles?: Array<{
    role: {
      id: string;
      code: string;
      nameEn: string;
      nameAr?: string;
      nameHe?: string | null;
      kind?: string | null;
    };
  }>;
}

interface RoleRow {
  id: string;
  code: string;
  nameEn: string;
  nameAr: string;
  nameHe?: string | null;
  kind?: string | null;
  isSystem?: boolean;
  isActive?: boolean;
  descriptionEn?: string | null;
  descriptionAr?: string | null;
  descriptionHe?: string | null;
}

interface StageDefinitionRow {
  id: string;
  code: string;
  nameAr: string;
  nameEn: string;
  nameHe?: string | null;
  isActive: boolean;
}

type DepartmentRow = DepartmentOption;

interface UserFormState {
  username: string;
  firstName: string;
  lastName: string;
  password: string;
  isActive: boolean;
  identity: UserIdentityForm;
  departmentId: string;
  hourlyRate: string;
}

type Segment = "workers" | "staff" | "customers" | "admins" | "all";

const SEGMENT_ROLE_KIND: Record<Exclude<Segment, "all">, string> = {
  workers: "PRODUCTION_WORKER",
  staff: "STAFF",
  customers: "CUSTOMER",
  admins: "ADMIN",
};

function identityFromSegment(seg: Segment): UserIdentityForm {
  if (seg === "workers") {
    return {
      identityRoleCode: "PRODUCTION_WORKER",
      employeeType: "WORKER",
      staffTypeId: "",
      stageDefinitionIds: [],
    };
  }
  if (seg === "staff") {
    return {
      identityRoleCode: "PRODUCTION_WORKER",
      employeeType: "STAFF",
      staffTypeId: "",
      stageDefinitionIds: [],
    };
  }
  if (seg === "customers") {
    return { ...emptyUserIdentityForm(), identityRoleCode: "CUSTOMER" };
  }
  if (seg === "admins") {
    return {
      ...emptyUserIdentityForm(),
      identityRoleCode: "SYSTEM_ADMINISTRATOR",
    };
  }
  return emptyUserIdentityForm();
}

function roleUsesDepartment(
  kind: string | undefined | null,
  roleCode?: string,
): boolean {
  if (
    kind === "CUSTOMER" ||
    kind === "PRODUCTION_WORKER" ||
    kind === "ADMIN" ||
    kind === "STAFF"
  ) {
    return false;
  }
  if (
    roleCode === "CUSTOMER" ||
    roleCode === "PRODUCTION_WORKER" ||
    roleCode === "SYSTEM_ADMINISTRATOR"
  ) {
    return false;
  }
  return Boolean(kind || roleCode);
}

function userShowsDepartment(user: UserRow): boolean {
  const roles = user.roles ?? [];
  if (!roles.length) return false;
  return roles.some((r) => roleUsesDepartment(r.role.kind, r.role.code));
}

function namesFromUsername(username: string): {
  firstName: string;
  lastName: string;
} {
  const normalized = username.trim().toLowerCase();
  const parts = normalized.split(/[._-]+/).filter(Boolean);
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  if (parts.length >= 2) {
    return {
      firstName: cap(parts[0] ?? normalized),
      lastName: cap(parts.slice(1).join(" ")),
    };
  }
  const single = cap(normalized);
  return { firstName: single, lastName: single };
}

const emptyForm = (segment: Segment = "workers"): UserFormState => ({
  username: "",
  firstName: "",
  lastName: "",
  password: "",
  isActive: true,
  identity: identityFromSegment(segment),
  departmentId: "",
  hourlyRate: "",
});

export default function UsersPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-12 w-full max-w-xl" />
          <Skeleton className="h-64 w-full" />
        </div>
      }
    >
      <UsersHub />
    </Suspense>
  );
}

function UsersHub() {
  const locale = useLocale();
  const t = useTranslations("users");
  const tCommon = useTranslations("common");
  const kit = useKitCopy();
  const tVal = useTranslations("validation");
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const me = useAuthMe();
  const canManageStaffTypes = can(me.data, "role.manage");
  const router = useRouter();

  const [segment, setSegment] = useState<Segment>("workers");
  const [q, setQ] = useState("");
  const [roleCode, setRoleCode] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [staffTypeId, setStaffTypeId] = useState("");
  const [isActive, setIsActive] = useState("");
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [form, setForm] = useState<UserFormState>(() => emptyForm("workers"));
  const [formError, setFormError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{
    type: "activate" | "deactivate" | "reset";
    user: UserRow;
  } | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [editDeepLinkHandled, setEditDeepLinkHandled] = useState(false);

  const showRoleFilter = segment === "all";
  const showStaffTypeFilter = segment === "staff";
  const showDepartmentFilter = segment === "all";
  const showDepartmentColumn = segment === "all";

  const listParams = useMemo(() => {
    const params = new URLSearchParams({ page: String(page), pageSize: "20" });
    if (q.trim()) params.set("q", q.trim());
    if (showRoleFilter && roleCode) {
      params.set("roleCode", roleCode);
    } else if (showStaffTypeFilter && staffTypeId) {
      params.set("staffTypeId", staffTypeId);
    } else if (segment !== "all") {
      params.set("roleKind", SEGMENT_ROLE_KIND[segment]);
    }
    if (showDepartmentFilter && departmentId) {
      params.set("departmentId", departmentId);
    }
    if (isActive) params.set("isActive", isActive);
    return params.toString();
  }, [
    q,
    roleCode,
    departmentId,
    isActive,
    page,
    segment,
    showRoleFilter,
    showDepartmentFilter,
    showStaffTypeFilter,
    staffTypeId,
  ]);

  const usersQuery = useQuery({
    queryKey: ["people", listParams],
    queryFn: () =>
      apiFetch<{
        data: UserRow[];
        meta: { page: number; totalPages: number; totalItems: number };
      }>(`/api/v1/users?${listParams}`),
    placeholderData: keepPreviousData,
  });

  const rolesQuery = useQuery({
    queryKey: ["roles"],
    queryFn: () => apiFetch<RoleRow[]>("/api/v1/roles"),
  });

  const departmentsQuery = useQuery({
    queryKey: ["departments-people"],
    queryFn: () =>
      apiFetch<{ data: DepartmentRow[] }>(
        "/api/v1/departments?pageSize=100",
      ).then((r) => r.data ?? []),
    enabled: showDepartmentFilter || formOpen,
  });

  const staffTypesQuery = useQuery({
    queryKey: ["staff-types", "assign"],
    queryFn: () => apiFetch<RoleRow[]>("/api/v1/staff-types"),
    enabled: formOpen || showStaffTypeFilter,
  });

  const stagesQuery = useQuery({
    queryKey: ["production-stage-library"],
    queryFn: () =>
      apiFetch<StageDefinitionRow[]>("/api/v1/production-stage-library"),
    enabled: formOpen,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const username = form.username.trim().toLowerCase();
      if (!username) {
        throw new ApiClientError(tVal("usernameRequired"), 400);
      }
      if (
        form.identity.identityRoleCode === "PRODUCTION_WORKER" &&
        !form.identity.employeeType
      ) {
        throw new ApiClientError(tVal("employeeTypeRequired"), 400);
      }
      if (
        form.identity.identityRoleCode === "PRODUCTION_WORKER" &&
        form.identity.employeeType === "STAFF" &&
        !form.identity.staffTypeId
      ) {
        throw new ApiClientError(tVal("staffTypeRequired"), 400);
      }

      const lookup = [
        ...(rolesQuery.data ?? []),
        ...(staffTypesQuery.data ?? []),
      ];
      const roleId = submittedRoleId(form.identity, lookup);
      if (!roleId) {
        throw new ApiClientError(tVal("roleRequired"), 400);
      }
      const usesDepartment = false;
      const stageIds = submittedStageDefinitionIds(form.identity);
      const hourlyRateRaw = form.hourlyRate.trim();
      const hourlyRate = hourlyRateRaw
        ? Number(hourlyRateRaw.replace(",", "."))
        : undefined;

      if (editing) {
        const firstName = form.firstName.trim();
        const lastName = form.lastName.trim();
        if (!firstName || !lastName) {
          throw new ApiClientError(tVal("nameRequired"), 400);
        }
        return apiFetch<UserRow>(`/api/v1/users/${editing.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            username,
            firstName,
            lastName,
            isActive: form.isActive,
            departmentId: usesDepartment ? form.departmentId || null : null,
            roleIds: [roleId],
            ...(form.password.trim() ? { password: form.password.trim() } : {}),
            stageDefinitionIds: stageIds,
            ...(hourlyRate != null && Number.isFinite(hourlyRate)
              ? { hourlyRate }
              : {}),
          }),
        });
      }

      const { firstName, lastName } = namesFromUsername(username);

      return apiFetch<UserRow & { temporaryPassword?: string }>(
        "/api/v1/users",
        {
          method: "POST",
          body: JSON.stringify({
            username,
            firstName,
            lastName,
            roleIds: [roleId],
            ...(form.password.trim() ? { password: form.password } : {}),
            stageDefinitionIds: stageIds,
            ...(hourlyRate != null && Number.isFinite(hourlyRate)
              ? { hourlyRate }
              : {}),
          }),
        },
      );
    },
    onSuccess: async (data) => {
      setFormError(null);
      await queryClient.invalidateQueries({ queryKey: ["people"] });
      setFormOpen(false);
      const wasEditing = !!editing;
      const passwordSet = wasEditing && !!form.password.trim();
      setEditing(null);
      const temp =
        "temporaryPassword" in data && data.temporaryPassword
          ? ` ${t("tempPassword")} ${data.temporaryPassword}`
          : "";
      const passwordNote = passwordSet ? ` ${t("passwordChanged")}` : "";
      setBanner(
        (wasEditing ? t("updated") : t("created")) + temp + passwordNote,
      );
    },
    onError: (err) => setFormError(mutationErrorMessage(err)),
  });

  const actionMutation = useMutation({
    mutationFn: async (): Promise<{ temporaryPassword?: string } | null> => {
      if (!confirm) return null;
      if (confirm.type === "reset") {
        return apiFetch<{ temporaryPassword: string }>(
          `/api/v1/users/${confirm.user.id}/reset-password`,
          { method: "POST" },
        );
      }
      await apiFetch(
        `/api/v1/users/${confirm.user.id}/${confirm.type === "activate" ? "activate" : "deactivate"}`,
        { method: "POST" },
      );
      return null;
    },
    onSuccess: async (data) => {
      setConfirmError(null);
      await queryClient.invalidateQueries({ queryKey: ["people"] });
      if (confirm?.type === "reset" && data?.temporaryPassword) {
        setBanner(`${t("passwordReset")} ${data.temporaryPassword}`);
      } else if (confirm?.type === "activate") {
        setBanner(t("activated"));
      } else if (confirm?.type === "deactivate") {
        setBanner(t("deactivated"));
      }
      setConfirm(null);
    },
    onError: (err) => setConfirmError(mutationErrorMessage(err)),
  });

  function openCreate() {
    setEditing(null);
    setForm(emptyForm(segment));
    setFormError(null);
    setFormOpen(true);
  }

  function openEdit(user: UserRow) {
    const assigned = (user.roles ?? [])[0]?.role;
    const identity = assigned
      ? {
          ...hydrateUserIdentityForm(assigned),
          stageDefinitionIds:
            assigned.kind === "PRODUCTION_WORKER" ||
            assigned.code === "PRODUCTION_WORKER"
              ? (user.stageDefinitionIds ?? [])
              : [],
        }
      : emptyUserIdentityForm();
    setEditing(user);
    setForm({
      username: user.username ?? "",
      firstName: user.firstName,
      lastName: user.lastName,
      password: "",
      isActive: user.isActive,
      identity,
      departmentId: user.departmentId ?? user.department?.id ?? "",
      hourlyRate: user.hourlyRate == null ? "" : String(user.hourlyRate),
    });
    setFormError(null);
    setFormOpen(true);
  }

  useEffect(() => {
    if (editDeepLinkHandled || usersQuery.isLoading) return;
    const editId = searchParams.get("edit");
    if (!editId) return;
    const row = (usersQuery.data?.data ?? []).find((u) => u.id === editId);
    if (row) {
      openEdit(row);
      setEditDeepLinkHandled(true);
      return;
    }
    // If not on current page, fetch that user directly.
    void apiFetch<UserRow>(`/api/v1/users/${editId}`)
      .then((user) => {
        openEdit(user);
        setEditDeepLinkHandled(true);
      })
      .catch(() => setEditDeepLinkHandled(true));
  }, [
    editDeepLinkHandled,
    searchParams,
    usersQuery.data,
    usersQuery.isLoading,
  ]);

  const roles = rolesQuery.data ?? [];
  const staffTypes = staffTypesQuery.data ?? [];
  const departments = departmentsQuery.data ?? [];
  const identityRoles = IDENTITY_ROLE_CODES.map((code) =>
    roles.find((r) => r.code === code),
  ).filter((r): r is RoleRow => Boolean(r));
  const isWorkerIdentity =
    form.identity.identityRoleCode === "PRODUCTION_WORKER";
  const showFormStageSkills =
    isWorkerIdentity && form.identity.employeeType === "WORKER";
  const showFormStaffType =
    isWorkerIdentity && form.identity.employeeType === "STAFF";
  const assignableStaffTypes = staffTypes.filter(
    (type) => type.isActive !== false || type.id === form.identity.staffTypeId,
  );
  const activeStages = (stagesQuery.data ?? []).filter((s) => s.isActive);

  const segments: Array<{ key: Segment; label: string }> = [
    { key: "workers", label: t("segmentWorkers") },
    { key: "staff", label: t("segmentStaff") },
    { key: "customers", label: t("segmentCustomers") },
    { key: "admins", label: t("segmentAdmins") },
    { key: "all", label: t("segmentAll") },
  ];

  if (usersQuery.isLoading && !usersQuery.data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-12 w-full max-w-xl" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (usersQuery.isError && !usersQuery.data) {
    return (
      <ErrorState
        title={t("title")}
        description={tCommon("loadFailed")}
        onRetry={() => usersQuery.refetch()}
        retryLabel={tCommon("retry")}
      />
    );
  }

  const rows = usersQuery.data?.data ?? [];
  const meta = usersQuery.data?.meta;

  const activeCount = rows.filter((r) => r.isActive).length;
  const weekAgo = Date.now() - 7 * 86_400_000;
  const seenThisWeek = rows.filter(
    (r) => r.lastLoginAt && new Date(r.lastLoginAt).getTime() >= weekAgo,
  ).length;
  const columns: DataColumn<UserRow>[] = [
    {
      key: "name",
      header: t("name" as never),
      cell: (row) => (
        <span className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--maher-brand-soft)] text-[12px] font-semibold text-[var(--maher-brand)]">
            {`${row.firstName?.[0] ?? ""}${row.lastName?.[0] ?? ""}`.toUpperCase() ||
              "·"}
          </span>
          <span className="min-w-0">
            <span className="block truncate font-semibold text-[var(--maher-text-primary)]">{`${row.firstName} ${row.lastName}`}</span>
            <Ltr className="block truncate text-[12px] text-[var(--maher-text-tertiary)]">
              {row.username ?? row.email ?? "—"}
            </Ltr>
          </span>
        </span>
      ),
    },
    {
      key: "roles",
      header: t("roles"),
      cell: (row) => (
        <span className="flex flex-wrap gap-1">
          {(row.roles ?? []).slice(0, 3).map((ur) => (
            <Stamp
              key={ur.role.id}
              tone={
                ur.role.code.includes("ADMIN")
                  ? "brand"
                  : ur.role.code.includes("WORKER")
                    ? "info"
                    : "neutral"
              }
              size="sm"
            >
              {localizedName(locale, ur.role)}
            </Stamp>
          ))}
          {(row.roles ?? []).length > 3 ? (
            <Stamp
              tone="neutral"
              size="sm"
            >{`+${(row.roles ?? []).length - 3}`}</Stamp>
          ) : null}
        </span>
      ),
    },
    {
      key: "department",
      header: t("department"),
      hideBelow: "lg",
      cell: (row) =>
        row.department ? localizedName(locale, row.department) : "—",
    },
    {
      key: "lastLogin",
      header: t("lastLogin"),
      hideBelow: "xl",
      cell: (row) =>
        row.lastLoginAt ? (
          <Ltr>
            {new Intl.DateTimeFormat(locale, {
              day: "numeric",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            }).format(new Date(row.lastLoginAt))}
          </Ltr>
        ) : (
          <span className="text-[var(--maher-text-tertiary)]">
            {t("never")}
          </span>
        ),
    },
    {
      key: "status",
      header: t("filterStatus"),
      cell: (row) => (
        <Stamp tone={row.isActive ? "success" : "neutral"} size="sm">
          {row.isActive ? t("active") : t("inactive")}
        </Stamp>
      ),
    },
    {
      key: "actions",
      header: "",
      numeric: true,
      width: "56px",
      cell: (row) => (
        <Menu
          aria-label={tCommon("actions")}
          trigger={
            <Button size="sm" variant="ghost" aria-label={tCommon("actions")}>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          }
          items={[
            {
              id: "edit",
              label: tCommon("edit"),
              icon: <Pencil className="h-4 w-4" />,
              onSelect: () => openEdit(row),
            },
            {
              id: "reset",
              label: t("resetPassword"),
              icon: <KeyRound className="h-4 w-4" />,
              onSelect: () => (
                setConfirmError(null),
                setConfirm({ type: "reset", user: row })
              ),
            },
            {
              id: "toggle",
              label: row.isActive ? t("deactivate") : t("activate"),
              icon: <Power className="h-4 w-4" />,
              tone: row.isActive ? ("error" as const) : ("default" as const),
              separator: true,
              onSelect: () => (
                setConfirmError(null),
                setConfirm({
                  type: row.isActive ? "deactivate" : "activate",
                  user: row,
                })
              ),
            },
          ]}
        />
      ),
    },
  ];

  return (
    <div className="maher-stagger space-y-5">
      <Board tone="brand" wash="top" as="section">
        <div className="grid gap-5 px-5 py-5 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-center">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-[24px] font-semibold leading-8 tracking-[-0.02em] text-[var(--maher-text-primary)] sm:text-[28px] sm:leading-9 rtl:tracking-normal">
                {t("title")}
              </h1>
              <p className="mt-1 max-w-[56ch] text-[14px] leading-5 text-[var(--maher-text-secondary)]">
                {t("description")}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              {canManageStaffTypes ? (
                <Button
                  variant="secondary"
                  onClick={() => router.push("/admin/employees/staff-types")}
                >
                  {t("staffTypes")}
                </Button>
              ) : null}
              <Button onClick={openCreate}>{t("add")}</Button>
            </div>
          </div>
          <div className="min-w-0">
            <Ribbon
              size="sm"
              segments={[
                {
                  key: "active",
                  label: t("active"),
                  value: activeCount,
                  tone: "success",
                },
                {
                  key: "inactive",
                  label: t("inactive"),
                  value: rows.length - activeCount,
                  tone: "neutral",
                },
              ]}
            />
            <div className="mt-3 grid grid-cols-3 gap-4">
              <Figure
                size="sm"
                value={meta?.totalItems ?? rows.length}
                label={t("title")}
              />
              <Figure
                size="sm"
                value={activeCount}
                label={t("active")}
                tone="success"
              />
              <Figure
                size="sm"
                value={seenThisWeek}
                label={t("activeThisWeek")}
                tone="info"
              />
            </div>
          </div>
        </div>
      </Board>

      {banner ? <Alert variant="success">{banner}</Alert> : null}

      <StatusChips
        aria-label={t("title")}
        value={segment}
        onChange={(id) => {
          setSegment(id as Segment);
          setRoleCode("");
          setStaffTypeId("");
          if (id !== "all") setDepartmentId("");
          setPage(1);
        }}
        items={segments.map((s) => ({ id: s.key, label: s.label }))}
      />

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[min(100%,20rem)] flex-1 basis-[20rem]">
          <Input
            value={q}
            onChange={(e) => {
              setPage(1);
              setQ(e.target.value);
            }}
            placeholder={t("searchPlaceholder")}
            withSearchIcon
          />
        </div>
        {showRoleFilter ? (
          <Select
            value={roleCode}
            onChange={(e) => (setPage(1), setRoleCode(e.target.value))}
            aria-label={t("filterRole")}
            className="w-44 shrink-0"
          >
            <option value="">{tCommon("all")}</option>
            {roles.map((role) => (
              <option key={role.id} value={role.code}>
                {localizedName(locale, role)}
              </option>
            ))}
          </Select>
        ) : null}
        {showStaffTypeFilter ? (
          <Select
            value={staffTypeId}
            onChange={(e) => (setPage(1), setStaffTypeId(e.target.value))}
            aria-label={t("staffType")}
            className="w-52 shrink-0"
          >
            <option value="">{t("staffTypeFilterAll")}</option>
            {staffTypes.map((type) => (
              <option key={type.id} value={type.id}>
                {localizedName(locale, type)}
              </option>
            ))}
          </Select>
        ) : null}
        {showDepartmentFilter ? (
          <Select
            value={departmentId}
            onChange={(e) => (setPage(1), setDepartmentId(e.target.value))}
            aria-label={t("department")}
            className="w-48 shrink-0"
          >
            <option value="">{t("allDepartments")}</option>
            {departments.map((dept) => (
              <option key={dept.id} value={dept.id}>
                {localizedName(locale, dept)}
              </option>
            ))}
          </Select>
        ) : null}
        <Select
          value={isActive}
          onChange={(e) => (setPage(1), setIsActive(e.target.value))}
          aria-label={t("filterStatus")}
          className="w-36 shrink-0"
        >
          <option value="">{tCommon("all")}</option>
          <option value="true">{t("active")}</option>
          <option value="false">{t("inactive")}</option>
        </Select>
      </div>

      <DataBoard<UserRow>
        aria-label={t("title")}
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        onRowClick={openEdit}
        loading={usersQuery.isLoading && !usersQuery.data}
        rowClassName={(r) => (r.isActive ? undefined : "opacity-70")}
        mobileRow={(row) => ({
          title: `${row.firstName} ${row.lastName}`,
          meta:
            (row.roles ?? [])
              .map((ur) => localizedName(locale, ur.role))
              .join(", ") ||
            row.username ||
            "",
          trailing: (
            <Stamp tone={row.isActive ? "success" : "neutral"} size="sm">
              {row.isActive ? t("active") : t("inactive")}
            </Stamp>
          ),
        })}
        empty={
          <Board.Empty
            title={t("empty")}
            action={
              <Button size="sm" onClick={openCreate}>
                {t("add")}
              </Button>
            }
          />
        }
        footer={
          meta && meta.totalPages > 1 ? (
            <Pagination
              className="w-full"
              page={page}
              pageSize={20}
              total={meta.totalItems}
              onPageChange={setPage}
              copy={kit.pagination}
            />
          ) : null
        }
      />

      <Sheet
        open={formOpen}
        onClose={() => !saveMutation.isPending && setFormOpen(false)}
        title={editing ? t("edit") : t("add")}
        description={
          editing
            ? `${form.firstName} ${form.lastName}`.trim() || undefined
            : t("description")
        }
        tone="brand"
        widthClassName="max-w-xl"
        closeLabel={tCommon("close")}
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => setFormOpen(false)}
              disabled={saveMutation.isPending}
            >
              {tCommon("cancel")}
            </Button>
            <Button
              loading={saveMutation.isPending}
              onClick={() => saveMutation.mutate()}
            >
              {tCommon("save")}
            </Button>
          </>
        }
      >
        <div className="grid gap-3">
          {formError ? <Alert variant="error">{formError}</Alert> : null}
          <Input
            label={`${t("username")} *`}
            value={form.username}
            onChange={(e) =>
              setForm((f) => ({ ...f, username: e.target.value }))
            }
            autoComplete="off"
            hint={editing ? t("usernameUniqueHint") : undefined}
            required
          />
          <Input
            label={editing ? t("newPassword") : t("password")}
            type="password"
            value={form.password}
            hint={editing ? t("newPasswordHint") : t("passwordHint")}
            onChange={(e) =>
              setForm((f) => ({ ...f, password: e.target.value }))
            }
            autoComplete="new-password"
          />
          {editing ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  label={`${t("firstName")} *`}
                  value={form.firstName}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, firstName: e.target.value }))
                  }
                  required
                />
                <Input
                  label={`${t("lastName")} *`}
                  value={form.lastName}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, lastName: e.target.value }))
                  }
                  required
                />
              </div>
              <Checkbox
                label={t("active")}
                checked={form.isActive}
                onChange={(checked) =>
                  setForm((f) => ({ ...f, isActive: checked }))
                }
              />
            </>
          ) : null}
          <Select
            label={`${t("roles")} *`}
            value={
              identityRoles.find(
                (r) => r.code === form.identity.identityRoleCode,
              )?.id ?? ""
            }
            onChange={(e) => {
              const nextCode = identityRoles.find(
                (r) => r.id === e.target.value,
              )?.code;
              if (!nextCode || !isIdentityRoleCode(nextCode)) return;
              setForm((f) => ({
                ...f,
                identity: applyIdentityChange(
                  f.identity,
                  nextCode as IdentityRoleCode,
                ),
                departmentId: "",
              }));
            }}
            required
          >
            <option value="">—</option>
            {identityRoles.map((role) => (
              <option key={role.id} value={role.id}>
                {localizedName(locale, role)}
              </option>
            ))}
          </Select>
          {isWorkerIdentity ? (
            <Select
              label={`${t("employeeType")} *`}
              value={form.identity.employeeType || "WORKER"}
              onChange={(e) => {
                const next = e.target.value === "STAFF" ? "STAFF" : "WORKER";
                setForm((f) => ({
                  ...f,
                  identity: applyEmployeeTypeChange(f.identity, next),
                }));
              }}
              required
            >
              <option value="WORKER">{t("employeeTypeWorker")}</option>
              <option value="STAFF">{t("employeeTypeStaff")}</option>
            </Select>
          ) : null}
          {showFormStaffType ? (
            <div className="grid gap-2">
              <Select
                label={`${t("staffType")} *`}
                value={form.identity.staffTypeId}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    identity: { ...f.identity, staffTypeId: e.target.value },
                  }))
                }
                required
              >
                <option value="">—</option>
                {assignableStaffTypes.map((type) => (
                  <option key={type.id} value={type.id}>
                    {localizedName(locale, type)}
                  </option>
                ))}
              </Select>
              <p className="text-xs text-[var(--maher-text-tertiary)]">
                {t("staffTypeHint")}
              </p>
            </div>
          ) : null}
          {showFormStageSkills ? (
            <>
              <Input
                label={t("hourlyRate")}
                value={form.hourlyRate}
                onChange={(e) =>
                  setForm((f) => ({ ...f, hourlyRate: e.target.value }))
                }
                hint={t("hourlyRateHint")}
                inputMode="decimal"
                dir="ltr"
              />
              <fieldset className="grid gap-2">
                <legend className="text-sm font-medium text-[var(--maher-text-primary)]">
                  {t("stageSkills")}
                </legend>
                <p className="text-xs text-[var(--maher-text-tertiary)]">
                  {t("stageSkillsHint")}
                </p>
                {stagesQuery.isLoading ? (
                  <p className="text-sm text-[var(--maher-text-tertiary)]">
                    {tCommon("loading")}
                  </p>
                ) : activeStages.length === 0 ? (
                  <p className="text-sm text-[var(--maher-text-tertiary)]">
                    {t("noStagesYet")}
                  </p>
                ) : (
                  <div className="grid gap-1.5 sm:grid-cols-2">
                    {activeStages.map((stage) => {
                      const checked = form.identity.stageDefinitionIds.includes(
                        stage.id,
                      );
                      return (
                        <Checkbox
                          key={stage.id}
                          className="rounded-[12px] border border-[var(--maher-border)] px-3 py-2"
                          label={localizedName(locale, stage, stage.code)}
                          checked={checked}
                          onChange={() =>
                            setForm((f) => ({
                              ...f,
                              identity: {
                                ...f.identity,
                                stageDefinitionIds: checked
                                  ? f.identity.stageDefinitionIds.filter(
                                      (id) => id !== stage.id,
                                    )
                                  : [
                                      ...f.identity.stageDefinitionIds,
                                      stage.id,
                                    ],
                              },
                            }))
                          }
                        />
                      );
                    })}
                  </div>
                )}
              </fieldset>
            </>
          ) : null}
        </div>
      </Sheet>

      <ConfirmDialog
        open={!!confirm}
        title={
          confirm?.type === "reset"
            ? t("resetPassword")
            : confirm?.type === "activate"
              ? t("activate")
              : t("deactivate")
        }
        description={
          confirm?.type === "reset"
            ? t("confirmReset")
            : confirm?.type === "activate"
              ? t("confirmActivate")
              : t("confirmDeactivate")
        }
        danger={confirm?.type === "deactivate" || confirm?.type === "reset"}
        loading={actionMutation.isPending}
        error={confirmError}
        onClose={() => !actionMutation.isPending && setConfirm(null)}
        onConfirm={() => actionMutation.mutate()}
      />
    </div>
  );
}
