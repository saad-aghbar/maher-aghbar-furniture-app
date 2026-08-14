import {
  applyEmployeeTypeChange,
  applyIdentityChange,
  IDENTITY_ROLE_CODES,
  isIdentityRoleCode,
  roleUsesDepartment as roleKindUsesDepartment,
  type IdentityRoleCode,
  type UserIdentityForm,
} from '@maher/permissions';
import type { RoleRow, StaffTypeRow } from '@/api/modules/users';
import type { StageDefinition } from '@/api/modules/workflow';
import { AppText } from '@/components/AppText';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';
import { localizedRoleName } from '../display';
import { RolesTouchBar } from './RolesTouchBar';
import { StaffTypePicker } from './StaffTypePicker';
import { StageSkillsPicker } from './StageSkillsPicker';
import { UserFormSection } from './userSheetForm';

type Props = {
  identity: UserIdentityForm;
  onChange: (next: UserIdentityForm) => void;
  roles: RoleRow[];
  staffTypes: StaffTypeRow[];
  staffTypesLoading?: boolean;
  stages: StageDefinition[];
  stagesLoading?: boolean;
  titleWeight: 'medium' | 'semibold';
};

export function UserIdentityFields({
  identity,
  onChange,
  roles,
  staffTypes,
  staffTypesLoading,
  stages,
  stagesLoading,
  titleWeight,
}: Props) {
  const { t, isRTL, locale } = useLocale();
  const { theme } = useTheme();

  const identityRoles = IDENTITY_ROLE_CODES.map((code) => roles.find((r) => r.code === code)).filter(
    (r): r is RoleRow => Boolean(r),
  );

  const selectedIdentityId =
    identityRoles.find((r) => r.code === identity.identityRoleCode)?.id ?? '';
  const isWorkerIdentity = identity.identityRoleCode === 'PRODUCTION_WORKER';
  const isStaff = isWorkerIdentity && identity.employeeType === 'STAFF';
  const isFloorWorker = isWorkerIdentity && identity.employeeType === 'WORKER';

  return (
    <>
      <UserFormSection icon="shield-outline" label={t('users.roles')} titleWeight={titleWeight}>
        <RolesTouchBar
          roles={identityRoles.map((role) => ({
            id: role.id,
            label: localizedRoleName(role, locale),
          }))}
          value={selectedIdentityId}
          onChange={(roleId) => {
            const code = identityRoles.find((r) => r.id === roleId)?.code;
            if (!code || !isIdentityRoleCode(code)) return;
            onChange(applyIdentityChange(identity, code as IdentityRoleCode));
          }}
        />
      </UserFormSection>

      {isWorkerIdentity ? (
        <UserFormSection
          icon="people-outline"
          label={t('users.employeeType')}
          titleWeight={titleWeight}
        >
          <RolesTouchBar
            roles={[
              { id: 'WORKER', label: t('users.employeeTypeWorker') },
              { id: 'STAFF', label: t('users.employeeTypeStaff') },
            ]}
            value={identity.employeeType || 'WORKER'}
            onChange={(next) => {
              onChange(applyEmployeeTypeChange(identity, next === 'STAFF' ? 'STAFF' : 'WORKER'));
            }}
          />
        </UserFormSection>
      ) : null}

      {isStaff ? (
        <UserFormSection icon="briefcase-outline" label={t('users.staffType')} titleWeight={titleWeight}>
          <AppText
            variant="caption"
            color="muted"
            style={{ textAlign: isRTL ? 'right' : 'left', marginBottom: theme.spacing.xs }}
          >
            {t('users.staffTypeHint')}
          </AppText>
          <StaffTypePicker
            types={staffTypes}
            value={identity.staffTypeId}
            onChange={(staffTypeId) => onChange({ ...identity, staffTypeId })}
            loading={staffTypesLoading}
          />
        </UserFormSection>
      ) : null}

      {isFloorWorker ? (
        <UserFormSection
          icon="construct-outline"
          label={t('users.stageSkills')}
          titleWeight={titleWeight}
        >
          <StageSkillsPicker
            stages={stages.filter((s) => s.isActive)}
            selectedIds={identity.stageDefinitionIds}
            onChange={(ids) => onChange({ ...identity, stageDefinitionIds: ids })}
            loading={stagesLoading}
          />
        </UserFormSection>
      ) : null}
    </>
  );
}

export function identityUsesDepartment(identity: UserIdentityForm): boolean {
  if (identity.identityRoleCode === 'CUSTOMER' || identity.identityRoleCode === 'SYSTEM_ADMINISTRATOR') {
    return false;
  }
  if (identity.identityRoleCode === 'PRODUCTION_WORKER') return false;
  return roleKindUsesDepartment(identity.identityRoleCode);
}
