import { useEffect, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { localizedName } from '@maher/i18n';
import { expandPermissionDependencies, groupedPermissionCatalog } from '@maher/permissions';
import { isApiError } from '@/api/errors';
import { toastMessageForError } from '@/api/queryClient';
import { AppText } from '@/components/AppText';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { useToast } from '@/components/feedback/Toast';
import { ErrorState } from '@/components/feedback/ErrorState';
import { TextField } from '@/components/forms/TextField';
import { AppScreen } from '@/components/layout/AppScreen';
import { ScreenBackLead } from '@/components/layout/ScreenBackLead';
import { LocaleNameField } from '@/features/catalog/components/BilingualNameField';
import { useLocale } from '@/i18n';
import { resolveTrilingualIfChanged } from '@/i18n/resolveTrilingualName';
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
  name: string;
  originalName: string;
  nameEn: string;
  nameAr: string;
  nameHe: string;
  description: string;
  originalDescription: string;
  descriptionEn: string;
  descriptionAr: string;
  descriptionHe: string;
  permissionCodes: string[];
};

const empty = (): FormState => ({
  name: '',
  originalName: '',
  nameEn: '',
  nameAr: '',
  nameHe: '',
  description: '',
  originalDescription: '',
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
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();
  const router = useRouter();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const leadSize = theme.sizes.touch.min;
  const detailQuery = useStaffTypeQuery(isNew ? undefined : id, !isNew);
  const createMutation = useCreateStaffTypeMutation();
  const updateMutation = useUpdateStaffTypeMutation();
  const [form, setForm] = useState<FormState>(empty);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!detailQuery.data) return;
    const row = detailQuery.data;
    const shownName = localizedName(locale, row, '');
    const shownDescription = localizedName(
      locale,
      {
        nameEn: row.descriptionEn,
        nameAr: row.descriptionAr,
        nameHe: row.descriptionHe,
      },
      '',
    );
    setForm({
      name: shownName,
      originalName: shownName,
      nameEn: row.nameEn || '',
      nameAr: row.nameAr || '',
      nameHe: row.nameHe || '',
      description: shownDescription,
      originalDescription: shownDescription,
      descriptionEn: row.descriptionEn || '',
      descriptionAr: row.descriptionAr || '',
      descriptionHe: row.descriptionHe || '',
      permissionCodes: (row.permissions ?? []).map((p) => p.permission.code),
    } satisfies FormState);
  }, [detailQuery.data, locale]);

  const readOnly = Boolean(!isNew && detailQuery.data?.isSystem);
  const saving = createMutation.isPending || updateMutation.isPending;
  const canSave = !readOnly && Boolean(form.name.trim());
  const leadPad = leadSize + theme.spacing.sm;
  const trailPad = (!readOnly ? leadSize + theme.spacing['2xl'] : leadSize) + theme.spacing.sm;
  const named = detailQuery.data ?? (form.name ? form : null);
  const headerTitle = isNew
    ? t('users.newStaffType')
    : localizedName(
        locale,
        named,
        form.name || (readOnly ? t('users.view') : t('users.editStaffType')),
      );
  const descriptionMinHeight = theme.sizes.touch.min;

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
    if (!form.name.trim()) {
      setError(t('catalog.namesRequired'));
      return;
    }
    const names = await resolveTrilingualIfChanged({
      typed: form.name,
      locale,
      original: form.originalName,
      existing: { nameEn: form.nameEn, nameAr: form.nameAr, nameHe: form.nameHe },
    });
    const descriptions = form.description.trim()
      ? await resolveTrilingualIfChanged({
          typed: form.description,
          locale,
          original: form.originalDescription,
          existing: {
            nameEn: form.descriptionEn,
            nameAr: form.descriptionAr,
            nameHe: form.descriptionHe,
          },
          kind: 'prose',
        })
      : { nameEn: '', nameAr: '', nameHe: '' };
    const body = {
      nameEn: names.nameEn,
      nameAr: names.nameAr,
      nameHe: names.nameHe || undefined,
      descriptionEn: descriptions.nameEn.trim() || undefined,
      descriptionAr: descriptions.nameAr.trim() || undefined,
      descriptionHe: descriptions.nameHe.trim() || undefined,
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
      <View style={{ minHeight: leadSize, justifyContent: 'center' }}>
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
          style={{
            paddingLeft: isRTL ? trailPad : leadPad,
            paddingRight: isRTL ? leadPad : trailPad,
          }}
        >
          {headerTitle}
        </AppText>
        {!readOnly ? (
          <View
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              ...(isRTL ? { left: 0 } : { right: 0 }),
              zIndex: 1,
              justifyContent: 'center',
            }}
          >
            <PrimaryButton
              label={t('common.save')}
              loading={saving}
              disabled={!canSave}
              onPress={() => void onSubmit()}
              haptic="light"
              style={{
                minHeight: 36,
                paddingVertical: 0,
                paddingHorizontal: theme.spacing.md,
                borderRadius: theme.radius.full,
              }}
            />
          </View>
        ) : null}
      </View>

      <ScrollView
        style={{ flex: 1 }}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          gap: theme.spacing.md,
          flexGrow: 1,
          paddingBottom: insets.bottom + SURFACE_TAB_BAR_CLEARANCE,
        }}
      >
        <AppText
          variant="bodySecondary"
          color="secondary"
          style={{ textAlign: isRTL ? 'right' : 'left' }}
        >
          {readOnly ? t('users.systemPresetReadOnly') : t('users.staffTypesDescription')}
        </AppText>
        <UserFormSection
          icon="text-outline"
          label={t('users.name')}
          titleWeight={titleWeight}
          uppercase={false}
        >
          <LocaleNameField
            value={form.name}
            onChange={(v) => setForm((f) => ({ ...f, name: v }))}
            label={t('users.name')}
            editable={!readOnly}
          />
          <LocaleNameField
            value={form.description}
            onChange={(v) => setForm((f) => ({ ...f, description: v }))}
            label={t('catalog.description')}
            editable={!readOnly}
            multiline
            growMinHeight={descriptionMinHeight}
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
            loading={saving}
            disabled={!canSave}
          />
        ) : null}
      </ScrollView>
    </AppScreen>
  );
}
