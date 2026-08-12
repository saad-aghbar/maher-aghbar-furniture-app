import { useEffect, useState } from 'react';
import { ScrollView, useWindowDimensions, View } from 'react-native';
import { isApiError } from '@/api/errors';
import { toastMessageForError } from '@/api/queryClient';
import type { RoleRow, UserRow } from '@/api/modules/users';
import { AppText } from '@/components/AppText';
import { useToast } from '@/components/feedback/Toast';
import { TextField } from '@/components/forms/TextField';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { useLocale } from '@/i18n';
import { haptics } from '@/motion';
import { useTheme } from '@/theme';
import { localizedRoleName } from '../display';
import { useDepartmentsQuery, useRolesQuery, useUpdateUserMutation } from '../query';
import { DepartmentField } from './DepartmentField';
import { DepartmentPickerSheet } from './DepartmentPickerSheet';
import { RolesTouchBar } from './RolesTouchBar';
import { StageSkillsPicker } from './StageSkillsPicker';
import {
  UserActiveToggle,
  UserFormError,
  UserFormFooter,
  UserFormSection,
} from './userSheetForm';
import { useStageLibraryQuery } from '@/features/workflow/query';


type Props = {
  open: boolean;
  onClose: () => void;
  user: UserRow | null;
  /** Opened from “New password” — require entering a password to save. */
  passwordMode?: boolean;
};

type FormState = {
  username: string;
  password: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  roleId: string;
  departmentId: string;
  stageDefinitionIds: string[];
};

function formFromUser(user: UserRow): FormState {
  return {
    username: user.username ?? '',
    password: '',
    firstName: user.firstName ?? '',
    lastName: user.lastName ?? '',
    isActive: user.isActive,
    roleId: user.roles?.[0]?.role.id ?? '',
    departmentId: user.departmentId ?? user.department?.id ?? '',
    stageDefinitionIds: user.stageDefinitionIds ?? [],
  };
}

/**
 * Edit user sheet — username, password, names, active, role, department.
 */
export function EditUserSheet({ open, onClose, user, passwordMode = false }: Props) {
  const { t, isRTL, locale } = useLocale();
  const { theme } = useTheme();
  const { showToast } = useToast();
  const { height } = useWindowDimensions();
  const sheetHeight = Math.min(Math.round(height * 0.92), 820);
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  const rolesQuery = useRolesQuery(open && !passwordMode);
  const departmentsQuery = useDepartmentsQuery(open && !passwordMode);
  const stagesQuery = useStageLibraryQuery(open && !passwordMode);
  const updateMutation = useUpdateUserMutation();

  const [form, setForm] = useState<FormState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deptOpen, setDeptOpen] = useState(false);

  const roles = rolesQuery.data ?? [];
  const departments = departmentsQuery.data?.data ?? [];

  useEffect(() => {
    if (!open || !user) {
      setForm(null);
      setError(null);
      setDeptOpen(false);
      return;
    }
    setForm(formFromUser(user));
    setError(null);
  }, [open, user, passwordMode]);

  const selectedRole: RoleRow | undefined = form
    ? roles.find((r) => r.id === form.roleId) ?? user?.roles?.[0]?.role
    : undefined;
  const isCustomer =
    selectedRole?.code === 'CUSTOMER' ||
    (user?.roles ?? []).some((r) => r.role.code === 'CUSTOMER');
  const isWorker = selectedRole?.code === 'PRODUCTION_WORKER';
  const isAdmin = selectedRole?.code === 'SYSTEM_ADMINISTRATOR';
  const showDepartment = !isCustomer && !isWorker && !isAdmin;
  const selectedDept = form
    ? departments.find((d) => d.id === form.departmentId)
    : undefined;

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => (f ? { ...f, [key]: value } : f));

  const onSubmit = async () => {
    if (!form || !user) return;
    setError(null);
    const username = form.username.trim().toLowerCase();
    const firstName = form.firstName.trim();
    const lastName = form.lastName.trim();
    const password = form.password.trim();

    if (passwordMode) {
      if (!password) {
        setError(t('users.setPasswordHint'));
        return;
      }
      try {
        await updateMutation.mutateAsync({
          id: user.id,
          body: { password },
        });
        void haptics.confirmLight();
        onClose();
        showToast({
          variant: 'success',
          message: t('users.passwordChanged'),
        });
      } catch (err) {
        void haptics.error();
        setError(isApiError(err) ? toastMessageForError(err) : t('common.actionFailed'));
      }
      return;
    }

    if (username.length < 2) {
      setError(t('validation.usernameRequired'));
      return;
    }
    if (!firstName || !lastName) {
      setError(t('validation.nameRequired'));
      return;
    }
    if (!form.roleId) {
      setError(t('validation.roleRequired'));
      return;
    }

    try {
      await updateMutation.mutateAsync({
        id: user.id,
        body: {
          username,
          firstName,
          lastName,
          isActive: form.isActive,
          roleIds: [form.roleId],
          ...(showDepartment
            ? { departmentId: form.departmentId || null }
            : isCustomer
              ? { departmentId: null }
              : {}),
          ...(isWorker ? { stageDefinitionIds: form.stageDefinitionIds } : {}),
        },
      });
      void haptics.confirmLight();
      onClose();
      showToast({
        variant: 'success',
        message: t('users.updated'),
      });
    } catch (err) {
      void haptics.error();
      setError(isApiError(err) ? toastMessageForError(err) : t('common.actionFailed'));
    }
  };

  const passwordForm = passwordMode && form ? (
    <View style={{ gap: theme.spacing.md }}>
      <UserFormSection
        icon="key-outline"
        label={t('users.newPassword')}
        titleWeight={titleWeight}
      >
        {user?.username ? (
          <View style={{ gap: 4 }}>
            <AppText
              variant="caption"
              color="muted"
              style={{ textAlign: isRTL ? 'right' : 'left' }}
            >
              {t('users.username')}
            </AppText>
            <AppText
              variant="label"
              weight="medium"
              dir="ltr"
              style={{ textAlign: isRTL ? 'right' : 'left' }}
            >
              {user.username}
            </AppText>
          </View>
        ) : null}
        <TextField
          label={t('users.newPassword')}
          value={form.password}
          onChangeText={(v) => set('password', v)}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus
        />
        <AppText
          variant="caption"
          color="muted"
          style={{ textAlign: isRTL ? 'right' : 'left' }}
        >
          {t('users.setPasswordHint')}
        </AppText>
      </UserFormSection>

      {error ? <UserFormError message={error} /> : null}

      <UserFormFooter
        confirmLabel={t('common.save')}
        onConfirm={() => void onSubmit()}
        onCancel={onClose}
        loading={updateMutation.isPending}
        compact
      />
    </View>
  ) : null;

  return (
    <>
      <BottomSheet
        open={open && Boolean(user && form)}
        onClose={onClose}
        title={passwordMode ? t('users.newPassword') : t('users.edit')}
        fitContent={passwordMode}
        sheetHeight={passwordMode ? undefined : sheetHeight}
      >
        {form ? (
          passwordMode ? (
            passwordForm
          ) : (
            <>
              <ScrollView
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ gap: theme.spacing.md, paddingBottom: theme.spacing.sm }}
              >
                <UserFormSection
                  icon="person-outline"
                  label={t('users.username')}
                  titleWeight={titleWeight}
                >
                  <TextField
                    value={form.username}
                    onChangeText={(v) => set('username', v)}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <AppText
                    variant="caption"
                    color="muted"
                    style={{ textAlign: isRTL ? 'right' : 'left' }}
                  >
                    {t('users.usernameUniqueHint')}
                  </AppText>
                </UserFormSection>

                <UserFormSection
                  icon="text-outline"
                  label={t('users.name')}
                  titleWeight={titleWeight}
                >
                  <TextField
                    label={t('users.firstName')}
                    value={form.firstName}
                    onChangeText={(v) => set('firstName', v)}
                  />
                  <TextField
                    label={t('users.lastName')}
                    value={form.lastName}
                    onChangeText={(v) => set('lastName', v)}
                  />
                </UserFormSection>

                <UserActiveToggle
                  active={form.isActive}
                  onChange={(next) => set('isActive', next)}
                />

                <UserFormSection
                  icon="shield-outline"
                  label={t('users.roles')}
                  titleWeight={titleWeight}
                >
                  <RolesTouchBar
                    roles={roles.map((role) => ({
                      id: role.id,
                      label: localizedRoleName(role, locale),
                    }))}
                    value={form.roleId}
                    onChange={(roleId) => {
                      set('roleId', roleId);
                      const code = roles.find((r) => r.id === roleId)?.code;
                      if (
                        code === 'CUSTOMER' ||
                        code === 'PRODUCTION_WORKER' ||
                        code === 'SYSTEM_ADMINISTRATOR'
                      ) {
                        set('departmentId', '');
                      }
                      if (code !== 'PRODUCTION_WORKER') {
                        set('stageDefinitionIds', []);
                      }
                    }}
                  />
                </UserFormSection>

                {showDepartment ? (
                  <UserFormSection
                    icon="business-outline"
                    label={t('users.department')}
                    titleWeight={titleWeight}
                  >
                    <DepartmentField
                      department={selectedDept}
                      onPress={() => setDeptOpen(true)}
                      onClear={() => set('departmentId', '')}
                    />
                  </UserFormSection>
                ) : null}

                {isWorker ? (
                  <UserFormSection
                    icon="construct-outline"
                    label={t('users.stageSkills')}
                    titleWeight={titleWeight}
                  >
                    <StageSkillsPicker
                      stages={(stagesQuery.data ?? []).filter((s) => s.isActive)}
                      selectedIds={form.stageDefinitionIds}
                      onChange={(ids) => set('stageDefinitionIds', ids)}
                      loading={stagesQuery.isLoading}
                    />
                  </UserFormSection>
                ) : null}

                {error ? <UserFormError message={error} /> : null}
              </ScrollView>

              <UserFormFooter
                confirmLabel={t('common.save')}
                onConfirm={() => void onSubmit()}
                onCancel={onClose}
                loading={updateMutation.isPending}
              />
            </>
          )
        ) : null}
      </BottomSheet>

      {!passwordMode && showDepartment ? (
        <DepartmentPickerSheet
          open={deptOpen}
          onClose={() => setDeptOpen(false)}
          departments={departments}
          selectedId={form?.departmentId || null}
          onSelect={(id) => set('departmentId', id ?? '')}
          overlay
        />
      ) : null}
    </>
  );
}
