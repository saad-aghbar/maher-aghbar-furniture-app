import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { SearchBarShell } from '@/components/forms/SearchBarShell';
import { useLocale } from '@/i18n';
import { haptics } from '@/motion';
import { useTheme } from '@/theme';
import type { Warehouse } from '../api';

export type WarehouseBalanceHint = {
  warehouseId: string;
  quantityLabel: string;
};

type WarehousePickListProps = {
  warehouses: Warehouse[];
  selectedId: string;
  onSelect: (id: string) => void;
  label?: string;
  balances?: WarehouseBalanceHint[];
  /**
   * Fixed scroll viewport height. Required so long lists scroll instead of
   * expanding the sheet.
   */
  listHeight?: number;
  /** Change when the parent sheet opens to clear search. */
  resetToken?: boolean | string | number;
  /** Optional first row that clears selection (`onSelect('')`). */
  allowNone?: boolean;
  noneLabel?: string;
};

function matchesQuery(wh: Warehouse, q: string, locale: string): boolean {
  if (!q) return true;
  const name = locale === 'ar' ? wh.nameAr || wh.nameEn : wh.nameEn || wh.nameAr;
  const hay = `${wh.code} ${name} ${wh.nameEn ?? ''} ${wh.nameAr ?? ''} ${wh.type ?? ''}`.toLowerCase();
  return hay.includes(q);
}

/**
 * Searchable warehouse list with a fixed-height scroll region for long catalogs.
 */
export function WarehousePickList({
  warehouses,
  selectedId,
  onSelect,
  label,
  balances = [],
  listHeight = 220,
  resetToken,
  allowNone = false,
  noneLabel,
}: WarehousePickListProps) {
  const { t, locale, isRTL } = useLocale();
  const { colors, theme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const [q, setQ] = useState('');

  useEffect(() => {
    setQ('');
  }, [resetToken]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return warehouses.filter((wh) => matchesQuery(wh, needle, locale));
  }, [warehouses, q, locale]);

  const showNone = allowNone && !q.trim();
  const empty = filtered.length === 0 && !showNone;

  function warehouseLabel(wh: Warehouse) {
    const name = locale === 'ar' ? wh.nameAr || wh.nameEn : wh.nameEn || wh.nameAr;
    return `${wh.code} — ${name}`;
  }

  function renderRow({
    key,
    selected,
    title,
    subtitle,
    onPress,
  }: {
    key: string;
    selected: boolean;
    title: string;
    subtitle?: string;
    onPress: () => void;
  }) {
    return (
      <Pressable
        key={key}
        onPress={() => {
          void haptics.selection();
          onPress();
        }}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        style={{
          minHeight: theme.sizes.touch.min,
          borderWidth: selected ? 1.5 : 1,
          borderColor: selected ? colors.brand : colors.borderStrong,
          backgroundColor: selected ? colors.brandSoft : colors.surfaceSecondary,
          borderRadius: theme.radius.xl,
          paddingHorizontal: theme.spacing.md,
          paddingVertical: theme.spacing.sm,
          justifyContent: 'center',
          gap: 2,
          overflow: 'hidden',
        }}
      >
        {selected ? (
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              start: 0,
              top: 8,
              bottom: 8,
              width: 3,
              borderRadius: 2,
              backgroundColor: colors.brand,
            }}
          />
        ) : null}
        <AppText
          weight={selected ? titleWeight : 'medium'}
          color={selected ? 'brand' : 'primary'}
          numberOfLines={2}
          style={{ textAlign: isRTL ? 'right' : 'left' }}
        >
          {title}
        </AppText>
        {subtitle ? (
          <AppText
            variant="caption"
            color="secondary"
            style={{ textAlign: isRTL ? 'right' : 'left' }}
          >
            {subtitle}
          </AppText>
        ) : null}
      </Pressable>
    );
  }

  return (
    <View style={{ gap: theme.spacing.sm }}>
      {label ? (
        <AppText
          variant="caption"
          color="secondary"
          style={{ textAlign: isRTL ? 'right' : 'left' }}
        >
          {label}
        </AppText>
      ) : null}

      <SearchBarShell>
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder={t('mobile.inventory.searchWarehouses')}
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          clearButtonMode="while-editing"
          accessibilityLabel={t('mobile.inventory.searchWarehouses')}
          style={{
            flex: 1,
            minWidth: 0,
            minHeight: theme.sizes.touch.min - 8,
            paddingVertical: 0,
            color: colors.textPrimary,
            writingDirection: isRTL ? 'rtl' : 'ltr',
            textAlign: isRTL ? 'right' : 'left',
          }}
        />
      </SearchBarShell>

      <View
        style={{
          height: listHeight,
          borderRadius: theme.radius.xl,
          borderWidth: 1,
          borderColor: colors.borderStrong,
          backgroundColor: colors.surface,
          overflow: 'hidden',
          ...theme.elevation.card,
        }}
      >
        <ScrollView
          nestedScrollEnabled
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator
          bounces
          style={{ flex: 1 }}
          contentContainerStyle={{
            gap: theme.spacing.sm,
            padding: theme.spacing.sm,
            paddingBottom: theme.spacing.md,
            flexGrow: empty ? 1 : undefined,
          }}
        >
          {empty ? (
            <AppText
              variant="caption"
              color="secondary"
              style={{ paddingVertical: theme.spacing.sm }}
            >
              {warehouses.length === 0
                ? t('mobile.inventory.noWarehouses')
                : t('mobile.inventory.emptyWarehouseSearch')}
            </AppText>
          ) : (
            <>
              {showNone
                ? renderRow({
                    key: '__none__',
                    selected: !selectedId,
                    title: noneLabel ?? t('catalog.noneOption'),
                    onPress: () => onSelect(''),
                  })
                : null}
              {filtered.map((wh) => {
                const selected = wh.id === selectedId;
                const onHand = balances.find((b) => b.warehouseId === wh.id);
                return renderRow({
                  key: wh.id,
                  selected,
                  title: warehouseLabel(wh),
                  subtitle: onHand
                    ? t('mobile.inventory.addStockOnHand', { qty: onHand.quantityLabel })
                    : undefined,
                  onPress: () => onSelect(wh.id),
                });
              })}
            </>
          )}
        </ScrollView>
      </View>
    </View>
  );
}
