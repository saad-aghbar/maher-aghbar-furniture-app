import { useEffect, useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  TextInput,
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

export type DealerPickerOption = {
  id: string;
  name: string;
  code?: string | null;
  searchText?: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  searchPlaceholder: string;
  emptyLabel: string;
  allLabel: string;
  dealers: DealerPickerOption[];
  selectedId: string | null;
  /**
   * `immediate` — tap selects and closes (production / orders).
   * `confirm` — draft selection + Confirm / Cancel footer (invoices / returns).
   */
  mode?: 'immediate' | 'confirm';
  confirmLabel?: string;
  loading?: boolean;
  onSelect: (dealer: { id: string; name: string } | null) => void;
};

function filterDealers(dealers: DealerPickerOption[], query: string) {
  const needle = query.trim().toLowerCase();
  if (!needle) return dealers;
  return dealers.filter((d) => {
    const hay = `${d.name} ${d.code ?? ''} ${d.searchText ?? ''}`.toLowerCase();
    return hay.includes(needle);
  });
}

/**
 * Shared floor dealer picker — soft boards, brand accents, searchable list.
 */
export function DealerPickerSheet({
  open,
  onClose,
  title,
  searchPlaceholder,
  emptyLabel,
  allLabel,
  dealers,
  selectedId,
  mode = 'immediate',
  confirmLabel,
  loading,
  onSelect,
}: Props) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const reduce = useReducedMotion();
  const { height } = useWindowDimensions();
  const sheetHeight = Math.min(Math.round(height * (mode === 'confirm' ? 0.78 : 0.72)), mode === 'confirm' ? 640 : 560);
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  const [query, setQuery] = useState('');
  const [draftId, setDraftId] = useState<string | null>(selectedId);

  useEffect(() => {
    if (!open) {
      setQuery('');
      return;
    }
    setDraftId(selectedId);
    setQuery('');
  }, [open, selectedId]);

  const filtered = useMemo(() => filterDealers(dealers, query), [dealers, query]);
  const activeId = mode === 'confirm' ? draftId : selectedId;

  const dismiss = () => {
    setQuery('');
    onClose();
  };

  const commit = (next: { id: string; name: string } | null) => {
    void haptics.confirmLight();
    onSelect(next);
    dismiss();
  };

  const confirm = () => {
    if (!draftId) {
      commit(null);
      return;
    }
    const row = dealers.find((s) => s.id === draftId);
    commit(row ? { id: row.id, name: row.name } : null);
  };

  const enter = (index: number) =>
    reduce ? undefined : FadeInDown.delay(28 + index * 28).duration(200);

  return (
    <BottomSheet open={open} onClose={dismiss} title={title} sheetHeight={sheetHeight}>
      <View style={{ gap: theme.spacing.md, flex: 1, minHeight: 0 }}>
        <Animated.View entering={enter(0)}>
          <SearchBarShell>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={searchPlaceholder}
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

        <Animated.View entering={enter(1)} style={{ flex: 1, minHeight: 0 }}>
          <View
            style={{
              flex: 1,
              minHeight: 0,
              maxHeight: mode === 'immediate' ? 360 : undefined,
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
                paddingVertical: theme.spacing.sm + 2,
                backgroundColor: colors.surfaceSecondary,
                borderBottomWidth: StyleSheet.hairlineWidth,
                borderBottomColor: colors.border,
              }}
            >
              <AppText
                variant="caption"
                weight={titleWeight}
                style={{
                  textTransform: locale === 'ar' ? 'none' : 'uppercase',
                  letterSpacing: locale === 'ar' ? 0 : 0.7,
                  fontSize: 11,
                  color: colors.brand,
                  textAlign: isRTL ? 'right' : 'left',
                }}
              >
                {title}
              </AppText>
              <AppText variant="caption" color="muted" dir="ltr">
                {String(filtered.length)}
              </AppText>
            </View>

            <ScrollView
              nestedScrollEnabled
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator
              style={{ flex: 1 }}
              contentContainerStyle={{
                padding: theme.spacing.sm,
                gap: theme.spacing.sm,
                paddingBottom: theme.spacing.md,
              }}
            >
              <DealerFloorRow
                label={allLabel}
                icon="apps-outline"
                active={activeId == null}
                muted
                isRTL={isRTL}
                titleWeight={titleWeight}
                onPress={() => {
                  void haptics.selection();
                  if (mode === 'confirm') setDraftId(null);
                  else commit(null);
                }}
              />
              {filtered.map((s, index) => {
                const row = (
                  <DealerFloorRow
                    label={s.name}
                    meta={s.code}
                    icon="storefront-outline"
                    active={activeId === s.id}
                    isRTL={isRTL}
                    titleWeight={titleWeight}
                    onPress={() => {
                      void haptics.selection();
                      if (mode === 'confirm') setDraftId(s.id);
                      else commit({ id: s.id, name: s.name });
                    }}
                  />
                );
                if (reduce) return <View key={s.id}>{row}</View>;
                return (
                  <Animated.View
                    key={s.id}
                    entering={FadeInDown.delay(40 + index * 24).duration(180)}
                  >
                    {row}
                  </Animated.View>
                );
              })}
              {loading ? (
                <View style={{ padding: theme.spacing.md }}>
                  <AppText variant="caption" color="muted">
                    {t('mobile.loadingSession')}
                  </AppText>
                </View>
              ) : null}
              {!loading && filtered.length === 0 ? (
                <View
                  style={{
                    paddingVertical: theme.spacing.xl,
                    paddingHorizontal: theme.spacing.lg,
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
                    <Ionicons name="storefront-outline" size={20} color={colors.textMuted} />
                  </View>
                  <AppText variant="caption" color="muted" style={{ textAlign: 'center' }}>
                    {emptyLabel}
                  </AppText>
                </View>
              ) : null}
            </ScrollView>
          </View>
        </Animated.View>

        {mode === 'confirm' ? (
          <View style={{ gap: theme.spacing.sm, paddingTop: theme.spacing.xs }}>
            <PrimaryButton
              label={confirmLabel ?? t('common.confirm')}
              onPress={confirm}
              style={{ borderRadius: theme.radius.full }}
            />
            <SecondaryButton
              label={t('common.cancel')}
              onPress={dismiss}
              style={{ borderRadius: theme.radius.full }}
            />
          </View>
        ) : null}
      </View>
    </BottomSheet>
  );
}

function DealerFloorRow({
  label,
  meta,
  icon,
  active,
  muted,
  isRTL,
  titleWeight,
  onPress,
}: {
  label: string;
  meta?: string | null;
  icon: keyof typeof Ionicons.glyphMap;
  active: boolean;
  muted?: boolean;
  isRTL: boolean;
  titleWeight: 'medium' | 'semibold';
  onPress: () => void;
}) {
  const { colors, theme, colorScheme } = useTheme();

  return (
    <AnimatedPressable
      variant="button"
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={{
        borderRadius: theme.radius.xl,
        borderWidth: active ? 1.5 : 1,
        borderColor: active ? colors.brand : colors.borderStrong,
        backgroundColor: active ? colors.brandSoft : colors.surfaceSecondary,
        overflow: 'hidden',
        ...orderBoardShadow(colorScheme),
      }}
    >
      {active ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 8,
            bottom: 8,
            ...(isRTL ? { right: 0 } : { left: 0 }),
            width: 3,
            borderRadius: 2,
            backgroundColor: colors.brand,
          }}
        />
      ) : null}
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          gap: theme.spacing.md,
          paddingVertical: theme.spacing.md,
          paddingHorizontal: theme.spacing.md,
          ...(isRTL
            ? { paddingRight: theme.spacing.md + 4 }
            : { paddingLeft: theme.spacing.md + 4 }),
        }}
      >
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: active ? colors.surface : colors.brandSoft,
            borderWidth: 1,
            borderColor: active ? colors.brand : colors.border,
            opacity: muted && !active ? 0.85 : 1,
          }}
        >
          <Ionicons
            name={icon}
            size={18}
            color={active ? colors.brand : colors.textSecondary}
          />
        </View>
        <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
          <AppText
            variant="label"
            weight={active ? titleWeight : 'medium'}
            numberOfLines={1}
            style={{
              color: active ? colors.brand : colors.textPrimary,
              textAlign: isRTL ? 'right' : 'left',
            }}
          >
            {label}
          </AppText>
          {meta ? (
            <AppText
              variant="caption"
              color="muted"
              dir="ltr"
              numberOfLines={1}
              style={{ textAlign: isRTL ? 'right' : 'left', fontSize: 11 }}
            >
              {meta}
            </AppText>
          ) : null}
        </View>
        {active ? (
          <View
            style={{
              width: 28,
              height: 28,
              borderRadius: 14,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors.brand,
            }}
          >
            <Ionicons name="checkmark" size={16} color={colors.onBrand} />
          </View>
        ) : (
          <Ionicons
            name={isRTL ? 'chevron-back' : 'chevron-forward'}
            size={16}
            color={colors.textMuted}
          />
        )}
      </View>
    </AnimatedPressable>
  );
}
