import { useEffect, useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
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
import {
  type InvoiceDealerOption,
  type InvoicePartySegment,
  type InvoicePartySelection,
} from '../invoiceFilters';

type PartyOption = InvoiceDealerOption & { kind: InvoicePartySegment };

type Props = {
  open: boolean;
  onClose: () => void;
  titleKey?: string;
  segments: InvoicePartySegment[];
  dealers: InvoiceDealerOption[];
  suppliers: InvoiceDealerOption[];
  selected: InvoicePartySelection | null;
  onConfirm: (next: InvoicePartySelection | null) => void;
};

export function InvoicePartySheet({
  open,
  onClose,
  titleKey = 'mobile.invoices.partyFilter',
  segments,
  dealers,
  suppliers,
  selected,
  onConfirm,
}: Props) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const reduce = useReducedMotion();
  const { sheetHeight } = useSheetListViewport();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const locked = segments.length === 1;
  const initialSegment = selected?.kind && segments.includes(selected.kind)
    ? selected.kind
    : segments[0] ?? 'dealers';

  const [query, setQuery] = useState('');
  const [segment, setSegment] = useState<InvoicePartySegment>(initialSegment);
  const [draft, setDraft] = useState<InvoicePartySelection | null>(selected);

  useEffect(() => {
    if (!open) {
      setQuery('');
      return;
    }
    setDraft(selected);
    setSegment(
      selected?.kind && segments.includes(selected.kind)
        ? selected.kind
        : segments[0] ?? 'dealers',
    );
    setQuery('');
  }, [open, selected, segments]);

  const rows: PartyOption[] = useMemo(() => {
    const source = segment === 'suppliers' ? suppliers : dealers;
    const needle = query.trim().toLowerCase();
    const filtered = needle
      ? source.filter((row) => `${row.name} ${row.code ?? ''} ${row.searchText ?? ''}`.toLowerCase().includes(needle))
      : source;
    return filtered.map((row) => ({ ...row, kind: segment }));
  }, [dealers, query, segment, suppliers]);

  const dismiss = () => {
    setQuery('');
    onClose();
  };

  const confirm = () => {
    void haptics.confirmLight();
    onConfirm(draft);
    dismiss();
  };

  return (
    <BottomSheet
      open={open}
      onClose={dismiss}
      title={t(titleKey)}
      sheetHeight={sheetHeight}
    >
      <View style={{ gap: theme.spacing.md, flex: 1, minHeight: 0 }}>
        {segments.length > 1 ? (
          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              height: 48,
              borderRadius: 24,
              backgroundColor: colors.surfaceSecondary,
              borderWidth: 1,
              borderColor: colors.borderStrong,
              padding: 4,
            }}
          >
            {segments.map((key) => {
              const focused = segment === key;
              return (
                <AnimatedPressable
                  key={key}
                  variant="button"
                  accessibilityRole="button"
                  accessibilityState={{ selected: focused }}
                  onPress={() => {
                    if (key === segment) return;
                    void haptics.selection();
                    setSegment(key);
                    if (draft && draft.kind !== key) setDraft(null);
                  }}
                  style={{
                    flex: 1,
                    borderRadius: 20,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: focused ? colors.brandSoft : 'transparent',
                    borderWidth: focused ? 1.5 : 0,
                    borderColor: focused ? colors.brand : 'transparent',
                    flexDirection: isRTL ? 'row-reverse' : 'row',
                    gap: 6,
                  }}
                >
                  <Ionicons
                    name={key === 'suppliers' ? 'storefront-outline' : 'people-outline'}
                    size={15}
                    color={focused ? colors.brand : colors.textSecondary}
                  />
                  <AppText
                    variant="caption"
                    weight={focused ? titleWeight : 'medium'}
                    style={{ color: focused ? colors.brand : colors.textSecondary }}
                  >
                    {key === 'suppliers'
                      ? t('mobile.invoices.partySuppliers')
                      : t('mobile.invoices.partyDealers')}
                  </AppText>
                </AnimatedPressable>
              );
            })}
          </View>
        ) : (
          <AppText
            variant="caption"
            color="muted"
            style={{ textAlign: isRTL ? 'right' : 'left' }}
          >
            {locked && segments[0] === 'suppliers'
              ? t('mobile.invoices.partySuppliersOnly')
              : t('mobile.invoices.partyDealersOnly')}
          </AppText>
        )}

        <SearchBarShell>
          <AppTextInput
            value={query}
            onChangeText={setQuery}
            placeholder={
              segment === 'suppliers'
                ? t('mobile.invoices.searchSuppliers')
                : t('accounting.searchDealers')
            }
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
          <ScrollView
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{
              padding: theme.spacing.sm,
              gap: theme.spacing.sm,
              paddingBottom: theme.spacing.md,
            }}
          >
            <PartyFloorRow
              label={t('accounting.allCustomers')}
              icon="apps-outline"
              active={draft == null}
              muted
              isRTL={isRTL}
              titleWeight={titleWeight}
              onPress={() => {
                void haptics.selection();
                setDraft(null);
              }}
            />
            {rows.map((row, index) => {
              const active = draft?.id === row.id && draft.kind === row.kind;
              const node = (
                <PartyFloorRow
                  label={row.name}
                  meta={row.code}
                  icon={row.kind === 'suppliers' ? 'storefront-outline' : 'people-outline'}
                  active={active}
                  isRTL={isRTL}
                  titleWeight={titleWeight}
                  onPress={() => {
                    void haptics.selection();
                    setDraft({ kind: row.kind, id: row.id, name: row.name });
                  }}
                />
              );
              if (reduce) return <View key={`${row.kind}-${row.id}`}>{node}</View>;
              return (
                <Animated.View
                  key={`${row.kind}-${row.id}`}
                  entering={FadeInDown.delay(40 + index * 24).duration(180)}
                >
                  {node}
                </Animated.View>
              );
            })}
            {rows.length === 0 ? (
              <AppText
                variant="caption"
                color="muted"
                style={{ textAlign: 'center', paddingVertical: theme.spacing.lg }}
              >
                {segment === 'suppliers'
                  ? t('mobile.invoices.noSuppliersMatch')
                  : t('accounting.noDealersMatch')}
              </AppText>
            ) : null}
          </ScrollView>
        </View>

        <View style={{ gap: theme.spacing.sm }}>
          <PrimaryButton
            label={t('common.confirm')}
            onPress={confirm}
            style={{ borderRadius: theme.radius.full, minHeight: 44 }}
          />
          <SecondaryButton
            label={t('common.cancel')}
            onPress={dismiss}
            style={{ borderRadius: theme.radius.full, minHeight: 44 }}
          />
        </View>
      </View>
    </BottomSheet>
  );
}

function PartyFloorRow({
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
        borderWidth: 1.5,
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
          ...(isRTL ? { paddingRight: theme.spacing.md + 4 } : { paddingLeft: theme.spacing.md + 4 }),
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
          }}
        >
          <Ionicons name={icon} size={18} color={active ? colors.brand : colors.textSecondary} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <AppText
            weight={titleWeight}
            numberOfLines={1}
            style={{
              textAlign: isRTL ? 'right' : 'left',
              color: muted ? colors.textSecondary : colors.textPrimary,
            }}
          >
            {label}
          </AppText>
          {meta ? (
            <AppText
              variant="caption"
              color="muted"
              dir="ltr"
              style={{ textAlign: isRTL ? 'right' : 'left' }}
            >
              {meta}
            </AppText>
          ) : null}
        </View>
        <View
          style={{
            width: 22,
            height: 22,
            borderRadius: 11,
            borderWidth: StyleSheet.hairlineWidth * 2,
            borderColor: active ? colors.brand : colors.borderStrong,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: active ? colors.brand : colors.surface,
          }}
        >
          {active ? <Ionicons name="checkmark" size={13} color={colors.surface} /> : null}
        </View>
      </View>
    </AnimatedPressable>
  );
}
