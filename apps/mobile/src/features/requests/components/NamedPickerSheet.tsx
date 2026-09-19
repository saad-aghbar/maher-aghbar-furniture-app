import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { SearchBarShell } from '@/components/forms/SearchBarShell';
import { AppTextInput } from '@/components/forms/AppTextInput';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useMaherLayout } from '@/adaptive/useMaherLayout';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';
import { sheetPickerHeight, sheetScrollListHeight } from '@/components/sheets/sheetListViewport';

export type NamedPickRow = {
  id: string;
  name: string;
  caption?: string;
};

/** Any typed name can be used — catalog rows stay available to pick as well. */
export function shouldOfferCustomName(query: string): boolean {
  return query.trim().length > 0;
}

/** Hide shouting SKUs like FAB-VEL-SAND from dealer-facing lists. */
export function dealerVisibleCaption(caption?: string | null): string | null {
  const c = String(caption ?? '').trim();
  if (!c) return null;
  if (c === c.toUpperCase() && /[A-Z]/.test(c)) return null;
  return c;
}

export function filterNamedPickRows(query: string, rows: NamedPickRow[]): NamedPickRow[] {
  const q = query.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter(
    (row) =>
      row.name.toLowerCase().includes(q) || (row.caption ?? '').toLowerCase().includes(q),
  );
}

/** Variant pickers stay compact; fabric/colour sheets need a taller catalog list. */
export function namedPickerSheetHeight(
  windowHeight: number,
  opts: { allowCustom: boolean; isDesk: boolean },
): number {
  if (!opts.allowCustom) {
    return Math.min(Math.round(windowHeight * 0.62), 560);
  }
  return sheetPickerHeight(windowHeight, opts.isDesk);
}

/** Scroll region for the catalog list — phone vs iPad desk. */
export function namedPickerCatalogListMinHeight(windowHeight: number, isDesk: boolean): number {
  return sheetScrollListHeight(windowHeight, isDesk);
}

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  rows: NamedPickRow[];
  selectedId: string | null;
  onSelect: (id: string | null, customName?: string) => void;
  emptyLabel?: string;
  allowClear?: boolean;
  /** Let the dealer (or admin) type a name that is not on the list yet. */
  allowCustom?: boolean;
  customHint?: string;
  customPlaceholder?: string;
  customSectionTitle?: string;
  catalogSectionTitle?: string;
  /** Stack on another sheet (host yields). Off by default for standalone pickers. */
  overlay?: boolean;
};

export function NamedPickerSheet({
  open,
  onClose,
  title,
  rows,
  selectedId,
  onSelect,
  emptyLabel,
  allowClear = true,
  allowCustom = false,
  customHint,
  customPlaceholder,
  customSectionTitle,
  catalogSectionTitle,
  overlay = false,
}: Props) {
  const { t, isRTL } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const { height } = useWindowDimensions();
  const { isDesk } = useMaherLayout();
  const [customText, setCustomText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const sheetHeight = namedPickerSheetHeight(height, { allowCustom, isDesk });
  const catalogListMin = namedPickerCatalogListMinHeight(height, isDesk);
  const typedHint = customHint ?? t('mobile.newOrder.typedFabricHint');
  const typedPlaceholder = customPlaceholder ?? t('mobile.newOrder.typedFabricPlaceholder');
  const ownTitle = customSectionTitle ?? t('mobile.newOrder.typedFabricSection');
  const listTitle = catalogSectionTitle ?? t('mobile.newOrder.catalogFabricSection');

  useEffect(() => {
    if (!open) {
      setCustomText('');
      setSearchQuery('');
    }
  }, [open]);

  const filtered = useMemo(
    () => filterNamedPickRows(searchQuery, rows),
    [searchQuery, rows],
  );

  const customName = customText.trim();
  const offerCustom = allowCustom && shouldOfferCustomName(customName);

  function commitCustom() {
    if (!offerCustom) return;
    void haptics.selection();
    onSelect(null, customName);
    onClose();
  }

  const searchBar = (
    <SearchBarShell>
      <AppTextInput
        testID="named-pick-search"
        value={searchQuery}
        onChangeText={setSearchQuery}
        placeholder={t('common.search')}
        accessibilityLabel={t('common.search')}
        autoCapitalize="none"
        autoCorrect={false}
        style={{ flex: 1 }}
      />
    </SearchBarShell>
  );

  const pickList = (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      nestedScrollEnabled
      style={{ flex: 1, minHeight: allowCustom ? catalogListMin : undefined }}
    >
      {allowClear ? (
        <AnimatedPressable
          variant="card"
          accessibilityRole="button"
          accessibilityLabel={emptyLabel ?? t('common.none')}
          onPress={() => {
            void haptics.selection();
            onSelect(null);
            onClose();
          }}
          style={{
            minHeight: theme.sizes.touch.min,
            paddingHorizontal: theme.spacing.md,
            justifyContent: 'center',
            borderRadius: theme.radius.xl,
            borderWidth: 1,
            borderColor: selectedId ? colors.border : colors.brand,
            marginBottom: theme.spacing.sm,
            ...orderBoardShadow(colorScheme),
          }}
        >
          <AppText>{emptyLabel ?? t('common.none')}</AppText>
        </AnimatedPressable>
      ) : null}
      {filtered.map((row) => {
        const active = row.id === selectedId;
        const caption = dealerVisibleCaption(row.caption);
        return (
          <AnimatedPressable
            key={row.id}
            variant="card"
            accessibilityRole="button"
            accessibilityLabel={row.name}
            testID={`named-pick-${row.id}`}
            onPress={() => {
              void haptics.selection();
              onSelect(row.id);
              onClose();
            }}
            style={{
              minHeight: theme.sizes.touch.min,
              paddingHorizontal: theme.spacing.md,
              paddingVertical: theme.spacing.sm,
              borderRadius: theme.radius.xl,
              borderWidth: 1,
              borderColor: active ? colors.brand : colors.borderStrong,
              marginBottom: theme.spacing.sm,
              alignItems: isRTL ? 'flex-end' : 'flex-start',
              ...orderBoardShadow(colorScheme),
            }}
          >
            <AppText weight={active ? 'semibold' : 'medium'}>{row.name}</AppText>
            {caption ? (
              <AppText variant="caption" color="muted">
                {caption}
              </AppText>
            ) : null}
          </AnimatedPressable>
        );
      })}
    </ScrollView>
  );

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={title}
      fitContent={!allowCustom}
      sheetHeight={allowCustom ? sheetHeight : undefined}
      maxHeight={sheetHeight}
      overlay={overlay}
    >
      <View
        style={{
          gap: theme.spacing.md,
          flex: allowCustom ? 1 : undefined,
          maxHeight: sheetHeight - 80,
        }}
      >
        {allowCustom ? (
          <>
            <PickerSection title={ownTitle}>
              <AppText variant="caption" color="muted">
                {typedHint}
              </AppText>
              <View
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
                <AppTextInput
                  testID="named-pick-custom-input"
                  value={customText}
                  onChangeText={setCustomText}
                  placeholder={typedPlaceholder}
                  accessibilityLabel={typedPlaceholder}
                  autoCapitalize="none"
                  autoCorrect={false}
                  spellCheck={false}
                  returnKeyType="done"
                  onSubmitEditing={commitCustom}
                />
              </View>
              <AnimatedPressable
                variant="card"
                accessibilityRole="button"
                accessibilityState={{ disabled: !offerCustom }}
                accessibilityLabel={
                  offerCustom
                    ? t('mobile.newOrder.useTypedFabric', { name: customName })
                    : t('mobile.newOrder.useTypedFabricEmpty')
                }
                testID="named-pick-custom"
                disabled={!offerCustom}
                onPress={commitCustom}
                style={{
                  minHeight: theme.sizes.touch.min,
                  paddingHorizontal: theme.spacing.md,
                  justifyContent: 'center',
                  borderRadius: theme.radius.xl,
                  borderWidth: 1,
                  borderColor: offerCustom ? colors.brand : colors.border,
                  backgroundColor: offerCustom ? colors.brandSoft : colors.surfaceSecondary,
                  opacity: offerCustom ? 1 : 0.55,
                  alignItems: isRTL ? 'flex-end' : 'flex-start',
                }}
              >
                <AppText weight="semibold" color={offerCustom ? 'brand' : 'muted'}>
                  {offerCustom
                    ? t('mobile.newOrder.useTypedFabric', { name: customName })
                    : t('mobile.newOrder.useTypedFabricEmpty')}
                </AppText>
              </AnimatedPressable>
            </PickerSection>
            <PickerSection title={listTitle} fill listMinHeight={catalogListMin}>
              {searchBar}
              {pickList}
            </PickerSection>
          </>
        ) : (
          <>
            {searchBar}
            {pickList}
          </>
        )}
      </View>
    </BottomSheet>
  );
}

function PickerSection({
  title,
  fill,
  listMinHeight,
  children,
}: {
  title: string;
  fill?: boolean;
  listMinHeight?: number;
  children: ReactNode;
}) {
  const { colors, theme, colorScheme } = useTheme();
  return (
    <View
      style={{
        borderRadius: theme.radius.xl,
        borderWidth: 1,
        borderColor: colors.borderStrong,
        backgroundColor: colors.surface,
        overflow: 'hidden',
        flexGrow: fill ? 1 : 0,
        flexShrink: fill ? 1 : 0,
        minHeight: fill && listMinHeight ? listMinHeight + 88 : undefined,
        ...orderBoardShadow(colorScheme),
      }}
    >
      <View
        style={{
          backgroundColor: colors.surfaceSecondary,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
          paddingHorizontal: theme.spacing.md,
          minHeight: 36,
          justifyContent: 'center',
        }}
      >
        <AppText variant="caption" weight="semibold" color="muted">
          {title}
        </AppText>
      </View>
      <View style={{ padding: theme.spacing.md, gap: theme.spacing.sm, flex: fill ? 1 : undefined }}>
        {children}
      </View>
    </View>
  );
}
