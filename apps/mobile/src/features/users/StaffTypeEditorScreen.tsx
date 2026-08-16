import { useEffect, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { expandPermissionDependencies, groupedPermissionCatalog } from '@maher/permissions';
import { isApiError } from '@/api/errors';
import { toastMessageForError } from '@/api/queryClient';
import { AppText } from '@/components/AppText';
import { useToast } from '@/components/feedback/Toast';
import { ErrorState } from '@/components/feedback/ErrorState';
import { TextField } from '@/components/forms/TextField';
import { AppScreen } from '@/components/layout/AppScreen';
import { ScreenBackLead } from '@/components/layout/ScreenBackLead';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { SURFACE_TAB_BAR_CLEARANCE } from '@/navigation/tabBarClearance';
import { useTheme } from '@/theme';
import {
  UserFormError,
  UserFormFooter,
  UserFormSection,
} from './components/userSheetForm';
import {
  useCreateStaffTypeMutation,
  useStaffTypeQuery,
  useUpdateStaffTypeMutation,
} from './query';
import { localizedPermissionGroupName, localizedPermissionName } from './permissionLabels';

type Props = { id: string };

type FormState = {
  nameEn: string;
  nameAr: string;
  nameHe: string;
  descriptionEn: string;
  descriptionAr: string;
  descriptionHe: string;
  permissionCodes: string[];
};

const empty = (): FormState => ({
  nameEn: '',
  nameAr: '',
  nameHe: '',
  descriptionEn: '',
  descriptionAr: '',
  descriptionHe: '',
  permissionCodes: [],
});

/**
 * Mobile staff-type editor — names plus grouped assignable permissions.
 */
export function StaffTypeEditorScreen({ id }: Props) {
  const isNew = id === 'new';
  const { t, locale, isRTL } = useLocale();
  const { theme, colors } = useTheme();
  const { showToast } = useToast();
  const router = useRouter();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const detailQuery = useStaffTypeQuery(isNew ? undefined : id, !isNew);
  const createMutation = useCreateStaffTypeMutation();
  const updateMutation = useUpdateStaffTypeMutation();
  const [form, setForm] = useState<FormState>(empty);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!detailQuery.data) return;
    setForm({
      nameEn: detailQuery.data.nameEn || '',
      nameAr: detailQuery.data.nameAr || '',
      nameHe: detailQuery.data.nameHe || '',
      descriptionEn: detailQuery.data.descriptionEn || '',
      descriptionAr: detailQuery.data.descriptionAr || '',
      descriptionHe: detailQuery.data.descriptionHe || '',
      permissionCodes: (detailQuery.data.permissions ?? []).map((p) => p.permission.code),
    } satisfies FormState);
  }, [detailQuery.data]);

  const readOnly = Boolean(!isNew && detailQuery.data?.isSystem);

  const catalog = useMemo(() => groupedPermissionCatalog({ assignableToStaffOnly: true }), []);
  const needle = search.trim().toLowerCase();
  const visible = useMemo(
    () =>
      catalog
        .map((group) => ({
          ...group,
          permissions: group.permissions.filter((p) => {
            if (!needle) return true;
            const hay = `${p.code} ${p.nameEn} ${p.nameAr} ${p.nameHe}`.toLowerCase();
            return hay.includes(needle);
          }),
        }))
        .filter((g) => g.permissions.length > 0),
    [catalog, needle],
  );

  const onSubmit = async () => {
    setError(null);
    if (readOnly) return;
    if (!form.nameEn.trim() || !form.nameAr.trim()) {
      setError(t('validation.nameRequired'));
      return;
    }
    const body = {
      nameEn: form.nameEn.trim(),
      nameAr: form.nameAr.trim(),
      nameHe: form.nameHe.trim() || undefined,
      descriptionEn: form.descriptionEn.trim() || undefined,
      descriptionAr: form.descriptionAr.trim() || undefined,
      descriptionHe: form.descriptionHe.trim() || undefined,
      permissionCodes: expandPermissionDependencies(form.permissionCodes),
    };
    try {
      if (isNew) {
        await createMutation.mutateAsync(body);
        showToast({ variant: 'success', message: t('users.staffTypeCreated') });
      } else {
        await updateMutation.mutateAsync({ id, body });
        showToast({ variant: 'success', message: t('users.staffTypeUpdated') });
      }
      void haptics.confirmLight();
      router.replace('/(app)/(admin)/users/staff-types' as Href);
    } catch (err) {
      void haptics.error();
      setError(isApiError(err) ? toastMessageForError(err) : t('common.actionFailed'));
    }
  };

  if (!isNew && detailQuery.isError && !detailQuery.data) {
    return (
      <AppScreen>
        <ErrorState
          title={t('users.editStaffType')}
          description={t('mobile.adminHome.errorBody')}
          retryLabel={t('mobile.adminHome.retry')}
          onRetry={() => void detailQuery.refetch()}
        />
      </AppScreen>
    );
  }

  return (
    <AppScreen>
      <View style={{ minHeight: theme.sizes.touch.min, justifyContent: 'center' }}>
        <View
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            ...(isRTL ? { right: 0 } : { left: 0 }),
            zIndex: 1,
            justifyContent: 'center',
          }}
        >
          <ScreenBackLead fallback={'/(app)/(admin)/users/staff-types' as Href} />
        </View>
        <AppText
          variant="largeTitle"
          weight={titleWeight}
          align="center"
          numberOfLines={1}
          style={{ paddingHorizontal: theme.sizes.touch.min + theme.spacing.sm }}
        >
          {isNew ? t('users.newStaffType') : readOnly ? t('users.view') : t('users.editStaffType')}
        </AppText>
      </View>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          gap: theme.spacing.md,
          paddingBottom: theme.spacing['3xl'] + SURFACE_TAB_BAR_CLEARANCE,
        }}
      >
        <AppText
          variant="bodySecondary"
          color="secondary"
          style={{ textAlign: isRTL ? 'right' : 'left' }}
        >
          {readOnly ? t('users.systemPresetReadOnly') : t('users.staffTypesDescription')}
        </AppText>
        <UserFormSection icon="text-outline" label={t('users.name')} titleWeight={titleWeight}>
          <TextField
            label={t('users.nameEn')}
            value={form.nameEn}
            editable={!readOnly}
            onChangeText={(v) => setForm((f) => ({ ...f, nameEn: v }))}
          />
          <TextField
            label={t('users.nameAr')}
            value={form.nameAr}
            editable={!readOnly}
            onChangeText={(v) => setForm((f) => ({ ...f, nameAr: v }))}
          />
          <TextField
            label={`${t('users.nameHe')} (${t('users.optional')})`}
            value={form.nameHe}
            editable={!readOnly}
            onChangeText={(v) => setForm((f) => ({ ...f, nameHe: v }))}
          />
          <TextField
            label={`${t('users.descriptionEn')} (${t('users.optional')})`}
            value={form.descriptionEn}
            editable={!readOnly}
            onChangeText={(v) => setForm((f) => ({ ...f, descriptionEn: v }))}
          />
          <TextField
            label={`${t('users.descriptionAr')} (${t('users.optional')})`}
            value={form.descriptionAr}
            editable={!readOnly}
            onChangeText={(v) => setForm((f) => ({ ...f, descriptionAr: v }))}
          />
          <TextField
            label={`${t('users.descriptionHe')} (${t('users.optional')})`}
            value={form.descriptionHe}
            editable={!readOnly}
            onChangeText={(v) => setForm((f) => ({ ...f, descriptionHe: v }))}
          />
        </UserFormSection>

        <UserFormSection icon="shield-outline" label={t('users.permissions')} titleWeight={titleWeight}>
          <TextField
            value={search}
            onChangeText={setSearch}
            placeholder={t('users.searchPermissions')}
            autoCapitalize="none"
            autoCorrect={false}
          />
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
              {t('users.permissionCount', { n: form.permissionCodes.length })}
            </AppText>
          </View>
          {visible.map((group) => (
            <View
              key={group.group}
              style={{
                borderRadius: theme.radius.lg,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.surfaceSecondary,
                overflow: 'hidden',
              }}
            >
              <View
                style={{
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingHorizontal: theme.spacing.md,
                  paddingVertical: theme.spacing.sm,
                  borderBottomWidth: 1,
                  borderBottomColor: colors.border,
                }}
              >
                <AppText variant="caption" weight={titleWeight} color="brand">
                  {localizedPermissionGroupName(group.group, locale)}
                </AppText>
                <AppText variant="caption" color="muted">
                  {String(group.permissions.length)}
                </AppText>
              </View>
              {group.permissions.map((perm) => {
                const checked = form.permissionCodes.includes(perm.code);
                return (
                  <AnimatedPressable
                    key={perm.code}
                    variant="button"
                    disabled={readOnly}
                    onPress={() => {
                      if (readOnly) return;
                      void haptics.selection();
                      setForm((f) => {
                        const next = checked
                          ? f.permissionCodes.filter((c) => c !== perm.code)
                          : [...f.permissionCodes, perm.code];
                        return { ...f, permissionCodes: expandPermissionDependencies(next) };
                      });
                    }}
                    style={{
                      flexDirection: isRTL ? 'row-reverse' : 'row',
                      alignItems: 'center',
                      gap: theme.spacing.md,
                      paddingHorizontal: theme.spacing.md,
                      paddingVertical: theme.spacing.md,
                      backgroundColor: checked ? colors.brandSoft : 'transparent',
                      opacity: readOnly ? 0.85 : 1,
                    }}
                  >
                    <View
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: 11,
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderWidth: 1.5,
                        borderColor: checked ? colors.brand : colors.borderStrong,
                        backgroundColor: checked ? colors.brand : colors.surface,
                      }}
                    >
                      {checked ? <Ionicons name="checkmark" size={13} color={colors.onBrand} /> : null}
                    </View>
                    <View style={{ flex: 1, gap: 2, alignItems: isRTL ? 'flex-end' : 'flex-start' }}>
                      <AppText variant="label" weight={checked ? titleWeight : 'medium'}>
                        {localizedPermissionName(perm.code, locale)}
                      </AppText>
                      {perm.riskLevel === 'sensitive' ? (
                        <AppText variant="caption" color="muted">
                          {t('users.sensitivePermission')}
                        </AppText>
                      ) : null}
                    </View>
                  </AnimatedPressable>
                );
              })}
            </View>
          ))}
        </UserFormSection>

        {error ? <UserFormError message={error} /> : null}
        {!readOnly ? (
          <UserFormFooter
            confirmLabel={t('common.save')}
            onConfirm={() => void onSubmit()}
            onCancel={() => router.back()}
            loading={createMutation.isPending || updateMutation.isPending}
          />
        ) : null}
      </ScrollView>
    </AppScreen>
  );
}
