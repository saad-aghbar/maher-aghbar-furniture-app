import { useEffect, useMemo, useState } from 'react';
import { ScrollView, useWindowDimensions } from 'react-native';
import {
  submittedRoleId,
  submittedStageDefinitionIds,
} from '@maher/permissions';
import { isApiError } from '@/api/errors';
import { toastMessageForError } from '@/api/queryClient';
import { AppText } from '@/components/AppText';
import { useToast } from '@/components/feedback/Toast';
import { TextField } from '@/components/forms/TextField';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { useLocale } from '@/i18n';
import { haptics } from '@/motion';
import { useTheme } from '@/theme';
import {
  useCreateUserMutation,
  useDepartmentsQuery,
  useRolesQuery,
  useStaffTypesQuery,
} from '../query';
import { identityFromSegment, namesFromUsername, type UsersSegment } from '../segment';
import { DepartmentField } from './DepartmentField';
import { DepartmentPickerSheet } from './DepartmentPickerSheet';
import { TempPasswordSheet } from './TempPasswordSheet';
import { identityUsesDepartment, UserIdentityFields } from './UserIdentityFields';
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

const empty = (segment: UsersSegment) => ({
  username: '',
  password: '',
  departmentId: '',
  identity: identityFromSegment(segment),
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
  const staffTypesQuery = useStaffTypesQuery(open, { isActive: true });
  const departmentsQuery = useDepartmentsQuery(open);
  const stagesQuery = useStageLibraryQuery(open);
  const createMutation = useCreateUserMutation();

  const [form, setForm] = useState(() => empty(segment));
  const [error, setError] = useState<string | null>(null);
  const [deptOpen, setDeptOpen] = useState(false);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [createdUsername, setCreatedUsername] = useState<string | null>(null);

  const roles = rolesQuery.data ?? [];
  const staffTypes = staffTypesQuery.data ?? [];
  const departments = departmentsQuery.data?.data ?? [];

  useEffect(() => {
    if (!open) return;
    setForm(empty(segment));
    setError(null);
    setDeptOpen(false);
    setTempPassword(null);
    setCreatedUsername(null);
  }, [open, segment]);

  const showDepartment = identityUsesDepartment(form.identity);
  const selectedDept = departments.find((d) => d.id === form.departmentId);
  const lookupRoles = useMemo(() => [...roles, ...staffTypes], [roles, staffTypes]);

  const resetAndClose = () => {
    setForm(empty(segment));
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
    if (form.identity.identityRoleCode === 'PRODUCTION_WORKER' && !form.identity.employeeType) {
      setError(t('validation.employeeTypeRequired'));
      return;
    }
    if (
      form.identity.identityRoleCode === 'PRODUCTION_WORKER' &&
      form.identity.employeeType === 'STAFF' &&
      !form.identity.staffTypeId
    ) {
      setError(t('validation.staffTypeRequired'));
      return;
    }
    const roleId = submittedRoleId(form.identity, lookupRoles);
    if (!roleId) {
      setError(t('validation.roleRequired'));
      return;
    }

    const { firstName, lastName } = namesFromUsername(username);

    try {
      const created = await createMutation.mutateAsync({
        username,
        firstName,
        lastName,
        roleIds: [roleId],
        ...(showDepartment && form.departmentId ? { departmentId: form.departmentId } : {}),
        ...(form.password.trim() ? { password: form.password } : {}),
        stageDefinitionIds: submittedStageDefinitionIds(form.identity),
      });

      void haptics.confirmLight();
      const temp = created.temporaryPassword;
      if (temp) {
        setCreatedUsername(created.username ?? username);
        setTempPassword(temp);
        setForm(empty(segment));
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
              onChangeText={(v) => setForm((f) => ({ ...f, username: v }))}
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
              onChangeText={(v) => setForm((f) => ({ ...f, password: v }))}
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

          <UserIdentityFields
            identity={form.identity}
            onChange={(identity) =>
              setForm((f) => ({
                ...f,
                identity,
                ...(!identityUsesDepartment(identity) ? { departmentId: '' } : {}),
              }))
            }
            roles={roles}
            staffTypes={staffTypes}
            staffTypesLoading={staffTypesQuery.isLoading}
            stages={stagesQuery.data ?? []}
            stagesLoading={stagesQuery.isLoading}
            titleWeight={titleWeight}
          />

          {form.identity.identityRoleCode === 'CUSTOMER' ? (
            <AppText
              variant="caption"
              color="muted"
              style={{ textAlign: isRTL ? 'right' : 'left' }}
            >
              {t('users.customerPortalHint')}
            </AppText>
          ) : null}

          {showDepartment ? (
            <UserFormSection
              icon="business-outline"
              label={t('users.department')}
              titleWeight={titleWeight}
            >
              <DepartmentField
                department={selectedDept}
                onPress={() => setDeptOpen(true)}
                onClear={() => setForm((f) => ({ ...f, departmentId: '' }))}
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
          onSelect={(id) => setForm((f) => ({ ...f, departmentId: id ?? '' }))}
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
