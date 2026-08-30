import { useMemo, useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { formatDate, formatPercent, useLocale } from '@/i18n';
import { AnimatedPressable, SkeletonShimmer, haptics } from '@/motion';
import { useTheme } from '@/theme';
import { todayYmd } from '@/components/calendar';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useSchedulingCapacityQuery } from '../query';
import {
  capacityStateLabelKey,
  selectAttentionCapacityCards,
  selectBottleneckStages,
  selectCapacityIsWorking,
  selectCapacityQueryParams,
  selectCapacityRowsForDay,
  selectFactoryCapacityCards,
  selectFactoryLoadPercent,
  selectWeekCapacityCells,
  sortCapacityCardsForDisplay,
  weekdayKeyFromSelectedYmd,
  type CapacityState,
  type CapacityViewMode,
  type FactoryCapacityCardModel,
} from '../selectFactoryCapacity';
import { FactoryCapacityCard } from './FactoryCapacityCard';
import { FactoryCapacityDetailSheet } from './FactoryCapacityDetailSheet';
import { FactoryCapacityWeekRow } from './FactoryCapacityWeekRow';

const CAPACITY_VISIBLE_ROWS = 3;
const CAPACITY_DAY_ROW = 116;
const CAPACITY_WEEK_ROW = 100;
const BOTTLENECK_VISIBLE_ROWS = 4;
const BOTTLENECK_ROW = 36;
const BOTTLENECK_GAP = 6;

type Props = {
  ymd: string;
  ordersCount: number;
  atRiskCount: number;
  conflictCount: number;
  onJumpToday?: () => void;
};

export function FactoryCapacitySection({
  ymd,
  ordersCount,
  atRiskCount,
  conflictCount,
  onJumpToday,
}: Props) {
  const { t, tPlural, locale, isRTL } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const today = todayYmd();
  const [mode, setMode] = useState<CapacityViewMode>('day');
  const [detail, setDetail] = useState<FactoryCapacityCardModel | null>(null);
  const [showAllStages, setShowAllStages] = useState(false);
  const [loadHelpOpen, setLoadHelpOpen] = useState(false);

  const params = useMemo(() => selectCapacityQueryParams(mode, ymd), [mode, ymd]);
  const query = useSchedulingCapacityQuery(params);

  const isWorking = selectCapacityIsWorking(query.data, ymd);
  const dayRows = selectCapacityRowsForDay(query.data, ymd);
  const dayCards = useMemo(
    () => selectFactoryCapacityCards(dayRows, locale, isWorking),
    [dayRows, isWorking, locale],
  );
  const weekCards = useMemo(
    () => selectFactoryCapacityCards(query.data?.data, locale, true),
    [locale, query.data],
  );
  const unsorted = mode === 'week' ? weekCards : dayCards;
  const sorted = useMemo(() => sortCapacityCardsForDisplay(unsorted), [unsorted]);
  const attention = useMemo(() => selectAttentionCapacityCards(unsorted), [unsorted]);
  const bottlenecks = useMemo(() => selectBottleneckStages(dayCards), [dayCards]);
  const cards = sorted;
  const load = selectFactoryLoadPercent(dayCards, isWorking);
  const canExpandStages = sorted.length > CAPACITY_VISIBLE_ROWS;

  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const isToday = ymd === today;
  const weekday = t(`mobile.calendar.weekdays.${weekdayKeyFromSelectedYmd(ymd)}`);

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
      <View
        pointerEvents="none"
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

      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: theme.spacing.sm,
          paddingHorizontal: theme.spacing.md,
          paddingVertical: theme.spacing.sm + 2,
          ...(isRTL
            ? { paddingRight: theme.spacing.md + 4 }
            : { paddingLeft: theme.spacing.md + 4 }),
          backgroundColor: colors.surfaceSecondary,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        }}
      >
        <View style={{ flex: 1, gap: 2, alignItems: isRTL ? 'flex-end' : 'flex-start' }}>
          <AppText
            variant="caption"
            weight={titleWeight}
            numberOfLines={1}
            style={{
              textTransform: locale === 'ar' ? 'none' : 'uppercase',
              letterSpacing: locale === 'ar' ? 0 : 0.7,
              fontSize: 11,
              color: colors.brand,
              textAlign: isRTL ? 'right' : 'left',
            }}
          >
            {t('mobile.adminScheduling.capacity.title')}
          </AppText>
          <AppText
            variant="caption"
            weight="semibold"
            numberOfLines={1}
            style={{ textAlign: isRTL ? 'right' : 'left' }}
          >
            {`${weekday} · ${formatDate(locale, ymd)}`}
          </AppText>
          <AppText variant="caption" color="muted" numberOfLines={1}>
            {t('mobile.adminScheduling.capacity.forSelectedDay')}
          </AppText>
        </View>
        <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 6 }}>
          {!isToday && onJumpToday ? (
            <AnimatedPressable
              variant="button"
              accessibilityRole="button"
              accessibilityLabel={t('mobile.adminScheduling.capacity.today')}
              onPress={() => {
                void haptics.selection();
                onJumpToday();
              }}
              style={{
                minHeight: 28,
                paddingHorizontal: 10,
                borderRadius: theme.radius.full,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: colors.brandSoft,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: colors.brand,
              }}
            >
              <AppText variant="caption" weight="semibold" style={{ color: colors.brand, fontSize: 11 }}>
                {t('mobile.adminScheduling.capacity.today')}
              </AppText>
            </AnimatedPressable>
          ) : null}
          {query.data ? (
            <View
              style={{
                minWidth: 28,
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderRadius: theme.radius.full,
                backgroundColor: colors.brandSoft,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: colors.brand,
                alignItems: 'center',
              }}
            >
              <AppText
                variant="caption"
                weight="semibold"
                dir="ltr"
                style={{ color: colors.brand, fontVariant: ['tabular-nums'], fontSize: 12 }}
              >
                {String(sorted.length)}
              </AppText>
            </View>
          ) : null}
        </View>
      </View>

      <View
        style={{
          gap: theme.spacing.sm,
          paddingHorizontal: theme.spacing.md,
          paddingVertical: theme.spacing.sm,
          ...(isRTL
            ? { paddingRight: theme.spacing.md + 4 }
            : { paddingLeft: theme.spacing.md + 4 }),
          backgroundColor: colors.surface,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        }}
      >
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            flexWrap: 'wrap',
            gap: theme.spacing.sm,
          }}
        >
          <Metric
            label={t('mobile.adminScheduling.dayDetail.factoryLoad')}
            value={
              load == null
                ? t('mobile.adminScheduling.capacity.state.closed')
                : formatPercent(locale, load)
            }
            ltr={load != null}
            a11y={
              load == null
                ? t('mobile.adminScheduling.capacity.a11yClosed', {
                    name: t('mobile.adminScheduling.dayDetail.factoryLoad'),
                  })
                : t('mobile.adminScheduling.dayDetail.a11yLoad', { percent: load })
            }
            onInfo={() => setLoadHelpOpen(true)}
            infoA11y={t('mobile.adminScheduling.capacity.loadHelpA11y')}
          />
          <Metric
            label={t('mobile.adminScheduling.dayDetail.ordersScheduled')}
            value={String(ordersCount)}
          />
          <Metric label={t('mobile.adminScheduling.dayDetail.atRisk')} value={String(atRiskCount)} />
          <Metric
            label={t('mobile.adminScheduling.dayDetail.conflicts')}
            value={String(conflictCount)}
          />
        </View>
        {bottlenecks.length > 0 ? (
          <BottleneckStrip cards={bottlenecks} onOpen={(card) => setDetail(card)} />
        ) : null}

        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            gap: 3,
            backgroundColor: colors.surfaceSecondary,
            borderRadius: theme.radius.full,
            padding: 3,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: colors.border,
          }}
        >
          {(['day', 'week'] as const).map((item) => {
            const active = mode === item;
            return (
              <AnimatedPressable
                key={item}
                variant="button"
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={t(`mobile.adminScheduling.capacity.${item}`)}
                onPress={() => {
                  void haptics.selection();
                  setMode(item);
                  setShowAllStages(false);
                }}
                style={{
                  flex: 1,
                  minHeight: 32,
                  borderRadius: theme.radius.full,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: active ? colors.surface : 'transparent',
                  borderWidth: active ? 1 : 0,
                  borderColor: active ? colors.brand : 'transparent',
                }}
              >
                <AppText
                  variant="caption"
                  weight="semibold"
                  style={{ color: active ? colors.brand : colors.textSecondary }}
                >
                  {t(`mobile.adminScheduling.capacity.${item}`)}
                </AppText>
              </AnimatedPressable>
            );
          })}
        </View>
      </View>

      <View
        style={{
          backgroundColor: colors.surfaceSecondary,
          padding: theme.spacing.sm,
          gap: theme.spacing.sm,
          ...(isRTL
            ? { paddingRight: theme.spacing.sm + 2 }
            : { paddingLeft: theme.spacing.sm + 2 }),
          opacity: query.isFetching && query.data ? 0.72 : 1,
        }}
      >
        <AppText
          variant="caption"
          weight={titleWeight}
          style={{
            textTransform: locale === 'ar' ? 'none' : 'uppercase',
            letterSpacing: locale === 'ar' ? 0 : 0.5,
            fontSize: 11,
            color: colors.textSecondary,
            textAlign: isRTL ? 'right' : 'left',
            ...(isRTL
              ? { paddingRight: theme.spacing.xs }
              : { paddingLeft: theme.spacing.xs }),
          }}
        >
          {showAllStages || attention.length === 0
            ? t('mobile.adminScheduling.dayDetail.capacityByStage')
            : t('mobile.adminScheduling.capacity.needsAttention')}
        </AppText>
        {query.isError && !query.data ? (
          <CapacityListWell>
            <View style={{ gap: theme.spacing.sm, padding: theme.spacing.md }}>
              <AppText variant="label" weight="semibold">
                {t('mobile.adminScheduling.capacity.loadErrorTitle')}
              </AppText>
              <AppText variant="caption" color="muted">
                {t('mobile.adminScheduling.capacity.loadErrorBody')}
              </AppText>
              <AnimatedPressable
                variant="button"
                accessibilityRole="button"
                accessibilityLabel={t('mobile.adminScheduling.capacity.retry')}
                onPress={() => {
                  void haptics.selection();
                  void query.refetch();
                }}
                style={{
                  alignSelf: isRTL ? 'flex-end' : 'flex-start',
                  minHeight: 36,
                  paddingHorizontal: theme.spacing.md,
                  borderRadius: theme.radius.full,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: colors.brandSoft,
                  borderWidth: 1,
                  borderColor: colors.brand,
                }}
              >
                <AppText variant="caption" weight="semibold" style={{ color: colors.brand }}>
                  {t('mobile.adminScheduling.capacity.retry')}
                </AppText>
              </AnimatedPressable>
            </View>
          </CapacityListWell>
        ) : query.isLoading && !query.data ? (
          <CapacityListWell>
            <View style={{ gap: theme.spacing.sm, padding: theme.spacing.sm }}>
              {[0, 1, 2].map((i) => (
                <SkeletonShimmer key={i} height={88} style={{ borderRadius: theme.radius.xl }} />
              ))}
            </View>
          </CapacityListWell>
        ) : unsorted.length === 0 ? (
          <CapacityListWell>
            <AppText variant="caption" color="muted" style={{ padding: theme.spacing.md }}>
              {isWorking
                ? t('mobile.adminScheduling.capacity.emptyScheduled')
                : t('mobile.adminScheduling.capacity.emptyClosed')}
            </AppText>
          </CapacityListWell>
        ) : (
          <CappedCapacityList
            itemCount={cards.length}
            rowEstimate={mode === 'week' ? CAPACITY_WEEK_ROW : CAPACITY_DAY_ROW}
            gap={theme.spacing.sm}
            expanded={showAllStages}
          >
            {mode === 'week'
              ? cards.map((card) => (
                  <FactoryCapacityWeekRow
                    key={card.stageDefinitionId}
                    card={card}
                    cells={selectWeekCapacityCells(query.data?.byDay, card.stageDefinitionId)}
                  />
                ))
              : cards.map((card) => (
                  <FactoryCapacityCard
                    key={card.stageDefinitionId}
                    card={card}
                    onPress={() => setDetail(card)}
                  />
                ))}
          </CappedCapacityList>
        )}
      </View>

      {canExpandStages ? (
        <AnimatedPressable
          variant="button"
          accessibilityRole="button"
          accessibilityLabel={
            showAllStages
              ? t('mobile.adminScheduling.capacity.showFewerStages')
              : tPlural('mobile.adminScheduling.capacity.viewAllStages', sorted.length)
          }
          onPress={() => {
            void haptics.selection();
            setShowAllStages((open) => !open);
          }}
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            paddingVertical: theme.spacing.sm,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: colors.border,
            backgroundColor: colors.surface,
          }}
        >
          <Ionicons
            name={showAllStages ? 'chevron-up' : 'chevron-down'}
            size={14}
            color={colors.textMuted}
          />
          <AppText variant="caption" color="muted" style={{ fontSize: 11 }}>
            {showAllStages
              ? t('mobile.adminScheduling.capacity.showFewerStages')
              : tPlural('mobile.adminScheduling.capacity.viewAllStages', sorted.length)}
          </AppText>
        </AnimatedPressable>
      ) : null}

      <FactoryCapacityDetailSheet open={Boolean(detail)} onClose={() => setDetail(null)} card={detail} />

      <BottomSheet
        open={loadHelpOpen}
        onClose={() => setLoadHelpOpen(false)}
        title={t('mobile.adminScheduling.capacity.loadHelpTitle')}
        fitContent
      >
        <AppText variant="body" color="secondary" style={{ textAlign: isRTL ? 'right' : 'left' }}>
          {t('mobile.adminScheduling.capacity.loadHelpBody')}
        </AppText>
      </BottomSheet>
    </View>
  );
}

function bottleneckTone(state: CapacityState, colors: {
  error: string;
  errorSoft: string;
  warning: string;
  warningSoft: string;
}) {
  if (state === 'full') {
    return { ink: colors.error, wash: colors.errorSoft };
  }
  return { ink: colors.warning, wash: colors.warningSoft };
}

function bottleneckIcon(state: CapacityState): keyof typeof Ionicons.glyphMap {
  if (state === 'noEligibleWorkers' || state === 'unavailable') return 'warning-outline';
  if (state === 'full') return 'alert-circle';
  return 'alert-circle-outline';
}

function BottleneckStrip({
  cards,
  onOpen,
}: {
  cards: FactoryCapacityCardModel[];
  onOpen: (card: FactoryCapacityCardModel) => void;
}) {
  const { t, tPlural, isRTL, locale } = useLocale();
  const { colors, theme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const worst = cards[0]?.state ?? 'nearCapacity';
  const accent = bottleneckTone(worst, colors);
  const names = cards
    .map((card) =>
      t('mobile.adminScheduling.capacity.bottleneckValue', {
        name: card.name,
        state: t(capacityStateLabelKey(card.state)),
      }),
    )
    .join(', ');
  const scrollable = cards.length > BOTTLENECK_VISIBLE_ROWS;
  const listHeight =
    BOTTLENECK_VISIBLE_ROWS * BOTTLENECK_ROW +
    Math.max(0, BOTTLENECK_VISIBLE_ROWS - 1) * BOTTLENECK_GAP;

  const rows = cards.map((card) => {
    const tone = bottleneckTone(card.state, colors);
    return (
      <AnimatedPressable
        key={card.stageDefinitionId}
        variant="button"
        accessibilityRole="button"
        accessibilityLabel={t('mobile.adminScheduling.capacity.a11yBottleneck', {
          name: card.name,
          state: t(capacityStateLabelKey(card.state)),
        })}
        onPress={() => {
          void haptics.selection();
          onOpen(card);
        }}
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          gap: 8,
          minHeight: BOTTLENECK_ROW,
          paddingHorizontal: 10,
          borderRadius: theme.radius.lg,
          backgroundColor: colors.surface,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
        }}
      >
        <Ionicons name={bottleneckIcon(card.state)} size={14} color={tone.ink} />
        <AppText
          variant="caption"
          weight="semibold"
          numberOfLines={1}
          style={{ flex: 1, textAlign: isRTL ? 'right' : 'left' }}
        >
          {card.name}
        </AppText>
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            paddingHorizontal: 8,
            paddingVertical: 3,
            borderRadius: theme.radius.full,
            backgroundColor: tone.wash,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: tone.ink,
            maxWidth: '48%',
          }}
        >
          <AppText
            variant="caption"
            weight="semibold"
            numberOfLines={1}
            style={{ color: tone.ink, fontSize: 10, lineHeight: 13 }}
          >
            {t(capacityStateLabelKey(card.state))}
          </AppText>
        </View>
      </AnimatedPressable>
    );
  });

  return (
    <View
      style={{
        borderRadius: theme.radius.lg,
        borderWidth: 1,
        borderColor: accent.ink,
        backgroundColor: accent.wash,
        overflow: 'hidden',
      }}
    >
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          ...(isRTL ? { right: 0 } : { left: 0 }),
          width: 3,
          backgroundColor: accent.ink,
        }}
      />
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          gap: 8,
          paddingHorizontal: theme.spacing.sm,
          paddingTop: theme.spacing.sm,
          paddingBottom: 6,
          ...(isRTL
            ? { paddingRight: theme.spacing.sm + 4 }
            : { paddingLeft: theme.spacing.sm + 4 }),
        }}
      >
        <View
          style={{
            width: 22,
            height: 22,
            borderRadius: theme.radius.full,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.surface,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: accent.ink,
          }}
        >
          <Ionicons name={bottleneckIcon(worst)} size={12} color={accent.ink} />
        </View>
        <AppText
          variant="caption"
          weight={titleWeight}
          accessibilityLabel={
            cards.length === 1
              ? t('mobile.adminScheduling.capacity.a11yBottleneck', {
                  name: cards[0]!.name,
                  state: t(capacityStateLabelKey(cards[0]!.state)),
                })
              : t('mobile.adminScheduling.capacity.a11yBottlenecks', { names })
          }
          style={{
            flex: 1,
            color: accent.ink,
            textTransform: locale === 'ar' ? 'none' : 'uppercase',
            letterSpacing: locale === 'ar' ? 0 : 0.5,
            fontSize: 11,
            textAlign: isRTL ? 'right' : 'left',
          }}
        >
          {tPlural('mobile.adminScheduling.capacity.bottleneckHeading', cards.length)}
        </AppText>
        <View
          style={{
            minWidth: 22,
            paddingHorizontal: 7,
            paddingVertical: 2,
            borderRadius: theme.radius.full,
            backgroundColor: colors.surface,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: accent.ink,
            alignItems: 'center',
          }}
        >
          <AppText
            variant="caption"
            weight="semibold"
            dir="ltr"
            style={{ color: accent.ink, fontVariant: ['tabular-nums'], fontSize: 11 }}
          >
            {String(cards.length)}
          </AppText>
        </View>
      </View>
      {scrollable ? (
        <ScrollView
          nestedScrollEnabled
          showsVerticalScrollIndicator
          keyboardShouldPersistTaps="handled"
          style={{
            height: listHeight,
            marginBottom: theme.spacing.sm,
            marginLeft: isRTL ? theme.spacing.sm : theme.spacing.sm + 4,
            marginRight: isRTL ? theme.spacing.sm + 4 : theme.spacing.sm,
          }}
          contentContainerStyle={{ gap: BOTTLENECK_GAP }}
        >
          {rows}
        </ScrollView>
      ) : (
        <View
          style={{
            gap: BOTTLENECK_GAP,
            paddingHorizontal: theme.spacing.sm,
            paddingBottom: theme.spacing.sm,
            ...(isRTL
              ? { paddingRight: theme.spacing.sm + 4 }
              : { paddingLeft: theme.spacing.sm + 4 }),
          }}
        >
          {rows}
        </View>
      )}
    </View>
  );
}

function Metric({
  label,
  value,
  a11y,
  onInfo,
  infoA11y,
  ltr = true,
}: {
  label: string;
  value: string;
  a11y?: string;
  onInfo?: () => void;
  infoA11y?: string;
  ltr?: boolean;
}) {
  const { isRTL } = useLocale();
  const { colors, theme } = useTheme();
  return (
    <View
      accessible={!onInfo}
      accessibilityLabel={a11y ?? `${label} ${value}`}
      style={{
        width: '48%',
        borderRadius: theme.radius.lg,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surfaceSecondary,
        padding: theme.spacing.sm,
        gap: 2,
        alignItems: isRTL ? 'flex-end' : 'flex-start',
      }}
    >
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          gap: 4,
          width: '100%',
        }}
      >
        <AppText variant="caption" color="muted" style={{ flex: 1 }}>
          {label}
        </AppText>
        {onInfo ? (
          <AnimatedPressable
            variant="button"
            accessibilityRole="button"
            accessibilityLabel={infoA11y ?? label}
            onPress={() => {
              void haptics.selection();
              onInfo();
            }}
            hitSlop={8}
          >
            <Ionicons name="information-circle-outline" size={16} color={colors.brand} />
          </AnimatedPressable>
        ) : null}
      </View>
      <AppText
        variant="label"
        weight="semibold"
        dir={ltr ? 'ltr' : 'auto'}
        face={ltr ? 'latin' : 'app'}
        numberOfLines={2}
      >
        {value}
      </AppText>
    </View>
  );
}

function CapacityListWell({
  children,
  height,
}: {
  children: ReactNode;
  height?: number;
}) {
  const { colors, theme } = useTheme();
  return (
    <View
      style={{
        height,
        overflow: 'hidden',
        borderRadius: theme.radius.lg,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: colors.border,
        backgroundColor: colors.surface,
      }}
    >
      {children}
    </View>
  );
}

function CappedCapacityList({
  itemCount,
  rowEstimate,
  gap,
  expanded,
  children,
}: {
  itemCount: number;
  rowEstimate: number;
  gap: number;
  expanded?: boolean;
  children: ReactNode;
}) {
  const { theme } = useTheme();
  const innerPad = theme.spacing.sm;
  if (expanded || itemCount <= CAPACITY_VISIBLE_ROWS) {
    return (
      <CapacityListWell>
        <View style={{ gap, padding: innerPad }}>{children}</View>
      </CapacityListWell>
    );
  }

  const capHeight =
    CAPACITY_VISIBLE_ROWS * rowEstimate +
    Math.max(0, CAPACITY_VISIBLE_ROWS - 1) * gap +
    innerPad * 2;

  return (
    <CapacityListWell height={capHeight}>
      <ScrollView
        nestedScrollEnabled
        showsVerticalScrollIndicator
        keyboardShouldPersistTaps="handled"
        style={{ flex: 1 }}
        contentContainerStyle={{ gap, padding: innerPad, paddingBottom: theme.spacing.md }}
      >
        {children}
      </ScrollView>
    </CapacityListWell>
  );
}
