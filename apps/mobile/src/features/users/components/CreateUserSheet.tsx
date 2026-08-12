import { useEffect, useMemo, useState } from 'react';
import { ScrollView, useWindowDimensions, View } from 'react-native';
import { isApiError } from '@/api/errors';
import { toastMessageForError } from '@/api/queryClient';
import type { RoleRow } from '@/api/modules/users';
import { AppText } from '@/components/AppText';
import { useToast } from '@/components/feedback/Toast';
import { TextField } from '@/components/forms/TextField';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { useLocale } from '@/i18n';
import { haptics } from '@/motion';
import { useTheme } from '@/theme';
import { localizedRoleName } from '../display';
import { useCreateUserMutation, useDepartmentsQuery, useRolesQuery } from '../query';
import { namesFromUsername, type UsersSegment, SEGMENT_ROLE_CODE } from '../segment';
import { DepartmentField } from './DepartmentField';
import { DepartmentPickerSheet } from './DepartmentPickerSheet';
import { RolesTouchBar } from './RolesTouchBar';
import { StageSkillsPicker } from './StageSkillsPicker';
import { TempPasswordSheet } from './TempPasswordSheet';
import {
  UserFormError,
  UserFormFooter,
  UserFormSection,
} from './userSheetForm';
import { useStageLibraryQuery } from '@/features/workflow/query';

type Props = {
  open: boolean;
  onClose: () => void;
  segment: UsersSegment;
};

const empty = () => ({
  username: '',
  password: '',
  roleId: '',
  departmentId: '',
  stageDefinitionIds: [] as string[],
});

/**
 * Add user sheet — matches web fields with mobile floor boards.
 */
export function CreateUserSheet({ open, onClose, segment }: Props) {
  const { t, isRTL, locale } = useLocale();
  const { theme } = useTheme();
  const { showToast } = useToast();
  const { height } = useWindowDimensions();
  const sheetHeight = Math.min(Math.round(height * 0.9), 760);
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  const rolesQuery = useRolesQuery(open);
  const departmentsQuery = useDepartmentsQuery(open);
  const stagesQuery = useStageLibraryQuery(open);
  const createMutation = useCreateUserMutation();

  const [form, setForm] = useState(empty);
  const [error, setError] = useState<string | null>(null);
  const [deptOpen, setDeptOpen] = useState(false);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [createdUsername, setCreatedUsername] = useState<string | null>(null);

  const roles = rolesQuery.data ?? [];
  const departments = departmentsQuery.data?.data ?? [];

  const preferredRoleId = useMemo(() => {
    if (segment === 'all') return '';
    const code = SEGMENT_ROLE_CODE[segment];
    return roles.find((r) => r.code === code)?.id ?? '';
  }, [roles, segment]);

  useEffect(() => {
    if (!open) return;
    setForm({ ...empty(), roleId: preferredRoleId });
    setError(null);
    setDeptOpen(false);
    setTempPassword(null);
    setCreatedUsername(null);
  }, [open, preferredRoleId]);

  const selectedRole: RoleRow | undefined = roles.find((r) => r.id === form.roleId);
  const isCustomer = selectedRole?.code === 'CUSTOMER';
  const isWorker = selectedRole?.code === 'PRODUCTION_WORKER';
  const isAdmin = selectedRole?.code === 'SYSTEM_ADMINISTRATOR';
  const showDepartment = !isCustomer && !isWorker && !isAdmin;
  const selectedDept = departments.find((d) => d.id === form.departmentId);

  const set = <K extends keyof ReturnType<typeof empty>>(
    key: K,
    value: ReturnType<typeof empty>[K],
  ) => setForm((f) => ({ ...f, [key]: value }));

  const resetAndClose = () => {
    setForm(empty());
    setError(null);
    setDeptOpen(false);
    setTempPassword(null);
    setCreatedUsername(null);
    onClose();
  };

  const onSubmit = async () => {
    setError(null);
    const username = form.username.trim().toLowerCase();
    if (username.length < 2) {
      setError(t('validation.usernameRequired'));
      return;
    }
    if (!form.roleId) {
      setError(t('validation.roleRequired'));
      return;
    }

    const { firstName, lastName } = namesFromUsername(username);

    try {
      const created = await createMutation.mutateAsync({
        username,
        firstName,
        lastName,
        roleIds: [form.roleId],
        ...(showDepartment && form.departmentId ? { departmentId: form.departmentId } : {}),
        ...(form.password.trim() ? { password: form.password } : {}),
        ...(isWorker ? { stageDefinitionIds: form.stageDefinitionIds } : {}),
      });

      void haptics.confirmLight();
      const temp = created.temporaryPassword;
      if (temp) {
        setCreatedUsername(created.username ?? username);
        setTempPassword(temp);
        setForm(empty());
      } else {
        resetAndClose();
        showToast({ variant: 'success', message: t('users.created') });
      }
    } catch (err) {
      void haptics.error();
      setError(isApiError(err) ? toastMessageForError(err) : t('common.actionFailed'));
    }
  };

  const formOpen = open && !tempPassword;

  return (
    <>
      <BottomSheet
        open={formOpen}
        onClose={resetAndClose}
        title={t('users.add')}
        sheetHeight={sheetHeight}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ gap: theme.spacing.md, paddingBottom: theme.spacing.sm }}
        >
          <UserFormSection icon="person-outline" label={t('users.username')} titleWeight={titleWeight}>
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

          <UserFormSection icon="key-outline" label={t('users.password')} titleWeight={titleWeight}>
            <TextField
              value={form.password}
              onChangeText={(v) => set('password', v)}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
            />
            <AppText
              variant="caption"
              color="muted"
              style={{ textAlign: isRTL ? 'right' : 'left' }}
            >
              {t('users.passwordHint')}
            </AppText>
          </UserFormSection>

          <UserFormSection icon="shield-outline" label={t('users.roles')} titleWeight={titleWeight}>
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
                  setForm((f) => ({ ...f, stageDefinitionIds: [] }));
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
                onChange={(ids) => setForm((f) => ({ ...f, stageDefinitionIds: ids }))}
                loading={stagesQuery.isLoading}
              />
            </UserFormSection>
          ) : null}

          {error ? <UserFormError message={error} /> : null}
        </ScrollView>

        <UserFormFooter
          confirmLabel={t('common.save')}
          onConfirm={() => void onSubmit()}
          onCancel={resetAndClose}
          loading={createMutation.isPending}
        />
      </BottomSheet>

      {showDepartment ? (
        <DepartmentPickerSheet
          open={deptOpen}
          onClose={() => setDeptOpen(false)}
          departments={departments}
          selectedId={form.departmentId || null}
          onSelect={(id) => set('departmentId', id ?? '')}
          overlay
        />
      ) : null}

      <TempPasswordSheet
        open={Boolean(tempPassword)}
        onClose={() => {
          setTempPassword(null);
          setCreatedUsername(null);
          onClose();
          showToast({ variant: 'success', message: t('users.created') });
        }}
        title={t('users.add')}
        message={t('users.tempPassword')}
        username={createdUsername}
        temporaryPassword={tempPassword ?? ''}
      />
    </>
  );
}
