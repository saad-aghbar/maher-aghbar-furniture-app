import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Dimensions, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '@/components/AppText';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { TextField } from '@/components/forms/TextField';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';
import {
  COST_ORDER_STATUS_OPTIONS,
  COST_RETURN_STATUS_OPTIONS,
  costFilterActiveCount,
  type CostDesk,
  type CostFilterOption,
  type CostFilterState,
} from '../costFilters';

type Props = {
  open: boolean;
  desk?: CostDesk;
  onClose: () => void;
  value: CostFilterState;
  onChange: (next: CostFilterState) => void;
  onApply: () => void;
  onReset: () => void;
  dealers?: CostFilterOption[];
  products?: CostFilterOption[];
};

const COMPLEXITY = ['STANDARD', 'MODIFIED', 'CUSTOM'] as const;
const COVERAGE = ['full', 'partial', 'unpriced'] as const;
const MARGIN = ['negative', 'low', 'healthy'] as const;
const DELIVERED = ['delivered', 'active'] as const;
const ORDER_SORT = ['newest', 'highestCost', 'lowestMargin', 'highestMargin', 'longestTime', 'largestSale'] as const;
const PRODUCT_SORT = ['highestCost', 'lowestMargin', 'mostProduced', 'mostReturned', 'largestVariance'] as const;
const LIFECYCLE = ['RAW', 'SEMI', 'FIN'] as const;
const RETURN_SORT = ['newest', 'highestCost', 'mostPieces'] as const;

const SECTION_ICON = {
  dealer: 'people-outline',
  product: 'cube-outline',
  status: 'flag-outline',
  complexity: 'layers-outline',
  coverage: 'calculator-outline',
  delivered: 'car-outline',
  margin: 'trending-up-outline',
  returns: 'return-down-back-outline',
  rework: 'refresh-outline',
  lifecycle: 'albums-outline',
  sort: 'swap-vertical-outline',
} as const satisfies Record<string, keyof typeof Ionicons.glyphMap>;

const LIST_BOX_MAX = 200;

export function costFilterSheetMaxHeight(windowHeight: number) {
  return Math.min(Math.round(windowHeight * 0.88), 720);
}

export function CostFilterSheet({
  open,
  desk = 'orders',
  onClose,
  value,
  onChange,
  onApply,
  onReset,
  dealers = [],
  products = [],
}: Props) {
  const { t, isRTL } = useLocale();
  const { theme, colors, colorScheme } = useTheme();
  const insets = useSafeAreaInsets();
  const height = Dimensions.get('window').height;
  const sheetHeight = costFilterSheetMaxHeight(height);
  const activeCount = costFilterActiveCount(value);
  const [dealerQuery, setDealerQuery] = useState('');
  const [productQuery, setProductQuery] = useState('');

  const showDealer = desk === 'money' || desk === 'orders' || desk === 'returns';
  const showProduct = desk === 'money' || desk === 'orders' || desk === 'products' || desk === 'returns';
  const showOrderStatus = desk === 'money' || desk === 'orders';
  const showReturnStatus = desk === 'returns';

  useEffect(() => {
    if (!open) {
      setDealerQuery('');
      setProductQuery('');
    }
  }, [open]);

  const chipRow = {
    flexDirection: (isRTL ? 'row-reverse' : 'row') as 'row' | 'row-reverse',
    flexWrap: 'wrap' as const,
    gap: theme.spacing.sm,
  };

  const apply = () => {
    onApply();
  };

  const reset = () => {
    onReset();
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={t('mobile.reports.filterTitle')}
      fitContent
      maxHeight={sheetHeight}
    >
      <View style={{ gap: theme.spacing.md }}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          style={{ maxHeight: sheetHeight - 168 }}
          contentContainerStyle={{
            gap: theme.spacing.md,
            paddingBottom: theme.spacing.sm,
          }}
        >
          {showReturnStatus ? (
            <FilterSection
              icon={SECTION_ICON.status}
              title={t('mobile.reports.filterStatus')}
              accent={value.status ? colors.brand : undefined}
            >
              <ScrollableOptionList>
                <OptionRow
                  label={t('mobile.reports.allStatuses')}
                  active={!value.status}
                  onPress={() => onChange({ ...value, status: null })}
                />
                {COST_RETURN_STATUS_OPTIONS.map((status) => (
                  <OptionRow
                    key={status}
                    testID={`cost-filter-return-status-${status}`}
                    label={t(`mobile.reports.returnStatus.${status}`)}
                    active={value.status === status}
                    onPress={() => onChange({ ...value, status })}
                  />
                ))}
              </ScrollableOptionList>
            </FilterSection>
          ) : null}

          {showDealer ? (
            <FilterSection
              icon={SECTION_ICON.dealer}
              title={t('mobile.reports.filterDealer')}
              accent={value.customerId ? colors.brand : undefined}
            >
              <NamedSearchPicker
                items={dealers}
                selectedId={value.customerId}
                query={dealerQuery}
                onQueryChange={setDealerQuery}
                allLabel={t('accounting.allCustomers')}
                searchPlaceholder={t('mobile.reports.filterDealerSearch')}
                emptyLabel={t('mobile.reports.filterDealerEmpty')}
                clearLabel={t('mobile.reports.filterDealerClear')}
                onSelect={(id) => {
                  void haptics.selection();
                  onChange({ ...value, customerId: id });
                }}
              />
            </FilterSection>
          ) : null}

          {showProduct ? (
            <FilterSection
              icon={SECTION_ICON.product}
              title={t('mobile.reports.filterProduct')}
              accent={value.productId ? colors.brand : undefined}
            >
              <NamedSearchPicker
                items={products}
                selectedId={value.productId}
                query={productQuery}
                onQueryChange={setProductQuery}
                allLabel={t('accounting.allProducts')}
                searchPlaceholder={t('mobile.reports.filterProductSearch')}
                emptyLabel={t('mobile.reports.filterProductEmpty')}
                clearLabel={t('mobile.reports.filterProductClear')}
                onSelect={(id) => {
                  void haptics.selection();
                  onChange({ ...value, productId: id });
                }}
              />
            </FilterSection>
          ) : null}

          {showOrderStatus ? (
            <FilterSection
              icon={SECTION_ICON.status}
              title={t('mobile.reports.filterStatus')}
              accent={value.status ? colors.brand : undefined}
            >
              <ScrollableOptionList>
                <OptionRow
                  label={t('mobile.reports.allStatuses')}
                  active={!value.status}
                  onPress={() => onChange({ ...value, status: null })}
                />
                {COST_ORDER_STATUS_OPTIONS.map((status) => (
                  <OptionRow
                    key={status}
                    label={t(`mobile.reports.status.${status}`)}
                    active={value.status === status}
                    onPress={() => onChange({ ...value, status })}
                  />
                ))}
              </ScrollableOptionList>
            </FilterSection>
          ) : null}

          {desk === 'orders' || desk === 'products' ? (
            <FilterSection
              icon={SECTION_ICON.complexity}
              title={t('mobile.reports.filterComplexity')}
              accent={value.complexity ? colors.brand : undefined}
            >
              <View style={chipRow}>
                <FloorChip
                  label={t('mobile.reports.allComplexities')}
                  active={!value.complexity}
                  onPress={() => onChange({ ...value, complexity: null })}
                />
                {COMPLEXITY.map((item) => (
                  <FloorChip
                    key={item}
                    label={t(`mobile.reports.complexity.${item}`)}
                    active={value.complexity === item}
                    onPress={() => onChange({ ...value, complexity: item })}
                  />
                ))}
              </View>
            </FilterSection>
          ) : null}

          {desk === 'money' || desk === 'orders' ? (
            <FilterSection
              icon={SECTION_ICON.coverage}
              title={t('mobile.reports.filterCoverage')}
              accent={value.coverage ? colors.brand : undefined}
            >
              <View style={chipRow}>
                <FloorChip
                  label={t('mobile.reports.allCoverage')}
                  active={!value.coverage}
                  onPress={() => onChange({ ...value, coverage: null })}
                />
                {COVERAGE.map((item) => (
                  <FloorChip
                    key={item}
                    label={t(`mobile.reports.coverage.${item}`)}
                    active={value.coverage === item}
                    onPress={() => onChange({ ...value, coverage: item })}
                  />
                ))}
              </View>
            </FilterSection>
          ) : null}

          {desk === 'orders' ? (
            <>
              <FilterSection
                icon={SECTION_ICON.delivered}
                title={t('mobile.reports.filterDelivered')}
                accent={value.delivered ? colors.brand : undefined}
              >
                <View style={chipRow}>
                  <FloorChip
                    label={t('mobile.reports.allDelivered')}
                    active={!value.delivered}
                    onPress={() => onChange({ ...value, delivered: null })}
                  />
                  {DELIVERED.map((item) => (
                    <FloorChip
                      key={item}
                      label={t(`mobile.reports.delivered.${item}`)}
                      active={value.delivered === item}
                      onPress={() => onChange({ ...value, delivered: item })}
                    />
                  ))}
                </View>
              </FilterSection>
              <FilterSection
                icon={SECTION_ICON.margin}
                title={t('mobile.reports.filterMargin')}
                accent={value.marginHealth ? colors.brand : undefined}
              >
                <View style={chipRow}>
                  <FloorChip
                    label={t('mobile.reports.allMargin')}
                    active={!value.marginHealth}
                    onPress={() => onChange({ ...value, marginHealth: null })}
                  />
                  {MARGIN.map((item) => (
                    <FloorChip
                      key={item}
                      label={t(`mobile.reports.marginHealth.${item}`)}
                      active={value.marginHealth === item}
                      onPress={() => onChange({ ...value, marginHealth: item })}
                    />
                  ))}
                </View>
              </FilterSection>
              <FilterSection
                icon={SECTION_ICON.returns}
                title={t('mobile.reports.filterReturns')}
                accent={value.hasReturn ? colors.brand : undefined}
              >
                <View style={chipRow}>
                  <FloorChip
                    label={t('mobile.reports.allReturns')}
                    active={!value.hasReturn}
                    onPress={() => onChange({ ...value, hasReturn: null })}
                  />
                  <FloorChip
                    label={t('mobile.reports.hasReturn')}
                    active={value.hasReturn === 'true'}
                    onPress={() => onChange({ ...value, hasReturn: 'true' })}
                  />
                  <FloorChip
                    label={t('mobile.reports.noReturn')}
                    active={value.hasReturn === 'false'}
                    onPress={() => onChange({ ...value, hasReturn: 'false' })}
                  />
                </View>
              </FilterSection>
              <FilterSection
                icon={SECTION_ICON.rework}
                title={t('mobile.reports.filterRework')}
                accent={value.hasRework ? colors.brand : undefined}
              >
                <View style={chipRow}>
                  <FloorChip
                    label={t('mobile.reports.allRework')}
                    active={!value.hasRework}
                    onPress={() => onChange({ ...value, hasRework: null })}
                  />
                  <FloorChip
                    label={t('mobile.reports.hasRework')}
                    active={value.hasRework === 'true'}
                    onPress={() => onChange({ ...value, hasRework: 'true' })}
                  />
                  <FloorChip
                    label={t('mobile.reports.noRework')}
                    active={value.hasRework === 'false'}
                    onPress={() => onChange({ ...value, hasRework: 'false' })}
                  />
                </View>
              </FilterSection>
            </>
          ) : null}

          {desk === 'inventory' ? (
            <FilterSection
              icon={SECTION_ICON.lifecycle}
              title={t('mobile.reports.filterLifecycle')}
              accent={value.lifecycle ? colors.brand : undefined}
            >
              <View style={chipRow}>
                <FloorChip
                  label={t('mobile.reports.allLifecycle')}
                  active={!value.lifecycle}
                  onPress={() => onChange({ ...value, lifecycle: null })}
                />
                {LIFECYCLE.map((item) => (
                  <FloorChip
                    key={item}
                    label={t(`mobile.reports.lifecycle.${item}`)}
                    active={value.lifecycle === item}
                    onPress={() => onChange({ ...value, lifecycle: item })}
                  />
                ))}
              </View>
            </FilterSection>
          ) : null}

          {desk === 'orders' ? (
            <FilterSection
              icon={SECTION_ICON.sort}
              title={t('mobile.reports.sortTitle')}
              accent={value.sort ? colors.brand : undefined}
            >
              <View style={chipRow}>
                {ORDER_SORT.map((item) => (
                  <FloorChip
                    key={item}
                    label={t(`mobile.reports.sort.${item}`)}
                    active={(value.sort ?? 'newest') === item}
                    onPress={() => onChange({ ...value, sort: item === 'newest' ? null : item })}
                  />
                ))}
              </View>
            </FilterSection>
          ) : null}

          {desk === 'products' ? (
            <FilterSection
              icon={SECTION_ICON.sort}
              title={t('mobile.reports.sortTitle')}
              accent={value.sort ? colors.brand : undefined}
            >
              <View style={chipRow}>
                {PRODUCT_SORT.map((item) => (
                  <FloorChip
                    key={item}
                    label={t(`mobile.reports.sort.${item}`)}
                    active={value.sort === item}
                    onPress={() =>
                      onChange({ ...value, sort: value.sort === item ? null : item })
                    }
                  />
                ))}
              </View>
            </FilterSection>
          ) : null}

          {desk === 'inventory' ? (
            <FilterSection
              icon={SECTION_ICON.sort}
              title={t('mobile.reports.sortTitle')}
              accent={value.sort ? colors.brand : undefined}
            >
              <View style={chipRow}>
                <FloorChip
                  label={t('mobile.reports.sort.sku')}
                  active={!value.sort}
                  onPress={() => onChange({ ...value, sort: null })}
                />
                <FloorChip
                  label={t('mobile.reports.sort.highestValue')}
                  active={value.sort === 'highestValue'}
                  onPress={() => onChange({ ...value, sort: 'highestValue' })}
                />
              </View>
            </FilterSection>
          ) : null}

          {desk === 'returns' ? (
            <FilterSection
              icon={SECTION_ICON.sort}
              title={t('mobile.reports.sortTitle')}
              accent={value.sort ? colors.brand : undefined}
            >
              <View style={chipRow}>
                {RETURN_SORT.map((item) => (
                  <FloorChip
                    key={item}
                    label={t(`mobile.reports.sort.${item}`)}
                    active={(value.sort ?? 'newest') === item}
                    onPress={() => onChange({ ...value, sort: item === 'newest' ? null : item })}
                  />
                ))}
              </View>
            </FilterSection>
          ) : null}
        </ScrollView>

        <View
          style={{
            paddingTop: theme.spacing.md,
            borderTopWidth: 1,
            borderTopColor: colors.border,
            flexDirection: isRTL ? 'row-reverse' : 'row',
            gap: theme.spacing.sm,
            paddingBottom: Math.max(insets.bottom, theme.spacing.sm),
          }}
        >
          <SecondaryButton
            label={t('accounting.filterReset')}
            onPress={reset}
            style={{
              flex: 1,
              borderRadius: theme.radius.full,
              minHeight: theme.sizes.touch.min,
              paddingVertical: 0,
            }}
          />
          <PrimaryButton
            label={
              activeCount > 0
                ? t('mobile.reports.filterApplyWithCount', { n: String(activeCount) })
                : t('accounting.filterApply')
            }
            haptic="light"
            onPress={apply}
            trailing={<Ionicons name="checkmark" size={18} color={colors.onBrand} />}
            style={{
              flex: 1.35,
              borderRadius: theme.radius.full,
              minHeight: theme.sizes.touch.min,
              paddingVertical: 0,
              ...orderBoardShadow(colorScheme),
            }}
          />
        </View>
      </View>
    </BottomSheet>
  );
}

function FilterSection({
  title,
  icon,
  children,
  accent,
}: {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  children: ReactNode;
  accent?: string;
}) {
  const { theme, colors, colorScheme } = useTheme();
  const { isRTL, locale } = useLocale();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const railPad = accent ? 4 : 0;

  return (
    <View
      style={{
        borderRadius: theme.radius.xl,
        borderWidth: 1,
        borderColor: colors.borderStrong,
        backgroundColor: colors.surface,
        overflow: 'hidden',
        ...orderBoardShadow(colorScheme),
      }}
    >
      {accent ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            width: 3,
            backgroundColor: accent,
            opacity: 0.55,
            ...(isRTL ? { right: 0 } : { left: 0 }),
          }}
        />
      ) : null}
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          gap: theme.spacing.sm,
          paddingHorizontal: theme.spacing.md,
          paddingVertical: theme.spacing.sm + 2,
          ...(isRTL
            ? { paddingRight: theme.spacing.md + railPad }
            : { paddingLeft: theme.spacing.md + railPad }),
          backgroundColor: colors.surfaceSecondary,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <View
          style={{
            width: 28,
            height: 28,
            borderRadius: 14,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: accent ? colors.brandSoft : colors.surface,
            borderWidth: 1,
            borderColor: accent ?? colors.border,
          }}
        >
          <Ionicons name={icon} size={14} color={accent ?? colors.brand} />
        </View>
        <AppText
          variant="caption"
          weight={titleWeight}
          style={{
            flex: 1,
            letterSpacing: locale === 'ar' ? 0 : 0.55,
            textTransform: locale === 'ar' ? 'none' : 'uppercase',
            fontSize: 11,
            lineHeight: 14,
            color: colors.brand,
            textAlign: isRTL ? 'right' : 'left',
          }}
        >
          {title}
        </AppText>
      </View>
      <View
        style={{
          padding: theme.spacing.md,
          gap: theme.spacing.sm,
          ...(isRTL
            ? { paddingRight: theme.spacing.md + railPad }
            : { paddingLeft: theme.spacing.md + railPad }),
        }}
      >
        {children}
      </View>
    </View>
  );
}

function FloorChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const { isRTL, locale } = useLocale();
  const { colors, theme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  return (
    <AnimatedPressable
      variant="button"
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
      onPress={() => {
        void haptics.selection();
        onPress();
      }}
      style={{
        minWidth: 96,
        maxWidth: 168,
        paddingHorizontal: theme.spacing.md,
        paddingVertical: theme.spacing.sm,
        minHeight: 40,
        borderRadius: theme.radius.lg,
        backgroundColor: active ? colors.brandSoft : colors.surfaceSecondary,
        borderWidth: 1.5,
        borderColor: active ? colors.brand : colors.border,
        overflow: 'hidden',
        alignItems: isRTL ? 'flex-end' : 'flex-start',
        justifyContent: 'center',
      }}
    >
      {active ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            width: 3,
            backgroundColor: colors.brand,
            opacity: 0.55,
            ...(isRTL ? { right: 0 } : { left: 0 }),
          }}
        />
      ) : null}
      <AppText
        variant="label"
        weight={active ? titleWeight : 'medium'}
        numberOfLines={1}
        style={{
          color: active ? colors.brand : colors.textPrimary,
          textAlign: isRTL ? 'right' : 'left',
          paddingLeft: active && !isRTL ? 4 : 0,
          paddingRight: active && isRTL ? 4 : 0,
        }}
      >
        {label}
      </AppText>
    </AnimatedPressable>
  );
}

function ScrollableOptionList({ children }: { children: ReactNode }) {
  const { colors, theme, colorScheme } = useTheme();
  return (
    <View
      testID="cost-filter-option-list"
      style={{
        borderWidth: 1,
        borderColor: colors.borderStrong,
        borderRadius: theme.radius.xl,
        backgroundColor: colors.surface,
        overflow: 'hidden',
        maxHeight: LIST_BOX_MAX,
        ...orderBoardShadow(colorScheme),
      }}
    >
      <ScrollView
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator
      >
        {children}
      </ScrollView>
    </View>
  );
}

function NamedSearchPicker({
  items,
  selectedId,
  query,
  onQueryChange,
  onSelect,
  allLabel,
  searchPlaceholder,
  emptyLabel,
  clearLabel,
}: {
  items: CostFilterOption[];
  selectedId: string | null;
  query: string;
  onQueryChange: (q: string) => void;
  onSelect: (id: string | null) => void;
  allLabel: string;
  searchPlaceholder: string;
  emptyLabel: string;
  clearLabel: string;
}) {
  const { isRTL } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const selected = items.find((d) => d.id === selectedId);
  const needle = query.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!needle) return items;
    return items.filter((d) => {
      const hay = (d.searchText || `${d.name} ${d.code ?? ''}`).toLowerCase();
      return hay.includes(needle);
    });
  }, [items, needle]);

  return (
    <View style={{ gap: theme.spacing.sm }}>
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: theme.spacing.sm,
          paddingVertical: theme.spacing.xs,
        }}
      >
        <AppText
          variant="caption"
          color="secondary"
          numberOfLines={1}
          style={{ flex: 1, textAlign: isRTL ? 'right' : 'left' }}
        >
          {selectedId ? (selected?.name ?? allLabel) : allLabel}
        </AppText>
        {selectedId ? (
          <AnimatedPressable
            variant="button"
            accessibilityRole="button"
            accessibilityLabel={allLabel}
            onPress={() => onSelect(null)}
            style={{
              paddingHorizontal: theme.spacing.sm,
              minHeight: 32,
              justifyContent: 'center',
            }}
          >
            <AppText variant="caption" weight="semibold" color="brand">
              {clearLabel}
            </AppText>
          </AnimatedPressable>
        ) : null}
      </View>

      <TextField
        value={query}
        onChangeText={onQueryChange}
        placeholder={searchPlaceholder}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        clearButtonMode="while-editing"
      />

      <View
        testID="cost-filter-search-list"
        style={{
          borderWidth: 1,
          borderColor: colors.borderStrong,
          borderRadius: theme.radius.xl,
          backgroundColor: colors.surface,
          overflow: 'hidden',
          maxHeight: LIST_BOX_MAX,
          ...orderBoardShadow(colorScheme),
        }}
      >
        <ScrollView
          nestedScrollEnabled
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator
        >
          <OptionRow label={allLabel} active={!selectedId} onPress={() => onSelect(null)} />
          {filtered.map((d) => (
            <OptionRow
              key={d.id}
              label={d.name}
              active={selectedId === d.id}
              onPress={() => onSelect(d.id)}
            />
          ))}
          {filtered.length === 0 ? (
            <View style={{ padding: theme.spacing.md }}>
              <AppText
                variant="caption"
                color="muted"
                style={{ textAlign: isRTL ? 'right' : 'left' }}
              >
                {emptyLabel}
              </AppText>
            </View>
          ) : null}
        </ScrollView>
      </View>
    </View>
  );
}

function OptionRow({
  label,
  active,
  onPress,
  testID,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  testID?: string;
}) {
  const { isRTL, locale } = useLocale();
  const { colors, theme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const row = (
    <AnimatedPressable
      variant="button"
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      onPress={() => {
        void haptics.selection();
        onPress();
      }}
      style={{
        minHeight: theme.sizes.touch.min,
        paddingHorizontal: theme.spacing.md,
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
            opacity: 0.55,
          }}
        />
      ) : null}
      <AppText
        variant="label"
        weight={active ? titleWeight : 'medium'}
        numberOfLines={1}
        style={{
          flex: 1,
          color: active ? colors.brand : colors.textPrimary,
          textAlign: isRTL ? 'right' : 'left',
          paddingLeft: active && !isRTL ? 4 : 0,
          paddingRight: active && isRTL ? 4 : 0,
        }}
      >
        {label}
      </AppText>
      {active ? <Ionicons name="checkmark" size={18} color={colors.brand} /> : null}
    </AnimatedPressable>
  );
  if (!testID) return row;
  return <View testID={testID}>{row}</View>;
}
