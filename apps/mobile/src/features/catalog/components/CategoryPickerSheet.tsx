import { useEffect, useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { SearchBarShell } from '@/components/forms/SearchBarShell';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics, useReducedMotion } from '@/motion';
import { resolveAppFontStyle, useTheme } from '@/theme';
import type { BrowseCategory } from '@/api/modules/catalog';
import { AppTextInput } from '@/components/forms/AppTextInput';

type Props = {
  open: boolean;
  onClose: () => void;
  categories: BrowseCategory[];
  selectedId: string | null;
  onSelect: (categoryId: string | null) => void;
  /** Overrides sheet title (default: pick category). */
  title?: string;
  /** Overrides hint under the title. */
  hint?: string;
  /** Label for the empty/null row (default: no category). Use “All” when filtering. */
  emptySelectionLabel?: string;
  /**
   * When true, tapping a row only highlights it — Confirm applies the choice
   * and dismisses (avoids glitchy instant dismiss on overlay hosts).
   */
  requireConfirm?: boolean;
  confirmLabel?: string;
};

function labelFor(cat: BrowseCategory, locale: string): string {
  if (locale === 'ar') return cat.nameAr || cat.nameEn;
  if (locale === 'he') return cat.nameHe || cat.nameEn || cat.nameAr;
  return cat.nameEn || cat.nameAr;
}

/**
 * Floor category picker — searchable board list (production / orders aesthetic).
 */
export function CategoryPickerSheet({
  open,
  onClose,
  categories,
  selectedId,
  onSelect,
  title,
  hint,
  emptySelectionLabel,
  requireConfirm = false,
  confirmLabel,
}: Props) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const reduce = useReducedMotion();
  const { height } = useWindowDimensions();
  const sheetHeight = Math.min(Math.round(height * (requireConfirm ? 0.7 : 0.62)), requireConfirm ? 620 : 560);
  const [query, setQuery] = useState('');
  const [draftId, setDraftId] = useState<string | null>(selectedId);
  const sheetTitle = title ?? t('catalog.pickCategory');
  const sheetHint = hint ?? t('catalog.pickCategoryHint');
  const emptyLabel = emptySelectionLabel ?? t('catalog.noCategory');
  const confirmText = confirmLabel ?? t('common.confirm');

  useEffect(() => {
    if (!open) {
      setQuery('');
      return;
    }
    setDraftId(selectedId);
  }, [open, selectedId]);

  const needle = query.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!needle) return categories;
    return categories.filter((c) => {
      const hay = [c.nameEn, c.nameAr, c.nameHe, c.code]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(needle);
    });
  }, [categories, needle]);

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
    // Let BottomSheet run its exit motion before the host slides back.
    onClose();
  };

  const dismiss = () => {
    setDraftId(selectedId);
    onClose();
  };

  const enter = (index: number) =>
    reduce ? undefined : FadeInDown.delay(30 + index * 35).duration(220);

  const listMax = sheetHeight - (requireConfirm ? 280 : 210);

  return (
    <BottomSheet
      open={open}
      onClose={dismiss}
      title={sheetTitle}
      sheetHeight={sheetHeight}
      overlay
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
              placeholder={t('catalog.searchCategories')}
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
                  textTransform: 'uppercase',
                  letterSpacing: 0.7,
                  fontSize: 11,
                  color: colors.brand,
                }}
              >
                {t('catalog.categories')}
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
              <CategoryRow
                label={emptyLabel}
                icon={emptySelectionLabel ? 'apps-outline' : 'close-circle-outline'}
                active={activeId == null}
                isRTL={isRTL}
                muted
                onPress={() => selectRow(null)}
              />
              {filtered.map((cat) => (
                <CategoryRow
                  key={cat.id}
                  label={labelFor(cat, locale)}
                  meta={cat.code}
                  active={activeId === cat.id}
                  isRTL={isRTL}
                  onPress={() => selectRow(cat.id)}
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
                  <View
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 22,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: colors.surfaceSecondary,
                      borderWidth: 1,
                      borderColor: colors.border,
                    }}
                  >
                    <Ionicons name="grid-outline" size={20} color={colors.textMuted} />
                  </View>
                  <AppText
                    variant="caption"
                    color="muted"
                    style={{ textAlign: 'center' }}
                  >
                    {t('catalog.noCategoriesMatch')}
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

function CategoryRow({
  label,
  meta,
  icon,
  active,
  muted,
  isRTL,
  onPress,
}: {
  label: string;
  meta?: string | null;
  icon?: keyof typeof Ionicons.glyphMap;
  active: boolean;
  muted?: boolean;
  isRTL: boolean;
  onPress: () => void;
}) {
  const { colors, theme } = useTheme();
  const { locale } = useLocale();

  return (
    <AnimatedPressable
      variant="button"
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
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

      {icon ? (
        <Ionicons
          name={icon}
          size={18}
          color={active ? colors.brand : colors.textMuted}
        />
      ) : null}

      <View
        style={{
          flex: 1,
          gap: 2,
          ...(isRTL
            ? { paddingRight: active ? 6 : 0 }
            : { paddingLeft: active ? 6 : 0 }),
        }}
      >
        <AppText
          variant="label"
          weight={active ? (locale === 'ar' ? 'medium' : 'semibold') : 'medium'}
          numberOfLines={1}
          style={{
            color: active
              ? colors.brand
              : muted
                ? colors.textSecondary
                : colors.textPrimary,
            textAlign: isRTL ? 'right' : 'left',
          }}
        >
          {label}
        </AppText>
        {meta ? (
          <AppText
            variant="caption"
            dir="ltr"
            numberOfLines={1}
            style={{
              color: colors.textMuted,
              letterSpacing: 0.4,
              fontSize: 11,
              textAlign: isRTL ? 'right' : 'left',
            }}
          >
            {meta}
          </AppText>
        ) : null}
      </View>

      {active ? (
        <View
          style={{
            width: 26,
            height: 26,
            borderRadius: 13,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.brand,
          }}
        >
          <Ionicons name="checkmark" size={14} color={colors.onBrand} />
        </View>
      ) : (
        <View
          style={{
            width: 22,
            height: 22,
            borderRadius: 11,
            borderWidth: 1.5,
            borderColor: colors.borderStrong,
          }}
        />
      )}
    </AnimatedPressable>
  );
}
