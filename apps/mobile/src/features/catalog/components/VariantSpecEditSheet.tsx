import { useEffect, useMemo, useState } from 'react';
import { ScrollView, useWindowDimensions, View } from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { localizedName } from '@maher/i18n';
import {
  createSpecOptionGroup,
  createSpecOptionValue,
  type SpecOptionGroup,
  type SpecOptionValue,
} from '@/api/modules/catalog';
import { isApiError } from '@/api/errors';
import { queryKeys } from '@/api/queryKeys';
import { toastMessageForError } from '@/api/queryClient';
import { AppText } from '@/components/AppText';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { useToast } from '@/components/feedback/Toast';
import { TextField } from '@/components/forms/TextField';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { UserFormSection } from '@/features/users/components/userSheetForm';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';
import { LocaleNameField } from './BilingualNameField';
import { resolveTrilingualName } from '@/i18n/resolveTrilingualName';
import {
  selectSpecOptionValuesForPicker,
  selectUnusedSpecGroups,
  specLibraryCode,
} from '../selectSpecOptions';

type Props = {
  open: boolean;
  onClose: () => void;
  groups: SpecOptionGroup[];
  values: SpecOptionValue[];
  selectedByGroup: Record<string, string | null>;
  editingGroupId: string | null;
  onPin: (groupId: string, valueId: string) => void;
};

/**
 * Add or edit a pinned spec: categorize, then name (library pick or a new line).
 */
export function VariantSpecEditSheet({
  open,
  onClose,
  groups,
  values,
  selectedByGroup,
  editingGroupId,
  onPin,
}: Props) {
  const { t, locale, isRTL } = useLocale();
  const { colors, theme } = useTheme();
  const { showToast } = useToast();
  const qc = useQueryClient();
  const { height } = useWindowDimensions();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const sheetHeight = Math.min(Math.round(height * 0.78), 680);

  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [valueId, setValueId] = useState<string | null>(null);
  const [namingCategory, setNamingCategory] = useState(false);
  const [namingSpec, setNamingSpec] = useState(false);
  const [categoryName, setCategoryName] = useState('');
  const [specName, setSpecName] = useState('');
  const [categoryQ, setCategoryQ] = useState('');

  const editing = Boolean(editingGroupId);

  useEffect(() => {
    if (!open) return;
    const groupId = editingGroupId;
    const currentValueId = groupId ? selectedByGroup[groupId] ?? null : null;
    const currentValue = values.find((row) => row.id === currentValueId);
    setCategoryId(groupId);
    setValueId(currentValueId);
    setNamingCategory(false);
    setNamingSpec(false);
    setCategoryName('');
    setSpecName(currentValue ? localizedName(locale, currentValue, '') : '');
    setCategoryQ('');
  }, [editingGroupId, open, selectedByGroup, values]);

  const unusedGroups = useMemo(() => {
    const rows = editing
      ? groups.filter((g) => g.id === editingGroupId || !selectedByGroup[g.id])
      : selectUnusedSpecGroups(groups, selectedByGroup);
    const q = categoryQ.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((g) => {
      const name = localizedName(locale, g, g.code).toLowerCase();
      return name.includes(q) || g.code.toLowerCase().includes(q);
    });
  }, [categoryQ, editing, editingGroupId, groups, locale, selectedByGroup]);

  const categoryValues = useMemo(
    () => (categoryId ? selectSpecOptionValuesForPicker(values, categoryId) : []),
    [categoryId, values],
  );

  const canSave =
    (Boolean(categoryId) || Boolean(categoryName.trim())) &&
    (Boolean(valueId) || Boolean(specName.trim()));

  const createGroup = useMutation({
    mutationFn: async () => {
      const names = await resolveTrilingualName(categoryName, locale);
      return createSpecOptionGroup({
        code: `${specLibraryCode(names.nameEn || names.nameAr, 'SPEC')}_${Date.now().toString(36).slice(-4).toUpperCase()}`,
        nameAr: names.nameAr,
        nameEn: names.nameEn,
        nameHe: names.nameHe || undefined,
        sortOrder: groups.reduce((max, g) => Math.max(max, g.sortOrder), 0) + 10,
      });
    },
  });

  const createValue = useMutation({
    mutationFn: async (groupId: string) => {
      const names = await resolveTrilingualName(specName, locale);
      return createSpecOptionValue({
        groupId,
        code: `${specLibraryCode(names.nameEn || names.nameAr, 'VAL')}_${Date.now().toString(36).slice(-4).toUpperCase()}`,
        nameAr: names.nameAr,
        nameEn: names.nameEn,
        nameHe: names.nameHe || undefined,
        sortOrder: categoryValues.reduce((max, v) => Math.max(max, v.sortOrder), 0) + 10,
      });
    },
  });

  async function refreshLibrary() {
    await qc.invalidateQueries({ queryKey: queryKeys.catalog.specOptionGroups() });
    await qc.invalidateQueries({ queryKey: queryKeys.catalog.specOptionValues() });
  }

  async function save() {
    try {
      let nextGroupId = categoryId;
      if (!nextGroupId) {
        const group = await createGroup.mutateAsync();
        nextGroupId = group.id;
      }
      let nextValueId = namingSpec || !valueId ? null : valueId;
      if (!nextValueId) {
        if (!specName.trim()) return;
        const value = await createValue.mutateAsync(nextGroupId);
        nextValueId = value.id;
      }
      await refreshLibrary();
      void haptics.confirmLight();
      onPin(nextGroupId, nextValueId);
      onClose();
    } catch (err) {
      void haptics.error();
      showToast({
        variant: 'error',
        message: isApiError(err) ? toastMessageForError(err) : t('errors.REQUEST_FAILED'),
      });
    }
  }

  const busy = createGroup.isPending || createValue.isPending;

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={editing ? t('catalog.editSpec') : t('catalog.addSpec')}
      fitContent
      maxHeight={sheetHeight}
    >
      <ScrollView
        style={{ maxHeight: sheetHeight - 88 }}
        contentContainerStyle={{ gap: theme.spacing.md, paddingBottom: theme.spacing.md }}
        keyboardShouldPersistTaps="handled"
      >
        <UserFormSection
          icon="pricetag-outline"
          label={t('catalog.specCategory')}
          titleWeight={titleWeight}
          uppercase={false}
        >
          {editing && categoryId ? (
            <AppText variant="body" weight={titleWeight}>
              {localizedName(
                locale,
                groups.find((g) => g.id === categoryId),
                groups.find((g) => g.id === categoryId)?.code,
              )}
            </AppText>
          ) : (
            <View style={{ gap: theme.spacing.sm }}>
              <TextField
                value={categoryQ}
                onChangeText={setCategoryQ}
                placeholder={t('catalog.searchSpecCategories')}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
                clearButtonMode="while-editing"
              />
              {unusedGroups.map((group) => {
                const active = categoryId === group.id && !namingCategory;
                return (
                  <AnimatedPressable
                    key={group.id}
                    variant="button"
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    onPress={() => {
                      void haptics.selection();
                      setNamingCategory(false);
                      setCategoryId(group.id);
                      setValueId(null);
                      setSpecName('');
                      setNamingSpec(false);
                    }}
                    style={{
                      minHeight: 40,
                      borderRadius: theme.radius.lg,
                      borderWidth: 1,
                      borderColor: active ? colors.brand : colors.borderStrong,
                      backgroundColor: active ? colors.brandSoft : colors.surfaceSecondary,
                      paddingHorizontal: theme.spacing.md,
                      justifyContent: 'center',
                      overflow: 'hidden',
                    }}
                  >
                    {active ? (
                      <View
                        pointerEvents="none"
                        style={{
                          position: 'absolute',
                          top: 6,
                          bottom: 6,
                          width: 3,
                          borderRadius: 2,
                          backgroundColor: colors.brand,
                          ...(isRTL ? { right: 0 } : { left: 0 }),
                        }}
                      />
                    ) : null}
                    <AppText
                      variant="label"
                      weight={active ? titleWeight : 'medium'}
                      style={{ color: active ? colors.brand : colors.textPrimary }}
                    >
                      {localizedName(locale, group)}
                    </AppText>
                  </AnimatedPressable>
                );
              })}
              <AnimatedPressable
                variant="button"
                accessibilityRole="button"
                accessibilityState={{ selected: namingCategory }}
                onPress={() => {
                  void haptics.selection();
                  setNamingCategory(true);
                  setCategoryId(null);
                  setValueId(null);
                  setNamingSpec(true);
                }}
                style={{
                  minHeight: 40,
                  borderRadius: theme.radius.lg,
                  borderWidth: 1,
                  borderColor: namingCategory ? colors.brand : colors.borderStrong,
                  backgroundColor: namingCategory ? colors.brandSoft : colors.surfaceSecondary,
                  paddingHorizontal: theme.spacing.md,
                  justifyContent: 'center',
                }}
              >
                <AppText
                  variant="label"
                  weight={namingCategory ? titleWeight : 'medium'}
                  style={{ color: namingCategory ? colors.brand : colors.textPrimary }}
                >
                  {`+ ${t('catalog.newSpecCategory')}`}
                </AppText>
              </AnimatedPressable>
              {namingCategory ? (
                <View style={{ gap: theme.spacing.sm }}>
                  <AppText variant="caption" color="muted">
                    {t('catalog.newSpecCategoryHint')}
                  </AppText>
                  <LocaleNameField
                    value={categoryName}
                    onChange={setCategoryName}
                    label={t('catalog.specCategory')}
                  />
                </View>
              ) : null}
            </View>
          )}
        </UserFormSection>

        <UserFormSection
          icon="create-outline"
          label={t('catalog.specName')}
          titleWeight={titleWeight}
          uppercase={false}
        >
          {categoryId && !namingCategory && categoryValues.length > 0 ? (
            <View style={{ gap: theme.spacing.sm }}>
              <AppText variant="caption" color="muted">
                {t('catalog.librarySpecs')}
              </AppText>
              {categoryValues.map((value) => {
                const active = valueId === value.id && !namingSpec;
                return (
                  <AnimatedPressable
                    key={value.id}
                    variant="button"
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    onPress={() => {
                      void haptics.selection();
                      setNamingSpec(false);
                      setValueId(value.id);
                      setSpecName(localizedName(locale, value, ''));
                    }}
                    style={{
                      minHeight: 40,
                      borderRadius: theme.radius.lg,
                      borderWidth: 1,
                      borderColor: active ? colors.brand : colors.borderStrong,
                      backgroundColor: active ? colors.brandSoft : colors.surfaceSecondary,
                      paddingHorizontal: theme.spacing.md,
                      justifyContent: 'center',
                    }}
                  >
                    <AppText
                      variant="label"
                      weight={active ? titleWeight : 'medium'}
                      style={{ color: active ? colors.brand : colors.textPrimary }}
                    >
                      {localizedName(locale, value)}
                    </AppText>
                  </AnimatedPressable>
                );
              })}
            </View>
          ) : null}
          <AnimatedPressable
            variant="button"
            accessibilityRole="button"
            accessibilityState={{ selected: namingSpec }}
            onPress={() => {
              void haptics.selection();
              setNamingSpec(true);
              setValueId(null);
            }}
            style={{
              minHeight: 40,
              borderRadius: theme.radius.lg,
              borderWidth: 1,
              borderColor: namingSpec ? colors.brand : colors.borderStrong,
              backgroundColor: namingSpec ? colors.brandSoft : colors.surfaceSecondary,
              paddingHorizontal: theme.spacing.md,
              justifyContent: 'center',
            }}
          >
            <AppText
              variant="label"
              weight={namingSpec ? titleWeight : 'medium'}
              style={{ color: namingSpec ? colors.brand : colors.textPrimary }}
            >
              {`+ ${t('catalog.newSpecName')}`}
            </AppText>
          </AnimatedPressable>
          {namingSpec || namingCategory || (!categoryId && !categoryValues.length) ? (
            <View style={{ gap: theme.spacing.sm }}>
              <AppText variant="caption" color="muted">
                {t('catalog.newSpecNameHint')}
              </AppText>
              <LocaleNameField
                value={specName}
                onChange={setSpecName}
                label={t('catalog.specName')}
              />
            </View>
          ) : null}
        </UserFormSection>

        <PrimaryButton
          label={editing ? t('catalog.saveSpec') : t('catalog.pinSpec')}
          disabled={!canSave || busy}
          loading={busy}
          haptic="light"
          onPress={() => void save()}
          style={{ borderRadius: theme.radius.xl }}
        />
        <SecondaryButton
          label={t('common.cancel')}
          onPress={onClose}
          style={{ borderRadius: theme.radius.xl }}
        />
      </ScrollView>
    </BottomSheet>
  );
}
