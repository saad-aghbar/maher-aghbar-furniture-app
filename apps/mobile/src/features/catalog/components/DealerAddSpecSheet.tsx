import { useEffect, useState } from 'react';
import { ScrollView, useWindowDimensions, View } from 'react-native';
import { localizedName } from '@maher/i18n';
import type { SpecOptionGroup } from '@/api/modules/catalog';
import { AppText } from '@/components/AppText';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { TextField } from '@/components/forms/TextField';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { UserFormSection } from '@/features/users/components/userSheetForm';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';

type Props = {
  open: boolean;
  onClose: () => void;
  unusedGroups: SpecOptionGroup[];
  onPickLibraryGroup: (groupId: string) => void;
  onAddNamed: (label: string, value: string) => void;
  editing?: { label: string; value: string } | null;
};

/**
 * Dealer add-spec sheet: pick an unused factory category, or name a spec for this order.
 * Does not create catalog library rows.
 */
export function DealerAddSpecSheet({
  open,
  onClose,
  unusedGroups,
  onPickLibraryGroup,
  onAddNamed,
  editing = null,
}: Props) {
  const { t, locale, isRTL } = useLocale();
  const { colors, theme } = useTheme();
  const { height } = useWindowDimensions();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const sheetHeight = Math.min(Math.round(height * 0.78), 680);
  const [label, setLabel] = useState('');
  const [value, setValue] = useState('');

  useEffect(() => {
    if (!open) return;
    setLabel(editing?.label ?? '');
    setValue(editing?.value ?? '');
  }, [open, editing?.label, editing?.value]);

  const canSave = label.trim().length > 0 && value.trim().length > 0;

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={editing ? t('mobile.newOrder.editOwnSpec') : t('catalog.addSpec')}
      fitContent
      maxHeight={sheetHeight}
    >
      <ScrollView
        style={{ maxHeight: sheetHeight - 72 }}
        contentContainerStyle={{ gap: theme.spacing.lg, paddingBottom: theme.spacing.lg }}
        keyboardShouldPersistTaps="handled"
      >
        {editing ? null : (
          <View style={{ gap: theme.spacing.sm }}>
            <AppText variant="caption" color="muted">
              {t('mobile.newOrder.pickLibrarySpecHint')}
            </AppText>
            {unusedGroups.length === 0 ? (
              <AppText variant="caption" color="muted">
                {t('mobile.newOrder.noUnusedLibrarySpecs')}
              </AppText>
            ) : (
              unusedGroups.map((group) => {
                const name = localizedName(locale, group);
                return (
                  <AnimatedPressable
                    key={group.id}
                    variant="card"
                    accessibilityRole="button"
                    accessibilityLabel={name}
                    onPress={() => {
                      void haptics.selection();
                      onPickLibraryGroup(group.id);
                    }}
                    style={{
                      minHeight: theme.sizes.touch.min,
                      borderRadius: theme.radius.xl,
                      borderWidth: 1,
                      borderColor: colors.borderStrong,
                      backgroundColor: colors.surfaceSecondary,
                      paddingHorizontal: theme.spacing.md,
                      justifyContent: 'center',
                    }}
                  >
                    <AppText
                      variant="label"
                      weight={titleWeight}
                      style={{ textAlign: isRTL ? 'right' : 'left' }}
                    >
                      {name}
                    </AppText>
                  </AnimatedPressable>
                );
              })
            )}
          </View>
        )}

        <UserFormSection
          icon="create-outline"
          label={t('mobile.newOrder.ownSpec')}
          titleWeight={titleWeight}
          uppercase={false}
        >
          <AppText variant="caption" color="muted">
            {t('mobile.newOrder.ownSpecHint')}
          </AppText>
          <TextField
            label={t('mobile.newOrder.ownSpecName')}
            value={label}
            onChangeText={setLabel}
            placeholder={t('mobile.newOrder.ownSpecNamePlaceholder')}
          />
          <TextField
            label={t('mobile.newOrder.ownSpecValue')}
            value={value}
            onChangeText={setValue}
            placeholder={t('mobile.newOrder.ownSpecValuePlaceholder')}
          />
          <PrimaryButton
            label={t('mobile.newOrder.saveOwnSpec')}
            disabled={!canSave}
            haptic="medium"
            onPress={() => {
              if (!canSave) return;
              onAddNamed(label, value);
            }}
            style={{ borderRadius: theme.radius.xl }}
          />
        </UserFormSection>
      </ScrollView>
    </BottomSheet>
  );
}
