import { useMemo, useState } from 'react';
import { FlatList, RefreshControl, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useRouter, type Href } from 'expo-router';
import { can } from '@maher/permissions';
import { listQuotations, openQuotationPdf } from '@/api/modules/quotations';
import { queryKeys } from '@/api/queryKeys';
import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { ErrorState } from '@/components/feedback/ErrorState';
import { OfflineBanner } from '@/components/feedback/OfflineBanner';
import { useToast } from '@/components/feedback/Toast';
import { AppScreen } from '@/components/layout/AppScreen';
import { ScreenBackLead } from '@/components/layout/ScreenBackLead';
import { useNetwork } from '@/components/network/NetworkProvider';
import {
  StatementDateSheet,
  StatementDateTrigger,
} from '@/features/account/components/StatementDateSheet';
import {
  datePresetRange,
  type StatementDatePreset,
  type StatementPdfRange,
} from '@/features/account/selectStatement';
import { DealerEmptyState, DealerSearchBar } from '@/features/dealer-ui';
import { usePdfDownload } from '@/features/pdf/usePdfDownload';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { formatNumber } from '@/i18n/format';
import { AnimatedPressable, ListItemEnter, haptics } from '@/motion';
import { SURFACE_TAB_BAR_CLEARANCE } from '@/navigation/tabBarClearance';
import { useTheme } from '@/theme';
import { QuotationBoardCard } from './components/QuotationBoardCard';
import { QuotationDeskRail } from './components/QuotationDeskRail';
import {
  filterDealerQuotations,
  selectDealerQuoteHub,
  type DealerQuoteDesk,
} from './dealerQuotationUi';

type Props = {
  detailHref: (id: string) => Href;
  backFallback: Href;
};

function QuotationsScreenTitle({
  titleWeight,
  backFallback,
}: {
  titleWeight: 'medium' | 'semibold';
  backFallback: Href;
}) {
  const { t, isRTL } = useLocale();
  const { theme } = useTheme();
  const leadSize = theme.sizes.touch.min;

  return (
    <View style={{ minHeight: leadSize, justifyContent: 'center' }}>
      <View
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          ...(isRTL ? { right: 0 } : { left: 0 }),
          zIndex: 1,
          justifyContent: 'center',
        }}
      >
        <ScreenBackLead fallback={backFallback} />
      </View>
      <AppText
        variant="largeTitle"
        weight={titleWeight}
        align="center"
        numberOfLines={1}
        style={{ paddingHorizontal: leadSize + theme.spacing.sm }}
      >
        {t('mobile.dealerQuotations.title')}
      </AppText>
    </View>
  );
}

/**
 * Dealer quotations desk — hub, desk rail, date range, and folio cards.
 */
export function DealerQuotationsListScreen({ detailHref, backFallback }: Props) {
  const { user } = useAuth();
  const { t, isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const router = useRouter();
  const { showOfflineBanner } = useNetwork();
  const { showToast } = useToast();
  const { pickPdfOptions, pdfDownloadSheet } = usePdfDownload();
  const allowed = can(user, 'quotation.read');
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  const [search, setSearch] = useState('');
  const [desk, setDesk] = useState<DealerQuoteDesk>('all');
  const [datePreset, setDatePreset] = useState<StatementDatePreset>('all');
  const [customRange, setCustomRange] = useState<StatementPdfRange>({});
  const [dateSheetOpen, setDateSheetOpen] = useState(false);

  const dateRange = useMemo(
    () => datePresetRange(datePreset, new Date(), customRange),
    [datePreset, customRange],
  );

  const query = useQuery({
    queryKey: queryKeys.quotations.list({ dealer: true }),
    queryFn: () => listQuotations({ pageSize: 100 }),
    enabled: allowed,
  });

  const allRows = query.data?.data ?? [];
  const datedRows = useMemo(
    () =>
      filterDealerQuotations(allRows, {
        dateFrom: dateRange.dateFrom,
        dateTo: dateRange.dateTo,
      }),
    [allRows, dateRange.dateFrom, dateRange.dateTo],
  );
  const hub = useMemo(() => selectDealerQuoteHub(datedRows), [datedRows]);
  const rows = useMemo(
    () =>
      filterDealerQuotations(allRows, {
        desk,
        q: search,
        dateFrom: dateRange.dateFrom,
        dateTo: dateRange.dateTo,
      }),
    [allRows, desk, search, dateRange.dateFrom, dateRange.dateTo],
  );

  const filtersActive =
    desk !== 'all' || datePreset !== 'all' || search.trim().length > 0;
  const awaitingLabel = `${formatNumber(locale, hub.actionValue, { maximumFractionDigits: 2 })} ₪`;

  const onPdf = (id: string) => {
    void (async () => {
      const opts = await pickPdfOptions();
      if (!opts) return;
      try {
        await openQuotationPdf(id, opts);
      } catch {
        showToast({
          variant: 'error',
          message: t('mobile.adminQuotation.pdfFailed'),
        });
      }
    })();
  };

  if (!allowed) {
    return (
      <AppScreen>
        <QuotationsScreenTitle titleWeight={titleWeight} backFallback={backFallback} />
        <DealerEmptyState
          title={t('mobile.noModules')}
          body={t('mobile.noModulesHint')}
        />
      </AppScreen>
    );
  }

  return (
    <AppScreen>
      {showOfflineBanner ? <OfflineBanner /> : null}
      <FlatList
        data={rows}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          gap: theme.spacing.md,
          flexGrow: 1,
          paddingBottom: theme.spacing['3xl'] + SURFACE_TAB_BAR_CLEARANCE,
        }}
        refreshControl={
          <RefreshControl
            refreshing={query.isRefetching}
            onRefresh={() => void query.refetch()}
            tintColor={colors.brand}
          />
        }
        ListHeaderComponent={
          <View style={{ gap: theme.spacing.md, marginBottom: theme.spacing.sm }}>
            <QuotationsScreenTitle titleWeight={titleWeight} backFallback={backFallback} />

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
                  paddingHorizontal: theme.spacing.lg,
                  paddingVertical: theme.spacing.md,
                  ...(isRTL
                    ? { paddingRight: theme.spacing.lg + 4 }
                    : { paddingLeft: theme.spacing.lg + 4 }),
                  borderBottomWidth: 1,
                  borderBottomColor: colors.border,
                  backgroundColor: colors.surfaceSecondary,
                }}
              >
                <AppText
                  variant="caption"
                  weight="semibold"
                  style={{ color: colors.brand }}
                  numberOfLines={1}
                >
                  {t('mobile.dealerQuotations.eyebrow')}
                </AppText>
              </View>
              <View
                style={{
                  padding: theme.spacing.lg,
                  gap: theme.spacing.md,
                  ...(isRTL
                    ? { paddingRight: theme.spacing.lg + 4 }
                    : { paddingLeft: theme.spacing.lg + 4 }),
                }}
              >
                <View
                  style={{
                    flexDirection: isRTL ? 'row-reverse' : 'row',
                    gap: theme.spacing.md,
                  }}
                >
                  <HubStamp
                    label={t('mobile.dealerQuotations.hubToReview')}
                    value={String(hub.toReview)}
                    warning={hub.toReview > 0}
                    selected={desk === 'action'}
                    onPress={() => {
                      void haptics.selection();
                      setDesk(desk === 'action' ? 'all' : 'action');
                    }}
                  />
                  <HubStamp
                    label={t('mobile.dealerQuotations.hubAwaiting')}
                    value={awaitingLabel}
                    money
                    warning={hub.toReview > 0}
                    selected={desk === 'action'}
                    onPress={() => {
                      void haptics.selection();
                      setDesk(desk === 'action' ? 'all' : 'action');
                    }}
                  />
                </View>
                <AppText
                  variant="caption"
                  color="muted"
                  style={{ textAlign: isRTL ? 'right' : 'left' }}
                >
                  {t('mobile.dealerQuotations.hubCaption', {
                    accepted: String(hub.accepted),
                    closed: String(hub.closed),
                  })}
                </AppText>
                <AppText
                  variant="caption"
                  color="muted"
                  style={{ textAlign: isRTL ? 'right' : 'left' }}
                >
                  {t('mobile.dealerQuotations.hubHint')}
                </AppText>
              </View>
            </View>

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
                  padding: theme.spacing.md,
                  gap: theme.spacing.md,
                  ...(isRTL
                    ? { paddingRight: theme.spacing.md + 4 }
                    : { paddingLeft: theme.spacing.md + 4 }),
                }}
              >
                <DealerSearchBar
                  value={search}
                  onChangeText={setSearch}
                  placeholder={t('mobile.dealerQuotations.searchPlaceholder')}
                />
                <QuotationDeskRail value={desk} onChange={setDesk} />
                <StatementDateTrigger
                  value={datePreset}
                  customFrom={customRange.from}
                  customTo={customRange.to}
                  onPress={() => setDateSheetOpen(true)}
                />
              </View>
            </View>

            <View
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                alignItems: 'baseline',
                justifyContent: 'space-between',
                gap: theme.spacing.sm,
              }}
            >
              <AppText variant="label" weight={titleWeight}>
                {t('mobile.dealerQuotations.openQuotes')}
              </AppText>
              <AppText variant="caption" color="muted">
                {t('mobile.dealerQuotations.count', { count: String(rows.length) })}
              </AppText>
            </View>
          </View>
        }
        ListEmptyComponent={
          query.isError ? (
            <ErrorState
              title={t('mobile.adminQuotation.errorTitle')}
              description={t('mobile.adminQuotation.errorBody')}
              retryLabel={t('mobile.adminQuotation.retry')}
              onRetry={() => void query.refetch()}
            />
          ) : query.isLoading ? (
            <AppText variant="caption" color="muted">
              {t('mobile.adminQuotation.loading')}
            </AppText>
          ) : filtersActive ? (
            <DealerEmptyState
              title={t('mobile.dealerQuotations.emptyFilter')}
              body={t('mobile.dealerQuotations.emptyFilterHint')}
            />
          ) : (
            <DealerEmptyState
              title={t('mobile.dealerQuotations.empty')}
              body={t('mobile.dealerQuotations.emptyHint')}
            />
          )
        }
        renderItem={({ item, index }) => (
          <ListItemEnter index={index}>
            <QuotationBoardCard
              quotation={item}
              onPress={() => router.push(detailHref(item.id))}
              onPdf={() => onPdf(item.id)}
            />
          </ListItemEnter>
        )}
      />

      <StatementDateSheet
        open={dateSheetOpen}
        onClose={() => setDateSheetOpen(false)}
        value={datePreset}
        customFrom={customRange.from}
        customTo={customRange.to}
        onChange={(next, range) => {
          setDatePreset(next);
          setCustomRange(next === 'custom' ? (range ?? {}) : {});
        }}
      />
      {pdfDownloadSheet}
    </AppScreen>
  );
}

function HubStamp({
  label,
  value,
  money,
  warning,
  selected,
  onPress,
}: {
  label: string;
  value: string;
  money?: boolean;
  warning?: boolean;
  selected?: boolean;
  onPress: () => void;
}) {
  const { locale } = useLocale();
  const { colors, theme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  return (
    <AnimatedPressable
      variant="button"
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={{
        flex: 1,
        minWidth: 0,
        gap: 6,
        padding: theme.spacing.md,
        borderRadius: theme.radius.lg,
        backgroundColor: warning ? colors.warningSoft : colors.surfaceSecondary,
        borderWidth: 1,
        borderColor: selected
          ? colors.brand
          : warning
            ? `${colors.warning}55`
            : colors.border,
        overflow: 'hidden',
      }}
    >
      {selected ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: 3,
            backgroundColor: colors.brand,
          }}
        />
      ) : null}
      <AppText
        variant="caption"
        color="muted"
        style={{
          textTransform: locale === 'ar' ? 'none' : 'uppercase',
          letterSpacing: locale === 'ar' ? 0 : 0.55,
          fontSize: 11,
          textAlign: 'center',
        }}
      >
        {label}
      </AppText>
      <AppText
        weight={titleWeight}
        dir="ltr"
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.7}
        style={{
          textAlign: 'center',
          fontVariant: ['tabular-nums'],
          fontSize: money ? 18 : 28,
          lineHeight: locale === 'ar' ? (money ? 28 : 40) : money ? 22 : 32,
          color: warning ? colors.warning : colors.textPrimary,
        }}
      >
        {value}
      </AppText>
    </AnimatedPressable>
  );
}
