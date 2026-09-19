import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { localizedName } from '@maher/i18n';
import type { SpecOptionValue } from '@/api/modules/catalog';
import { AppText } from '@/components/AppText';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { SearchBarShell } from '@/components/forms/SearchBarShell';
import { AppTextInput } from '@/components/forms/AppTextInput';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { useSheetListViewport } from '@/components/sheets/sheetListViewport';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics, useReducedMotion } from '@/motion';
import { resolveAppFontStyle, useTheme } from '@/theme';
import { selectSpecOptionValuesForPicker } from '../selectSpecOptions';

type Props = {
  open: boolean;
  onClose: () => void;
  values: SpecOptionValue[];
  selectedId: string | null;
  onSelect: (valueId: string | null) => void;
  title?: string;
  hint?: string;
  emptySelectionLabel?: string;
  requireConfirm?: boolean;
  confirmLabel?: string;
  /** Stack on another sheet (host yields). Off by default for standalone pickers. */
  overlay?: boolean;
};

/**
 * Floor spec-option picker — searchable board list backed by SpecOptionValue.
 * Inactive values are hidden here; GET-by-id remains readable for history.
 */
export function SpecOptionPickerSheet({
  open,
  onClose,
  values,
  selectedId,
  onSelect,
  title,
  hint,
  emptySelectionLabel,
  requireConfirm = false,
  confirmLabel,
  overlay = false,
}: Props) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const reduce = useReducedMotion();
  const { sheetHeight, listHeight } = useSheetListViewport();
  const [query, setQuery] = useState('');
  const [draftId, setDraftId] = useState<string | null>(selectedId);
  const sheetTitle = title ?? t('catalog.pickSpecOption');
  const sheetHint = hint ?? t('catalog.pickSpecOptionHint');
  const emptyLabel = emptySelectionLabel ?? t('catalog.noSpecOption');
  const confirmText = confirmLabel ?? t('common.confirm');

  useEffect(() => {
    if (!open) {
      setQuery('');
      return;
    }
    setDraftId(selectedId);
  }, [open, selectedId]);

  const activeValues = useMemo(() => selectSpecOptionValuesForPicker(values), [values]);
  const needle = query.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!needle) return activeValues;
    return activeValues.filter((v) => {
      const hay = [v.nameEn, v.nameAr, v.nameHe, v.code]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(needle);
    });
  }, [activeValues, needle]);

  const activeId = requireConfirm ? draftId : selectedId;

  const applyImmediate = (id: string | null) => {
    void haptics.confirmLight();
    onSelect(id);
    onClose();
  };

  const selectRow = (id: string | null) => {
    if (requireConfirm) {
      void haptics.selection();
      setDraftId(id);
      return;
    }
    applyImmediate(id);
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

  const enter = (index: number) =>
    reduce ? undefined : FadeInDown.delay(30 + index * 35).duration(220);

  const listMax = Math.max(listHeight, sheetHeight - (requireConfirm ? 300 : 210));

  return (
    <BottomSheet
      open={open}
      onClose={dismiss}
      title={sheetTitle}
      sheetHeight={sheetHeight}
      overlay={overlay}
    >
      <View style={{ gap: theme.spacing.md, flex: 1 }}>
        <Animated.View entering={enter(0)}>
          <AppText
            variant="caption"
            color="muted"
            style={{
              marginTop: -theme.spacing.xs,
              textAlign: isRTL ? 'right' : 'left',
              lineHeight: 18,
            }}
          >
            {sheetHint}
          </AppText>
        </Animated.View>

        <Animated.View entering={enter(1)}>
          <SearchBarShell>
            <AppTextInput
              value={query}
              onChangeText={setQuery}
              placeholder={t('catalog.searchSpecOptions')}
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              clearButtonMode="while-editing"
              style={{
                flex: 1,
                minWidth: 0,
                paddingVertical: theme.spacing.sm,
                fontSize: 16,
                color: colors.textPrimary,
                textAlign: isRTL ? 'right' : 'left',
                ...resolveAppFontStyle(locale, { variant: 'body' }),
              }}
            />
          </SearchBarShell>
        </Animated.View>

        <Animated.View entering={enter(2)} style={{ flex: 1, minHeight: 0 }}>
          <View
            style={{
              flex: 1,
              minHeight: listHeight,
              maxHeight: listMax,
              borderRadius: theme.radius.xl,
              borderWidth: 1,
              borderColor: colors.borderStrong,
              backgroundColor: colors.surface,
              overflow: 'hidden',
              ...orderBoardShadow(colorScheme),
            }}
          >
            <View
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: theme.spacing.sm,
                paddingHorizontal: theme.spacing.md,
                paddingVertical: theme.spacing.sm,
                backgroundColor: colors.surfaceSecondary,
                borderBottomWidth: StyleSheet.hairlineWidth,
                borderBottomColor: colors.border,
              }}
            >
              <AppText
                variant="caption"
                style={{
                  letterSpacing: 0.7,
                  fontSize: 11,
                  color: colors.brand,
                }}
              >
                {t('catalog.specOptionValues')}
              </AppText>
              <AppText variant="caption" color="muted" dir="ltr">
                {filtered.length}
              </AppText>
            </View>

            <ScrollView
              nestedScrollEnabled
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: theme.spacing.sm }}
            >
              <OptionRow
                label={emptyLabel}
                icon="close-circle-outline"
                active={activeId == null}
                isRTL={isRTL}
                muted
                onPress={() => selectRow(null)}
              />
              {filtered.map((value) => (
                <OptionRow
                  key={value.id}
                  label={localizedName(locale, value)}
                  meta={value.code}
                  hex={value.hex}
                  active={activeId === value.id}
                  isRTL={isRTL}
                  onPress={() => selectRow(value.id)}
                />
              ))}
              {filtered.length === 0 ? (
                <View
                  style={{
                    paddingHorizontal: theme.spacing.lg,
                    paddingVertical: theme.spacing.xl,
                    alignItems: 'center',
                    gap: theme.spacing.sm,
                  }}
                >
                  <AppText variant="caption" color="muted" style={{ textAlign: 'center' }}>
                    {t('catalog.noSpecOptionsMatch')}
                  </AppText>
                </View>
              ) : null}
            </ScrollView>
          </View>
        </Animated.View>

        {requireConfirm ? (
          <Animated.View entering={enter(3)} style={{ gap: theme.spacing.sm }}>
            <PrimaryButton
              label={confirmText}
              onPress={confirm}
              style={{ borderRadius: theme.radius.xl }}
            />
            <SecondaryButton
              label={t('common.cancel')}
              onPress={dismiss}
              style={{ borderRadius: theme.radius.xl }}
            />
          </Animated.View>
        ) : null}
      </View>
    </BottomSheet>
  );
}

function OptionRow({
  label,
  meta,
  hex,
  icon,
  active,
  muted,
  isRTL,
  onPress,
}: {
  label: string;
  meta?: string | null;
  hex?: string | null;
  icon?: keyof typeof Ionicons.glyphMap;
  active: boolean;
  muted?: boolean;
  isRTL: boolean;
  onPress: () => void;
}) {
  const { colors, theme } = useTheme();

  return (
    <AnimatedPressable
      variant="button"
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      testID={`spec-option-row-${meta ?? 'none'}`}
      onPress={onPress}
      style={{
        minHeight: 56,
        paddingHorizontal: theme.spacing.md,
        paddingVertical: theme.spacing.sm,
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: theme.spacing.sm,
        backgroundColor: active ? colors.brandSoft : 'transparent',
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: colors.border,
        overflow: 'hidden',
      }}
    >
      {active ? (
        <View
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            ...(isRTL ? { right: 0 } : { left: 0 }),
            width: 3,
            backgroundColor: colors.brand,
            opacity: 0.9,
          }}
        />
      ) : null}

      {hex ? (
        <View
          style={{
            width: 22,
            height: 22,
            borderRadius: 11,
            backgroundColor: hex,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: colors.borderStrong,
          }}
        />
      ) : icon ? (
        <Ionicons name={icon} size={18} color={muted ? colors.textMuted : colors.brand} />
      ) : null}

      <View style={{ flex: 1, minWidth: 0 }}>
        <AppText
          variant="body"
          numberOfLines={2}
          style={{
            textAlign: isRTL ? 'right' : 'left',
            color: muted ? colors.textMuted : colors.textPrimary,
          }}
        >
          {label}
        </AppText>
        {meta ? (
          <AppText variant="caption" color="muted" dir="ltr">
            {meta}
          </AppText>
        ) : null}
      </View>

      {active ? <Ionicons name="checkmark" size={18} color={colors.brand} /> : null}
    </AnimatedPressable>
  );
}
