import { useMemo, useState } from 'react';
import { View } from 'react-native';
import {
  groupedPermissionCatalog,
  expandPermissionDependencies,
  toggleGroupPermissionSelection,
  type PermissionGroup,
} from '@maher/permissions';
import { AppText } from '@/components/AppText';
import { FloorCheckGroup, FloorCheckRow } from '@/components/floor/FloorCheckGroup';
import { TextField } from '@/components/forms/TextField';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';
import {
  localizedPermissionDescription,
  localizedPermissionGroupName,
  localizedPermissionName,
} from '../permissionLabels';

type Props = {
  selected: string[];
  onChange?: (next: string[]) => void;
  editable?: boolean;
  /** When true, only selected permissions are listed (staff user preview). */
  selectedOnly?: boolean;
  showSearch?: boolean;
};

export function PermissionBoard({
  selected,
  onChange,
  editable = false,
  selectedOnly = false,
  showSearch = false,
}: Props) {
  const { t, locale, isRTL } = useLocale();
  const { colors, theme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const [search, setSearch] = useState('');
  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const catalog = useMemo(() => groupedPermissionCatalog({ assignableToStaffOnly: true }), []);
  const needle = search.trim().toLowerCase();
  const visible = useMemo(
    () =>
      catalog
        .map((group) => ({
          ...group,
          permissions: group.permissions.filter((p) => {
            if (selectedOnly && !selectedSet.has(p.code)) return false;
            if (!needle) return true;
            const hay = `${p.code} ${p.nameEn} ${p.nameAr} ${p.nameHe} ${p.descriptionEn} ${p.descriptionAr} ${p.descriptionHe}`.toLowerCase();
            return hay.includes(needle);
          }),
        }))
        .filter((g) => g.permissions.length > 0),
    [catalog, needle, selectedOnly, selectedSet],
  );

  return (
    <View style={{ gap: theme.spacing.sm }}>
      {showSearch ? (
        <TextField
          value={search}
          onChangeText={setSearch}
          placeholder={t('users.searchPermissions')}
          autoCapitalize="none"
          autoCorrect={false}
        />
      ) : null}
      <View
        style={{
          alignSelf: isRTL ? 'flex-end' : 'flex-start',
          paddingHorizontal: theme.spacing.md,
          paddingVertical: theme.spacing.xs,
          borderRadius: theme.radius.full,
          backgroundColor: colors.brandSoft,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <AppText variant="caption" color="brand" weight={titleWeight}>
          {t('users.permissionCount', { n: selected.length })}
        </AppText>
      </View>
      {visible.map((group) => {
        const groupCodes = group.permissions.map((p) => p.code);
        const allOn = groupCodes.length > 0 && groupCodes.every((c) => selectedSet.has(c));
        return (
          <FloorCheckGroup
            key={group.group}
            title={localizedPermissionGroupName(group.group as PermissionGroup, locale)}
            actionLabel={
              editable
                ? allOn
                  ? t('users.clearGroup')
                  : t('users.selectAllInGroup')
                : String(group.permissions.length)
            }
            onAction={
              editable
                ? () => onChange?.(toggleGroupPermissionSelection(selected, groupCodes))
                : undefined
            }
          >
            {group.permissions.map((perm) => {
              const checked = selectedSet.has(perm.code);
              return (
                <FloorCheckRow
                  key={perm.code}
                  label={localizedPermissionName(perm.code, locale)}
                  hint={localizedPermissionDescription(perm.code, locale)}
                  checked={checked}
                  disabled={!editable}
                  onToggle={
                    editable
                      ? () => {
                          const next = checked
                            ? selected.filter((c) => c !== perm.code)
                            : [...selected, perm.code];
                          onChange?.(expandPermissionDependencies(next));
                        }
                      : undefined
                  }
                >
                  {perm.riskLevel === 'sensitive' ? (
                    <AppText variant="caption" color="muted">
                      {t('users.sensitivePermission')}
                    </AppText>
                  ) : null}
                </FloorCheckRow>
              );
            })}
          </FloorCheckGroup>
        );
      })}
    </View>
  );
}
