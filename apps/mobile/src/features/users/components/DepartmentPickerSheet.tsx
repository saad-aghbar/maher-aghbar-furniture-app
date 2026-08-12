import { useEffect, useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import type { DepartmentRow } from '@/api/modules/users';
import { AppText } from '@/components/AppText';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { SearchBarShell } from '@/components/forms/SearchBarShell';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { localizedName } from '@maher/i18n';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics, useReducedMotion } from '@/motion';
import { resolveAppFontStyle, useTheme } from '@/theme';
import { AppTextInput } from '@/components/forms/AppTextInput';

type Props = {
  open: boolean;
  onClose: () => void;
  departments: DepartmentRow[];
  selectedId: string | null;
  onSelect: (departmentId: string | null) => void;
  /** Allow clearing to “no department”. Default true. */
  allowNone?: boolean;
  overlay?: boolean;
};

/**
 * Searchable department picker — tap to highlight, Confirm to apply.
 */
export function DepartmentPickerSheet({
  open,
  onClose,
  departments,
  selectedId,
  onSelect,
  allowNone = true,
  overlay = false,
}: Props) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const reduce = useReducedMotion();
  const { height } = useWindowDimensions();
  const sheetHeight = Math.min(Math.round(height * 0.72), 660);
  const [query, setQuery] = useState('');
  const [draftId, setDraftId] = useState<string | null>(selectedId);

  useEffect(() => {
    if (!open) {
      setQuery('');
      return;
    }
    setDraftId(selectedId);
  }, [open, selectedId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return departments;
    return departments.filter((d) => {
      const label = localizedName(locale, d, d.code).toLowerCase();
      return label.includes(q) || d.code.toLowerCase().includes(q);
    });
  }, [departments, locale, query]);

  const selectRow = (id: string | null) => {
    void haptics.selection();
    setDraftId(id);
  };

  const confirm = () => {
    void haptics.confirmLight();
    onSelect(draftId);
    onClose();
  };

  const dismiss = () => {
    setDraftId(selectedId);
    onClose();
  };

  return (
    <BottomSheet
      open={open}
      onClose={dismiss}
      title={t('users.pickDepartment')}
      sheetHeight={sheetHeight}
      overlay={overlay}
    >
      <View style={{ gap: theme.spacing.md, flex: 1 }}>
        <SearchBarShell>
          <AppTextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t('users.searchDepartments')}
            placeholderTextColor={colors.textMuted}
            style={[
              styles.input,
              {
                color: colors.textPrimary,
                textAlign: isRTL ? 'right' : 'left',
                writingDirection: isRTL ? 'rtl' : 'ltr',
              },
              resolveAppFontStyle(locale, { variant: 'body' }),
            ]}
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
        </SearchBarShell>

        <ScrollView
          keyboardShouldPersistTaps="handled"
          style={{ flex: 1 }}
          contentContainerStyle={{ gap: theme.spacing.sm, paddingBottom: theme.spacing.md }}
        >
          {allowNone ? (
            <DeptRow
              title={t('users.noDepartment')}
              selected={draftId == null}
              onPress={() => selectRow(null)}
              reduce={reduce}
              index={0}
            />
          ) : null}

          {filtered.length === 0 ? (
            <View
              style={{
                padding: theme.spacing.lg,
                borderRadius: theme.radius.xl,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.surfaceSecondary,
              }}
            >
              <AppText variant="body" color="secondary" align="center">
                {t('users.noDepartmentsFound')}
              </AppText>
            </View>
          ) : (
            filtered.map((dept, index) => {
              const title = localizedName(locale, dept, dept.code);
              return (
                <DeptRow
                  key={dept.id}
                  title={title}
                  selected={draftId === dept.id}
                  onPress={() => selectRow(dept.id)}
                  reduce={reduce}
                  index={index + (allowNone ? 1 : 0)}
                />
              );
            })
          )}
        </ScrollView>

        <View style={{ gap: theme.spacing.sm }}>
          <PrimaryButton
            label={t('common.confirm')}
            onPress={confirm}
            style={{
              borderRadius: theme.radius.full,
              minHeight: theme.sizes.touch.min,
              paddingVertical: 0,
            }}
          />
          <SecondaryButton
            label={t('common.cancel')}
            onPress={dismiss}
            style={{
              borderRadius: theme.radius.full,
              minHeight: theme.sizes.touch.min,
              paddingVertical: 0,
            }}
          />
        </View>
      </View>
    </BottomSheet>
  );
}

function DeptRow({
  title,
  selected,
  onPress,
  reduce,
  index,
}: {
  title: string;
  selected: boolean;
  onPress: () => void;
  reduce: boolean;
  index: number;
}) {
  const { t, isRTL } = useLocale();
  const { colors, theme, colorScheme } = useTheme();

  return (
    <Animated.View
      entering={reduce ? undefined : FadeInDown.delay(Math.min(index * 28, 180)).duration(280)}
    >
      <AnimatedPressable
        variant="card"
        accessibilityRole="button"
        accessibilityState={{ selected }}
        onPress={onPress}
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          gap: theme.spacing.md,
          padding: theme.spacing.md,
          borderRadius: theme.radius.xl,
          borderWidth: 1.5,
          borderColor: selected ? colors.brand : colors.borderStrong,
          backgroundColor: selected ? colors.brandSoft : colors.surface,
          ...orderBoardShadow(colorScheme),
        }}
      >
        <AppText
          variant="label"
          weight={selected ? 'semibold' : 'medium'}
          numberOfLines={1}
          style={{ flex: 1, minWidth: 0, textAlign: isRTL ? 'right' : 'left' }}
        >
          {title}
        </AppText>
        <View
          style={{
            paddingHorizontal: theme.spacing.md,
            paddingVertical: theme.spacing.sm,
            borderRadius: theme.radius.full,
            backgroundColor: selected ? colors.brand : colors.surfaceSecondary,
            borderWidth: 1,
            borderColor: selected ? colors.brand : colors.border,
          }}
        >
          <AppText
            variant="caption"
            weight="semibold"
            style={{ color: selected ? colors.onBrand : colors.textSecondary }}
          >
            {selected ? t('users.selectedDepartment') : t('users.selectDepartment')}
          </AppText>
        </View>
      </AnimatedPressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  input: {
    flex: 1,
    minWidth: 0,
    fontSize: 16,
    paddingVertical: 0,
  },
});
