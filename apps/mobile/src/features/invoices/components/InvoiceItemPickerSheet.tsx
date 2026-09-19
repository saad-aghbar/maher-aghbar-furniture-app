import { useEffect, useMemo, useState } from 'react';
import { Image, ScrollView, StyleSheet, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { localizedName } from '@maher/i18n';
import { listInventoryItems } from '@/api/modules/inventory';
import { AppText } from '@/components/AppText';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { SearchBarShell } from '@/components/forms/SearchBarShell';
import { AppTextInput } from '@/components/forms/AppTextInput';
import { QtyStepperField } from '@/components/forms/QtyStepperField';
import { TextField } from '@/components/forms/TextField';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { useSheetListViewport } from '@/components/sheets/sheetListViewport';
import { flattenCatalogPages, useCatalogInfiniteQuery } from '@/features/catalog/query';
import { resolveOrderMediaUri } from '@/features/sales-orders/components/OrderCardMedia';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { resolveAppFontStyle, useTheme } from '@/theme';
import {
  catalogProductToLinePick,
  customItemToLinePick,
  inventoryItemToLinePick,
  type InvoiceLinePick,
} from '../invoiceLineDraft';

type Source = 'catalog' | 'inventory';

type Props = {
  open: boolean;
  onClose: () => void;
  onClosed?: () => void;
  source: Source;
  onPick: (line: InvoiceLinePick) => void;
  title?: string;
  initialMode?: 'list' | 'custom';
  initialCustomName?: string;
};

const THUMB = 52;

export function InvoiceItemPickerSheet({
  open,
  onClose,
  onClosed,
  source,
  onPick,
  title,
  initialMode = 'list',
  initialCustomName = '',
}: Props) {
  const { t, isRTL, locale, formatCurrency } = useLocale();
  const { colors, theme } = useTheme();
  const { sheetHeight } = useSheetListViewport();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const [mode, setMode] = useState<'list' | 'custom'>('list');
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [customName, setCustomName] = useState('');
  const [customPrice, setCustomPrice] = useState('');
  const [customQty, setCustomQty] = useState('1');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setMode(initialMode);
    setSearch('');
    setQ('');
    setCustomName(initialCustomName);
    setCustomPrice('');
    setCustomQty('1');
    setSelectedId(null);
  }, [open, initialMode, initialCustomName]);

  useEffect(() => {
    const id = setTimeout(() => setQ(search.trim()), 250);
    return () => clearTimeout(id);
  }, [search]);

  const catalogQuery = useCatalogInfiniteQuery({ q: q || undefined }, open && source === 'catalog');
  const inventoryQuery = useQuery({
    queryKey: ['invoice-item-picker', 'inventory', q] as const,
    queryFn: () =>
      listInventoryItems({
        page: 1,
        pageSize: 50,
        q: q || undefined,
        itemClass: 'RAW_MATERIAL',
      }),
    enabled: open && source === 'inventory',
  });

  const catalogRows = useMemo(
    () => flattenCatalogPages(catalogQuery.data),
    [catalogQuery.data],
  );
  const inventoryRows = inventoryQuery.data?.data ?? [];

  const selectedCatalog = catalogRows.find((row) => row.id === selectedId);
  const selectedInventory = inventoryRows.find((row) => row.id === selectedId);

  const confirm = () => {
    if (mode === 'custom') {
      if (!customName.trim()) return;
      void haptics.confirmLight();
      onPick(customItemToLinePick(customName, customPrice, customQty || '1'));
      onClose();
      return;
    }
    if (source === 'catalog' && selectedCatalog) {
      void haptics.confirmLight();
      onPick(catalogProductToLinePick(selectedCatalog, locale));
      onClose();
      return;
    }
    if (source === 'inventory' && selectedInventory) {
      void haptics.confirmLight();
      onPick(inventoryItemToLinePick(selectedInventory, locale));
      onClose();
    }
  };

  const canConfirm =
    mode === 'custom'
      ? Boolean(customName.trim())
      : source === 'catalog'
        ? Boolean(selectedCatalog)
        : Boolean(selectedInventory);

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      onClosed={onClosed}
      title={title ?? t('mobile.invoices.addItem')}
      sheetHeight={sheetHeight}
    >
      <View style={{ gap: theme.spacing.md, flex: 1, minHeight: 0 }}>
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
          {(['list', 'custom'] as const).map((key) => {
            const focused = mode === key;
            return (
              <AnimatedPressable
                key={key}
                variant="button"
                onPress={() => {
                  if (key === mode) return;
                  void haptics.selection();
                  setMode(key);
                }}
                style={{
                  flex: 1,
                  borderRadius: 20,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: focused ? colors.brandSoft : 'transparent',
                  borderWidth: focused ? 1 : 0,
                  borderColor: focused ? colors.brand : 'transparent',
                }}
              >
                <AppText variant="caption" weight={titleWeight} color={focused ? 'brand' : 'secondary'}>
                  {key === 'list'
                    ? source === 'inventory'
                      ? t('mobile.invoices.searchMaterials')
                      : t('mobile.invoices.searchProducts')
                    : t('mobile.invoices.customItem')}
                </AppText>
              </AnimatedPressable>
            );
          })}
        </View>

        {mode === 'custom' ? (
          <View style={{ gap: theme.spacing.md }}>
            <TextField
              value={customName}
              onChangeText={setCustomName}
              placeholder={t('mobile.invoices.lineDescription')}
            />
            <QtyStepperField
              label={t('mobile.invoices.qty')}
              value={customQty}
              onChangeText={setCustomQty}
              step={1}
              decimals={2}
              min={0.001}
            />
            <QtyStepperField
              label={t('mobile.invoices.unitPrice')}
              value={customPrice}
              onChangeText={setCustomPrice}
              unit="₪"
              step={1}
              decimals={2}
            />
          </View>
        ) : (
          <>
            <SearchBarShell>
              <AppTextInput
                value={search}
                onChangeText={setSearch}
                placeholder={
                  source === 'inventory'
                    ? t('mobile.invoices.searchMaterials')
                    : t('mobile.invoices.searchProducts')
                }
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
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
            <ScrollView
              nestedScrollEnabled
              keyboardShouldPersistTaps="handled"
              style={{ flex: 1 }}
              contentContainerStyle={{ gap: theme.spacing.sm, paddingBottom: theme.spacing.sm }}
            >
              {source === 'catalog'
                ? catalogRows.map((row) => {
                    const name = localizedName(
                      locale,
                      { nameEn: row.nameEn, nameAr: row.nameAr, nameHe: row.nameHe },
                      row.sku,
                    );
                    const price = Number(row.dealerPrice ?? row.price);
                    return (
                      <PickRow
                        key={row.id}
                        name={name}
                        meta={row.sku}
                        price={Number.isFinite(price) && price > 0 ? formatCurrency(price) : null}
                        imageUrl={row.imageUrl ?? row.thumbnailUrl}
                        active={selectedId === row.id}
                        onPress={() => {
                          void haptics.selection();
                          setSelectedId(row.id);
                        }}
                      />
                    );
                  })
                : inventoryRows.map((row) => {
                    const name = localizedName(
                      locale,
                      { nameEn: row.nameEn, nameAr: row.nameAr, nameHe: row.nameHe },
                      row.sku,
                    );
                    const cost = Number(row.standardCost);
                    return (
                      <PickRow
                        key={row.id}
                        name={name}
                        meta={row.sku}
                        price={Number.isFinite(cost) && cost > 0 ? formatCurrency(cost) : null}
                        imageUrl={row.imageUrl}
                        active={selectedId === row.id}
                        onPress={() => {
                          void haptics.selection();
                          setSelectedId(row.id);
                        }}
                      />
                    );
                  })}
              {(source === 'catalog' ? catalogRows.length : inventoryRows.length) === 0 ? (
                <AppText
                  variant="caption"
                  color="muted"
                  style={{ textAlign: isRTL ? 'right' : 'left', paddingVertical: theme.spacing.md }}
                >
                  {t('mobile.invoices.noProductsMatch')}
                </AppText>
              ) : null}
            </ScrollView>
          </>
        )}

        <PrimaryButton
          label={t('mobile.invoices.pickItem')}
          onPress={confirm}
          disabled={!canConfirm}
          style={{ borderRadius: theme.radius.full, minHeight: 44 }}
        />
        <SecondaryButton
          label={t('common.cancel')}
          onPress={onClose}
          style={{ borderRadius: theme.radius.full, minHeight: 44 }}
        />
      </View>
    </BottomSheet>
  );
}

function PickRow({
  name,
  meta,
  price,
  imageUrl,
  active,
  onPress,
}: {
  name: string;
  meta?: string | null;
  price: string | null;
  imageUrl?: string | null;
  active: boolean;
  onPress: () => void;
}) {
  const { isRTL, locale } = useLocale();
  const { colors, theme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const imageUri = resolveOrderMediaUri(imageUrl);
  return (
    <AnimatedPressable
      variant="card"
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        gap: theme.spacing.md,
        padding: theme.spacing.sm,
        borderRadius: theme.radius.lg,
        borderWidth: 1.5,
        borderColor: active ? colors.brand : colors.border,
        backgroundColor: active ? colors.brandSoft : colors.surfaceSecondary,
      }}
    >
      <View
        style={{
          width: THUMB,
          height: THUMB,
          borderRadius: theme.radius.md,
          backgroundColor: colors.surface,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.borderStrong,
          overflow: 'hidden',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {imageUri ? (
          <Image
            source={{ uri: imageUri }}
            style={StyleSheet.absoluteFillObject}
            resizeMode="cover"
            accessibilityIgnoresInvertColors
          />
        ) : (
          <Ionicons name="cube-outline" size={22} color={colors.brand} />
        )}
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <AppText variant="label" weight={titleWeight} numberOfLines={1}>
          {name}
        </AppText>
        {meta ? (
          <AppText variant="caption" color="muted" dir="ltr" numberOfLines={1}>
            {meta}
          </AppText>
        ) : null}
      </View>
      {price ? (
        <AppText variant="caption" weight={titleWeight} dir="ltr" color="brand">
          {price}
        </AppText>
      ) : null}
    </AnimatedPressable>
  );
}
