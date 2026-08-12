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
import {
  filterSuppliersByQuery,
  type PurchasingSupplierOption,
} from '../purchasingFilters';
import { AppTextInput } from '@/components/forms/AppTextInput';

type Props = {
  open: boolean;
  onClose: () => void;
  suppliers: PurchasingSupplierOption[];
  selectedId: string | null;
  onConfirm: (supplier: { id: string; name: string } | null) => void;
  /** Stack on top of another sheet (create PO / PR). */
  overlay?: boolean;
};

/**
 * Searchable supplier picker — floor board list + confirm footer at sheet bottom.
 */
export function PurchasingSupplierSheet({
  open,
  onClose,
  suppliers,
  selectedId,
  onConfirm,
  overlay = false,
}: Props) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const reduce = useReducedMotion();
  const { height } = useWindowDimensions();
  const sheetHeight = Math.min(Math.round(height * 0.78), 640);
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

  const filtered = useMemo(
    () => filterSuppliersByQuery(suppliers, query),
    [suppliers, query],
  );

  const dismiss = () => {
    setQuery('');
    onClose();
  };

  const confirm = () => {
    void haptics.confirmLight();
    if (!draftId) onConfirm(null);
    else {
      const row = suppliers.find((s) => s.id === draftId);
      onConfirm(row ? { id: row.id, name: row.name } : null);
    }
    dismiss();
  };

  const enter = (index: number) =>
    reduce ? undefined : FadeInDown.delay(28 + index * 28).duration(200);

  return (
    <BottomSheet
      open={open}
      onClose={dismiss}
      title={t('catalog.supplier')}
      sheetHeight={sheetHeight}
      overlay={overlay}
    >
      <View style={{ gap: theme.spacing.md, flex: 1, minHeight: 0 }}>
        <Animated.View entering={enter(0)}>
          <SearchBarShell>
            <AppTextInput
              value={query}
              onChangeText={setQuery}
              placeholder={t('mobile.purchasing.searchSuppliers')}
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
                {t('catalog.suppliers')}
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
              <SupplierFloorRow
                label={t('catalog.allSuppliers')}
                icon="apps-outline"
                active={draftId == null}
                muted
                isRTL={isRTL}
                titleWeight={titleWeight}
                onPress={() => {
                  void haptics.selection();
                  setDraftId(null);
                }}
              />
              {filtered.map((s, index) => {
                const row = (
                  <SupplierFloorRow
                    label={s.name}
                    meta={s.code}
                    icon="business-outline"
                    active={draftId === s.id}
                    isRTL={isRTL}
                    titleWeight={titleWeight}
                    onPress={() => {
                      void haptics.selection();
                      setDraftId(s.id);
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
              {filtered.length === 0 ? (
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
                    <Ionicons name="business-outline" size={20} color={colors.textMuted} />
                  </View>
                  <AppText variant="caption" color="muted" style={{ textAlign: 'center' }}>
                    {t('mobile.purchasing.noSuppliersMatch')}
                  </AppText>
                </View>
              ) : null}
            </ScrollView>
          </View>
        </Animated.View>

        <View style={{ gap: theme.spacing.sm, paddingTop: theme.spacing.xs }}>
          <PrimaryButton
            label={t('common.confirm')}
            onPress={confirm}
            style={{ borderRadius: theme.radius.xl }}
          />
          <SecondaryButton
            label={t('common.cancel')}
            onPress={dismiss}
            style={{ borderRadius: theme.radius.xl }}
          />
        </View>
      </View>
    </BottomSheet>
  );
}

function SupplierFloorRow({
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
