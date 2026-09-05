import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '@/components/AppText';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import {
  MonthCalendar,
  initialCursorFromValue,
  nextDateRange,
  parseYmd,
  todayYmd,
  type CalendarCursor,
} from '@/components/calendar';
import { TextField } from '@/components/forms/TextField';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';
import { orderBoardShadow } from './orderFloorStyle';

export type OrdersSortBy = 'createdAt' | 'requiredDeliveryDate' | 'number' | 'total';
export type OrdersSortDir = 'asc' | 'desc';
export type OrdersDeliveryPreset = 'any' | 'overdue' | 'week' | 'month' | 'custom';
/** Draft = not approved; any other sales-order status = approved (confirmed). */
export type OrdersApprovalFilter = 'any' | 'approved' | 'notApproved';
export type OrdersKindFilter = 'standard' | 'modified' | 'custom';

export type OrdersFilterDealerOption = {
  id: string;
  name: string;
  /** All locale names joined for search (EN/AR/HE). */
  searchText?: string;
  count: number;
};

export type OrdersFilterDraft = {
  dealerId: string; // 'all' | customer id
  approval: OrdersApprovalFilter;
  /** Empty = any kind. Multi-select Commercial kinds. */
  kinds: OrdersKindFilter[];
  sortBy: OrdersSortBy;
  sortDir: OrdersSortDir;
  deliveryPreset: OrdersDeliveryPreset;
  deliveryFrom: string;
  deliveryTo: string;
};

type OrdersFilterSheetProps = {
  open: boolean;
  onClose: () => void;
  draft: OrdersFilterDraft;
  onChange: (draft: OrdersFilterDraft) => void;
  onApply: () => void;
  onReset: () => void;
  dealers?: OrdersFilterDealerOption[];
  showDealers?: boolean;
  /** Admin-only approval section. Hidden for dealers. */
  showApproval?: boolean;
};

const SORT_OPTIONS: OrdersSortBy[] = [
  'createdAt',
  'requiredDeliveryDate',
  'number',
  'total',
];

const DELIVERY_PRESETS: OrdersDeliveryPreset[] = [
  'any',
  'overdue',
  'week',
  'month',
  'custom',
];

const APPROVAL_OPTIONS: OrdersApprovalFilter[] = ['any', 'approved', 'notApproved'];

/** RFQ statuses still waiting for a sales order (pre Confirm). */
const RFQ_NOT_APPROVED = new Set([
  'DRAFT',
  'SUBMITTED',
  'UNDER_REVIEW',
  'NEEDS_INFORMATION',
  'READY_FOR_QUOTATION',
  'QUOTED',
]);

const SECTION_ICON = {
  dealer: 'people-outline',
  approval: 'checkmark-circle-outline',
  kind: 'layers-outline',
  delivery: 'calendar-outline',
  sort: 'swap-vertical-outline',
  direction: 'arrow-down-outline',
} as const satisfies Record<string, keyof typeof Ionicons.glyphMap>;

const KIND_OPTIONS: OrdersKindFilter[] = ['standard', 'modified', 'custom'];

/**
 * Approval filter for Orders list.
 * Sales orders: DRAFT = not approved (Confirm gate); anything else = approved.
 * RFQs: pre-SO statuses = not approved; never count as approved.
 */
export function matchesApprovalFilter(
  status: string | null | undefined,
  approval: OrdersApprovalFilter,
  opts?: { kind?: 'order' | 'rfq' },
): boolean {
  if (approval === 'any') return true;
  const s = (status ?? '').toUpperCase();
  if (opts?.kind === 'rfq') {
    return approval === 'notApproved' ? RFQ_NOT_APPROVED.has(s) : false;
  }
  const isDraft = s === 'DRAFT';
  return approval === 'notApproved' ? isDraft : !isDraft;
}

/** Empty kinds = any. Unused on the admin floor — type lens is server `orderType`. */
export function matchesKindFilter(
  manufacturingKind: string | null | undefined,
  kinds: OrdersKindFilter[],
): boolean {
  if (!kinds.length) return true;
  const k = String(manufacturingKind ?? 'standard').toLowerCase();
  return kinds.includes(k as OrdersKindFilter);
}

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Map a delivery preset to ISO date bounds (empty = unbounded). */
export function deliveryBoundsForPreset(
  preset: OrdersDeliveryPreset,
  now = new Date(),
): { deliveryFrom: string; deliveryTo: string } {
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  if (preset === 'any') return { deliveryFrom: '', deliveryTo: '' };
  if (preset === 'overdue') {
    const yesterday = new Date(today);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    return { deliveryFrom: '', deliveryTo: isoDay(yesterday) };
  }
  if (preset === 'week') {
    const end = new Date(today);
    end.setUTCDate(end.getUTCDate() + 7);
    return { deliveryFrom: isoDay(today), deliveryTo: isoDay(end) };
  }
  if (preset === 'month') {
    const end = new Date(today);
    end.setUTCDate(end.getUTCDate() + 30);
    return { deliveryFrom: isoDay(today), deliveryTo: isoDay(end) };
  }
  return { deliveryFrom: '', deliveryTo: '' };
}

export function countActiveOrderFilters(
  draft: OrdersFilterDraft,
  opts?: { includeDealers?: boolean; includeApproval?: boolean },
): number {
  const includeDealers = opts?.includeDealers !== false;
  const includeApproval = opts?.includeApproval !== false;
  let n = 0;
  if (includeDealers && draft.dealerId !== 'all') n += 1;
  if (includeApproval && draft.approval !== 'any') n += 1;
  if (draft.deliveryPreset !== 'any' || draft.deliveryFrom || draft.deliveryTo) n += 1;
  if (draft.sortBy !== 'createdAt') n += 1;
  if (draft.sortDir !== 'desc') n += 1;
  return n;
}

function formatFilterYmd(
  ymd: string,
  formatDate: (value: Date | string | number) => string,
): string {
  const parsed = parseYmd(ymd);
  if (!parsed) return '—';
  return formatDate(new Date(parsed.y, parsed.m, parsed.d));
}

export const defaultOrdersFilterDraft: OrdersFilterDraft = {
  dealerId: 'all',
  approval: 'any',
  kinds: [],
  sortBy: 'createdAt',
  sortDir: 'desc',
  deliveryPreset: 'any',
  deliveryFrom: '',
  deliveryTo: '',
};

/**
 * Orders filter sheet — parchment boards + floor chips.
 */
export function OrdersFilterSheet({
  open,
  onClose,
  draft,
  onChange,
  onApply,
  onReset,
  dealers = [],
  showDealers = false,
  showApproval = false,
}: OrdersFilterSheetProps) {
  const { t, isRTL, formatDate } = useLocale();
  const { theme, colors, colorScheme } = useTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const sheetHeight = Math.min(Math.round(height * 0.88), 720);
  const activeCount = countActiveOrderFilters(draft, {
    includeDealers: showDealers,
    includeApproval: showApproval,
  });
  const [dealerQuery, setDealerQuery] = useState('');
  const [rangeCursor, setRangeCursor] = useState<CalendarCursor>(() =>
    initialCursorFromValue(draft.deliveryFrom || todayYmd()),
  );

  useEffect(() => {
    if (!open) setDealerQuery('');
  }, [open]);

  useEffect(() => {
    if (!open || draft.deliveryPreset !== 'custom') return;
    setRangeCursor(initialCursorFromValue(draft.deliveryFrom || todayYmd()));
  }, [open, draft.deliveryPreset]);

  const setDeliveryPreset = (preset: OrdersDeliveryPreset) => {
    void haptics.selection();
    if (preset === 'custom') {
      onChange({ ...draft, deliveryPreset: 'custom' });
      return;
    }
    const bounds = deliveryBoundsForPreset(preset);
    onChange({
      ...draft,
      deliveryPreset: preset,
      deliveryFrom: bounds.deliveryFrom,
      deliveryTo: bounds.deliveryTo,
    });
  };

  const chipRow = {
    flexDirection: (isRTL ? 'row-reverse' : 'row') as 'row' | 'row-reverse',
    flexWrap: 'wrap' as const,
    gap: theme.spacing.sm,
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={t('mobile.orders.filterTitle')}
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
          {showDealers ? (
            <FilterSection
              icon={SECTION_ICON.dealer}
              title={t('mobile.orders.dealerRailEyebrow')}
              accent={draft.dealerId !== 'all' ? colors.brand : undefined}
            >
              <DealerSearchPicker
                dealers={dealers}
                selectedId={draft.dealerId}
                query={dealerQuery}
                onQueryChange={setDealerQuery}
                onSelect={(dealerId) => {
                  void haptics.selection();
                  onChange({ ...draft, dealerId });
                }}
              />
            </FilterSection>
          ) : null}

          {showApproval ? (
            <FilterSection
              icon={SECTION_ICON.approval}
              title={t('mobile.orders.filterApproval')}
              accent={draft.approval !== 'any' ? colors.brand : undefined}
            >
              <View style={chipRow}>
                {APPROVAL_OPTIONS.map((opt) => (
                  <FloorChip
                    key={opt}
                    label={t(`mobile.orders.filterApprovalOptions.${opt}`)}
                    active={draft.approval === opt}
                    onPress={() => {
                      void haptics.selection();
                      onChange({ ...draft, approval: opt });
                    }}
                  />
                ))}
              </View>
            </FilterSection>
          ) : null}

          {showApproval ? (
            <FilterSection
              icon={SECTION_ICON.kind}
              title={t('mobile.orders.journey.kind.filterTitle')}
              accent={draft.kinds.length > 0 ? colors.brand : undefined}
            >
              <View style={chipRow}>
                <FloorChip
                  label={t('mobile.orders.journey.kind.any')}
                  active={draft.kinds.length === 0}
                  onPress={() => {
                    void haptics.selection();
                    onChange({ ...draft, kinds: [] });
                  }}
                />
                {KIND_OPTIONS.map((opt) => {
                  const active = draft.kinds.includes(opt);
                  return (
                    <FloorChip
                      key={opt}
                      label={t(`mobile.orders.journey.kind.${opt}`)}
                      active={active}
                      onPress={() => {
                        void haptics.selection();
                        const next = active
                          ? draft.kinds.filter((k) => k !== opt)
                          : [...draft.kinds, opt];
                        onChange({ ...draft, kinds: next });
                      }}
                    />
                  );
                })}
              </View>
            </FilterSection>
          ) : null}

          <FilterSection
            icon={SECTION_ICON.delivery}
            title={t('mobile.orders.filterDelivery')}
            accent={
              draft.deliveryPreset !== 'any' || draft.deliveryFrom || draft.deliveryTo
                ? colors.brand
                : undefined
            }
          >
            <View style={chipRow}>
              {DELIVERY_PRESETS.map((preset) => (
                <FloorChip
                  key={preset}
                  label={t(`mobile.orders.filterDeliveryPresets.${preset}`)}
                  active={draft.deliveryPreset === preset}
                  onPress={() => setDeliveryPreset(preset)}
                />
              ))}
            </View>
            {draft.deliveryPreset === 'custom' ? (
              <View style={{ gap: theme.spacing.sm, marginTop: theme.spacing.sm }}>
                <AppText
                  variant="caption"
                  color="secondary"
                  style={{ textAlign: isRTL ? 'right' : 'left' }}
                >
                  {t('mobile.orders.filterDateRangeHint')}
                </AppText>
                <AppText
                  variant="label"
                  weight="medium"
                  style={{
                    color: colors.textPrimary,
                    textAlign: isRTL ? 'right' : 'left',
                  }}
                >
                  {`${t('mobile.orders.deliveryFrom')} ${formatFilterYmd(draft.deliveryFrom, formatDate)}  ·  ${t('mobile.orders.deliveryTo')} ${formatFilterYmd(draft.deliveryTo, formatDate)}`}
                </AppText>
                <MonthCalendar
                  rangeStart={draft.deliveryFrom}
                  rangeEnd={draft.deliveryTo}
                  onSelect={(ymd) => {
                    const next = nextDateRange(draft.deliveryFrom, draft.deliveryTo, ymd);
                    onChange({
                      ...draft,
                      deliveryFrom: next.start,
                      deliveryTo: next.end,
                      deliveryPreset: 'custom',
                    });
                  }}
                  monthCursor={rangeCursor}
                  onMonthChange={setRangeCursor}
                  disableUnavailable={false}
                  showAccentRail={false}
                  compact
                />
              </View>
            ) : null}
          </FilterSection>

          <FilterSection
            icon={SECTION_ICON.sort}
            title={t('mobile.orders.sortBy')}
            accent={draft.sortBy !== 'createdAt' ? colors.brand : undefined}
          >
            <View style={chipRow}>
              {SORT_OPTIONS.map((opt) => (
                <FloorChip
                  key={opt}
                  label={t(`mobile.orders.sort.${opt}`)}
                  active={draft.sortBy === opt}
                  onPress={() => {
                    void haptics.selection();
                    onChange({ ...draft, sortBy: opt });
                  }}
                />
              ))}
            </View>
          </FilterSection>

          <FilterSection
            icon={SECTION_ICON.direction}
            title={t('mobile.orders.sortDirection')}
            accent={draft.sortDir !== 'desc' ? colors.brand : undefined}
          >
            <View
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                gap: theme.spacing.sm,
              }}
            >
              <FloorChip
                label={t('mobile.orders.sortAsc')}
                active={draft.sortDir === 'asc'}
                stretch
                onPress={() => {
                  void haptics.selection();
                  onChange({ ...draft, sortDir: 'asc' });
                }}
              />
              <FloorChip
                label={t('mobile.orders.sortDesc')}
                active={draft.sortDir === 'desc'}
                stretch
                onPress={() => {
                  void haptics.selection();
                  onChange({ ...draft, sortDir: 'desc' });
                }}
              />
            </View>
          </FilterSection>
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
            label={t('mobile.orders.reset')}
            onPress={onReset}
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
                ? t('mobile.orders.applyWithCount', { n: String(activeCount) })
                : t('mobile.orders.apply')
            }
            haptic="light"
            onPress={onApply}
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
          ...(isRTL ? { paddingRight: theme.spacing.md + railPad } : { paddingLeft: theme.spacing.md + railPad }),
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
  stretch,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  stretch?: boolean;
}) {
  const { isRTL, locale } = useLocale();
  const { colors, theme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  return (
    <AnimatedPressable
      variant="button"
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
      style={{
        minWidth: stretch ? undefined : 96,
        flex: stretch ? 1 : undefined,
        maxWidth: stretch ? undefined : 168,
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

/** Searchable dealer list — keeps the filter sheet short with 50+ dealers. */
function DealerSearchPicker({
  dealers,
  selectedId,
  query,
  onQueryChange,
  onSelect,
}: {
  dealers: OrdersFilterDealerOption[];
  selectedId: string;
  query: string;
  onQueryChange: (q: string) => void;
  onSelect: (dealerId: string) => void;
}) {
  const { t, isRTL } = useLocale();
  const { colors, theme, colorScheme } = useTheme();

  const selected = dealers.find((d) => d.id === selectedId);
  const needle = query.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!needle) return dealers;
    return dealers.filter((d) => {
      const hay = (d.searchText || d.name).toLowerCase();
      return hay.includes(needle);
    });
  }, [dealers, needle]);

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
          {selectedId === 'all'
            ? t('mobile.orders.dealerRailAll')
            : (selected?.name ?? t('mobile.orders.dealerRailAll'))}
        </AppText>
        {selectedId !== 'all' ? (
          <AnimatedPressable
            variant="button"
            accessibilityRole="button"
            accessibilityLabel={t('mobile.orders.dealerRailAll')}
            onPress={() => onSelect('all')}
            style={{
              paddingHorizontal: theme.spacing.sm,
              minHeight: 32,
              justifyContent: 'center',
            }}
          >
            <AppText variant="caption" weight="semibold" color="brand">
              {t('mobile.orders.filterDealerClear')}
            </AppText>
          </AnimatedPressable>
        ) : null}
      </View>

      <TextField
        value={query}
        onChangeText={onQueryChange}
        placeholder={t('mobile.orders.filterDealerSearch')}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        clearButtonMode="while-editing"
      />

      <View
        style={{
          borderWidth: 1,
          borderColor: colors.borderStrong,
          borderRadius: theme.radius.xl,
          backgroundColor: colors.surface,
          overflow: 'hidden',
          maxHeight: 200,
          ...orderBoardShadow(colorScheme),
        }}
      >
        <ScrollView
          nestedScrollEnabled
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator
        >
          <DealerRow
            label={t('mobile.orders.dealerRailAll')}
            active={selectedId === 'all'}
            isRTL={isRTL}
            onPress={() => onSelect('all')}
          />
          {filtered.map((d) => (
            <DealerRow
              key={d.id}
              label={d.name}
              active={selectedId === d.id}
              isRTL={isRTL}
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
                {t('mobile.orders.filterDealerEmpty')}
              </AppText>
            </View>
          ) : null}
        </ScrollView>
      </View>
    </View>
  );
}

function DealerRow({
  label,
  active,
  isRTL,
  onPress,
}: {
  label: string;
  active: boolean;
  isRTL: boolean;
  onPress: () => void;
}) {
  const { colors, theme } = useTheme();
  return (
    <AnimatedPressable
      variant="button"
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
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
        weight={active ? 'semibold' : 'medium'}
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
}
