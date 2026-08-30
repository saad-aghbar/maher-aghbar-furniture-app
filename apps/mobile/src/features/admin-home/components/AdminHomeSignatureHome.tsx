import { type ReactNode, useMemo, useState } from 'react';
import { View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated from 'react-native-reanimated';
import { AppText } from '@/components/AppText';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import {
  AnimatedPressable,
  haptics,
  ListItemEnter,
  softFadeDown,
  useReducedMotion,
} from '@/motion';
import { useTheme } from '@/theme';
import { useHomeSectionVisibility, type HomeSectionId } from '../homeSectionVisibility';
import { AdminHomeSearchResults } from './AdminHomeSearchResults';
import { AdminHomeSearchRow } from './AdminHomeSearchRow';
import { HomeSectionFilterSheet } from './HomeSectionFilterSheet';
import { mapMgmtHref } from '../mapMgmtHref';
import type { ManagementSummaryPayload, MgmtAttentionCard, MgmtTile } from '../api';
import {
  ActivityBoard,
  ExceptionsBoard,
  FactoryFlowBoard,
  InventoryBoard,
  LateBoard,
  ManufacturingBoard,
  MaterialsBoard,
  MoneyBoard,
  OutboundBoard,
  ProductionBoard,
  QualityBoard,
  TodayBoard,
  WorkersBoard,
} from './home-boards';
import type { LabeledTile } from './home-boards/boardShared';

const ATTENTION_PREVIEW = 3;

type Props = {
  data: ManagementSummaryPayload;
  /** Notify parent so OpsInventory can hide while searching. */
  onSearchActiveChange?: (active: boolean) => void;
};

function tileLabelKey(key: string) {
  return `mobile.adminHome.mgmt.tiles.${key}`;
}

/** Drop zero-count tiles so metric walls stay short. COUNT=DATASET stays on the tile objects that remain. */
function preferActiveTiles(tiles: LabeledTile[]): LabeledTile[] {
  return tiles.filter((row) => row.tile.count > 0);
}

function sectionHasSignal(tiles: LabeledTile[]): boolean {
  return tiles.length > 0;
}

function SectionShell({
  titleKey,
  children,
  delay = 0,
  badge,
  accent = 'brand',
}: {
  titleKey: string;
  children: ReactNode;
  delay?: number;
  badge?: number;
  accent?: 'brand' | 'warning';
}) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const reduce = useReducedMotion();
  const Shell = reduce || delay > 100 ? View : Animated.View;
  const shellProps = reduce || delay > 100 ? {} : { entering: softFadeDown(delay) };
  const accentColor = accent === 'warning' ? colors.warning : colors.brand;

  return (
    <Shell {...shellProps} style={{ marginBottom: theme.spacing.lg }}>
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
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            gap: theme.spacing.sm,
            paddingHorizontal: theme.spacing.lg,
            paddingVertical: theme.spacing.md,
            backgroundColor: colors.surfaceSecondary,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          }}
        >
          <View
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: accentColor,
            }}
          />
          <AppText
            variant="caption"
            weight="semibold"
            style={{
              flex: 1,
              letterSpacing: locale === 'ar' ? 0 : 1.4,
              textTransform: locale === 'ar' ? 'none' : 'uppercase',
              color: accentColor,
            }}
          >
            {t(titleKey)}
          </AppText>
          {badge != null && badge > 0 ? (
            <View
              style={{
                minWidth: 28,
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderRadius: theme.radius.full,
                backgroundColor: colors.brandSoft,
                borderWidth: 1,
                borderColor: colors.border,
                alignItems: 'center',
              }}
            >
              <AppText variant="caption" weight="semibold" style={{ color: colors.brand }}>
                {badge > 99 ? '99+' : String(badge)}
              </AppText>
            </View>
          ) : null}
        </View>
        <View style={{ padding: theme.spacing.md, gap: theme.spacing.sm }}>{children}</View>
      </View>
    </Shell>
  );
}

function HealthyNote({ message }: { message: string }) {
  const { isRTL } = useLocale();
  const { colors, theme } = useTheme();
  return (
    <View
      style={{
        borderRadius: theme.radius.lg,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surfaceSecondary,
        padding: theme.spacing.md,
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        gap: theme.spacing.sm,
      }}
    >
      <Ionicons name="checkmark-circle-outline" size={18} color={colors.success} />
      <AppText variant="bodySecondary" color="secondary" style={{ flex: 1 }}>
        {message}
      </AppText>
    </View>
  );
}

function AttentionCard({ card, index }: { card: MgmtAttentionCard; index: number }) {
  const { isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const router = useRouter();
  const hot = card.priority === 'critical' || card.priority === 'high';
  const ink = colorScheme === 'dark' ? '#1C1816' : '#2A2420';
  const gold = hot ? '#E8C98A' : '#D4C4A8';
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  return (
    <ListItemEnter index={index}>
      <AnimatedPressable
        variant="card"
        accessibilityRole="button"
        accessibilityLabel={`${card.title}. ${card.why}. ${card.actionLabel}`}
        onPress={() => {
          void haptics.confirmLight();
          router.push(mapMgmtHref(card.href, card.filter));
        }}
        style={{
          borderRadius: theme.radius.xl,
          backgroundColor: ink,
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: hot ? 'rgba(232,201,138,0.35)' : 'rgba(212,196,168,0.22)',
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
            backgroundColor: gold,
            opacity: 0.85,
          }}
        />

        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            gap: theme.spacing.md,
            padding: theme.spacing.lg,
            ...(isRTL
              ? { paddingRight: theme.spacing.lg + 4 }
              : { paddingLeft: theme.spacing.lg + 4 }),
          }}
        >
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              backgroundColor: hot ? 'rgba(232,201,138,0.16)' : 'rgba(245,241,234,0.08)',
              borderWidth: 1,
              borderColor: hot ? 'rgba(232,201,138,0.28)' : 'rgba(245,241,234,0.12)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons
              name={hot ? 'alert-circle' : 'flash-outline'}
              size={22}
              color={gold}
            />
          </View>

          <View style={{ flex: 1, gap: 6, minWidth: 0 }}>
            <AppText
              variant="caption"
              weight="semibold"
              numberOfLines={1}
              style={{
                color: gold,
                letterSpacing: locale === 'ar' ? 0 : 1.2,
                textTransform: 'uppercase',
              }}
            >
              {card.title}
            </AppText>
            <AppText
              variant="body"
              weight={titleWeight}
              numberOfLines={3}
              style={{
                color: 'rgba(245,241,234,0.92)',
                writingDirection: isRTL ? 'rtl' : 'ltr',
              }}
            >
              {card.why}
            </AppText>

            <View
              style={{
                marginTop: theme.spacing.xs,
                alignSelf: isRTL ? 'flex-end' : 'flex-start',
                flexDirection: isRTL ? 'row-reverse' : 'row',
                alignItems: 'center',
                gap: 8,
                paddingHorizontal: theme.spacing.md,
                paddingVertical: 8,
                borderRadius: theme.radius.full,
                backgroundColor: 'rgba(245,241,234,0.1)',
                borderWidth: 1,
                borderColor: 'rgba(232,201,138,0.28)',
              }}
            >
              <AppText variant="label" weight="semibold" style={{ color: gold }}>
                {card.actionLabel}
              </AppText>
              <Ionicons
                name={isRTL ? 'arrow-back' : 'arrow-forward'}
                size={14}
                color="#F5F1EA"
              />
            </View>
          </View>
        </View>
      </AnimatedPressable>
    </ListItemEnter>
  );
}

/**
 * Piece 12 management desk — Attention → Today → Flow → Production → Outbound → Materials → Money → Activity.
 */
export function AdminHomeSignatureHome({ data, onSearchActiveChange }: Props) {
  const { t, formatCurrency, isRTL } = useLocale();
  const { colors, theme } = useTheme();
  const router = useRouter();
  const [showAllAttention, setShowAllAttention] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const { map, isVisible, setVisible, showAll } = useHomeSectionVisibility();

  const setSearchActive = (active: boolean) => {
    setSearching(active);
    onSearchActiveChange?.(active);
    if (!active) setSearchText('');
  };

  const show = (id: HomeSectionId) => isVisible(id);

  const attentionVisible = useMemo(() => {
    if (showAllAttention) return data.attention;
    return data.attention.slice(0, ATTENTION_PREVIEW);
  }, [data.attention, showAllAttention]);

  const todayTiles = useMemo(
    () =>
      preferActiveTiles(
        (
          [
            data.today.productionStarting,
            data.today.productionDue,
            data.today.qualityWaiting,
            data.today.finishedToday,
            data.today.leavingToday,
            data.today.receivingToday,
          ] as MgmtTile[]
        ).map((tile) => ({
          tile,
          label: t(tileLabelKey(tile.key)),
        })),
      ),
    [data.today, t],
  );

  const productionTiles = useMemo(
    () =>
      preferActiveTiles(
        (
          [
            data.production.activeOrders,
            data.production.tasksCompletedToday,
            data.production.dueToday,
            data.production.blocked,
          ] as MgmtTile[]
        ).map((tile) => ({
          tile,
          label: t(tileLabelKey(tile.key)),
        })),
      ),
    [data.production, t],
  );

  const outboundTiles = useMemo(
    () =>
      preferActiveTiles(
        (
          [
            data.outbound.finishedWaiting,
            data.outbound.leavingToday,
            data.outbound.overduePickup,
            data.outbound.shippedAwaitingDealer,
          ] as MgmtTile[]
        ).map((tile) => ({
          tile,
          label: t(tileLabelKey(tile.key)),
        })),
      ),
    [data.outbound, t],
  );

  const materialsTiles = useMemo(
    () =>
      preferActiveTiles(
        (
          [
            data.materials.needsPurchasing,
            data.materials.blockingProduction,
            data.materials.arrivingToday,
            data.materials.lateSupplierPos,
          ] as MgmtTile[]
        ).map((tile) => ({
          tile,
          label: t(tileLabelKey(tile.key)),
        })),
      ),
    [data.materials, t],
  );

  const inventoryTiles = useMemo(
    () =>
      preferActiveTiles(
        (
          [
            data.inventory.rawShortages,
            data.inventory.semiHandoff,
            data.inventory.finishedWaiting,
            data.inventory.correctionsAttention,
          ] as MgmtTile[]
        ).map((tile) => ({
          tile,
          label: t(tileLabelKey(tile.key)),
        })),
      ),
    [data.inventory, t],
  );

  const qualityTiles = useMemo(
    () =>
      preferActiveTiles(
        (
          [
            data.quality.waitingInspection,
            data.quality.failRework,
            data.quality.readyReinspection,
            data.quality.passedToday,
          ] as MgmtTile[]
        ).map((tile) => ({
          tile,
          label: t(tileLabelKey(tile.key)),
        })),
      ),
    [data.quality, t],
  );

  const exceptionsTiles = useMemo(
    () =>
      (
        [
          data.exceptions.returnsOpen,
          data.exceptions.waitingReturn,
          data.exceptions.waitingInspection,
          data.exceptions.cancelDisposition,
          data.exceptions.inventoryCorrections,
        ] as MgmtTile[]
      )
        .filter((tile) => tile.count > 0)
        .map((tile) => ({
          tile,
          label: t(tileLabelKey(tile.key)),
        })),
    [data.exceptions, t],
  );

  const finance = data.finance;
  const manufacturing = data.manufacturing;
  const workers = data.workers;
  const todayHasSignal = sectionHasSignal(todayTiles);
  const productionHasSignal =
    sectionHasSignal(productionTiles) ||
    data.blocked.length > 0 ||
    data.production.events.length > 0;
  const outboundHasSignal = sectionHasSignal(outboundTiles);
  const materialsHasSignal = sectionHasSignal(materialsTiles);
  const inventoryHasSignal = sectionHasSignal(inventoryTiles);
  const qualityHasSignal = sectionHasSignal(qualityTiles);
  const flowHasSignal = data.factoryFlow.some((p) => p.count > 0);
  const lateHasSignal = Boolean(data.late?.overdue && data.late.overdue.count > 0);
  const workersHasSignal = Boolean(
    workers &&
      (workers.workingToday > 0 ||
        workers.assigned > 0 ||
        workers.unassigned > 0 ||
        workers.conflicts > 0),
  );

  return (
    <View>
      <AdminHomeSearchRow
        searching={searching}
        value={searchText}
        onChangeText={setSearchText}
        onActivate={() => setSearchActive(true)}
        onCancel={() => setSearchActive(false)}
        onOpenFilter={() => setFilterOpen(true)}
      />

      <HomeSectionFilterSheet
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        map={map}
        onToggle={setVisible}
        onShowAll={showAll}
      />

      {searching ? (
        <AdminHomeSearchResults query={searchText} />
      ) : (
        <>
      {show('attention') ? (
      <SectionShell
        titleKey="mobile.adminHome.mgmt.attention"
        delay={40}
        badge={data.attention.length}
        accent={data.attention.length > 0 ? 'warning' : 'brand'}
      >
        {data.attention.length === 0 ? (
          <View
            style={{
              borderRadius: theme.radius.lg,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.surfaceSecondary,
              padding: theme.spacing.lg,
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'center',
              gap: theme.spacing.md,
            }}
          >
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 14,
                backgroundColor: colors.successSoft,
                borderWidth: 1,
                borderColor: colors.border,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="checkmark-circle" size={22} color={colors.success} />
            </View>
            <AppText variant="bodySecondary" color="secondary" style={{ flex: 1 }}>
              {t('mobile.adminHome.mgmt.attentionEmpty')}
            </AppText>
          </View>
        ) : (
          <View style={{ gap: theme.spacing.md }}>
            {attentionVisible.map((card, index) => (
              <AttentionCard key={card.id} card={card} index={index} />
            ))}
            {data.attention.length > ATTENTION_PREVIEW ? (
              <AnimatedPressable
                variant="button"
                accessibilityRole="button"
                onPress={() => {
                  void haptics.selection();
                  setShowAllAttention((v) => !v);
                }}
                style={{
                  borderRadius: theme.radius.full,
                  borderWidth: 1,
                  borderColor: colors.borderStrong,
                  backgroundColor: colors.surfaceSecondary,
                  paddingVertical: theme.spacing.md,
                  paddingHorizontal: theme.spacing.lg,
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                <AppText variant="label" weight="semibold" color="brand">
                  {showAllAttention
                    ? t('mobile.adminHome.mgmt.attentionShowLess')
                    : t('mobile.adminHome.mgmt.attentionViewAll', {
                        count: data.attention.length,
                      })}
                </AppText>
                <Ionicons
                  name={showAllAttention ? 'chevron-up' : 'chevron-down'}
                  size={16}
                  color={colors.brand}
                />
              </AnimatedPressable>
            ) : null}
          </View>
        )}
      </SectionShell>
      ) : null}

      {show('today') ? (
      <SectionShell titleKey="mobile.adminHome.mgmt.today" delay={80}>
        {todayHasSignal ? (
          <TodayBoard tiles={todayTiles} />
        ) : (
          <HealthyNote message={t('mobile.adminHome.mgmt.sectionHealthy')} />
        )}
      </SectionShell>
      ) : null}

      {show('factoryFlow') && flowHasSignal ? (
        <SectionShell titleKey="mobile.adminHome.mgmt.factoryFlow" delay={120}>
          <FactoryFlowBoard phases={data.factoryFlow.filter((phase) => phase.count > 0)} />
        </SectionShell>
      ) : null}

      {show('production') && productionHasSignal ? (
        <SectionShell titleKey="mobile.adminHome.mgmt.production" delay={160}>
          <ProductionBoard
            tiles={productionTiles}
            blocked={data.blocked}
            blockedCount={data.production.blocked.count}
            events={data.production.events}
            blockedTitle={t('mobile.adminHome.mgmt.productionBlocked')}
          />
        </SectionShell>
      ) : null}

      {show('outbound') && outboundHasSignal ? (
        <SectionShell titleKey="mobile.adminHome.mgmt.outbound" delay={200}>
          <OutboundBoard tiles={outboundTiles} />
        </SectionShell>
      ) : null}

      {show('materials') && materialsHasSignal ? (
        <SectionShell titleKey="mobile.adminHome.mgmt.materials" delay={240}>
          <MaterialsBoard tiles={materialsTiles} />
        </SectionShell>
      ) : null}

      {show('inventory') && inventoryHasSignal ? (
        <SectionShell titleKey="mobile.adminHome.mgmt.inventory" delay={250}>
          <InventoryBoard tiles={inventoryTiles} />
        </SectionShell>
      ) : null}

      {show('quality') && qualityHasSignal ? (
        <SectionShell titleKey="mobile.adminHome.mgmt.quality" delay={255}>
          <QualityBoard tiles={qualityTiles} />
        </SectionShell>
      ) : null}

      {show('exceptions') && exceptionsTiles.length > 0 ? (
        <SectionShell titleKey="mobile.adminHome.mgmt.exceptions" delay={260}>
          <ExceptionsBoard tiles={exceptionsTiles} />
        </SectionShell>
      ) : null}

      {show('workers') && workersHasSignal && workers ? (
        <SectionShell titleKey="mobile.adminHome.mgmt.workers" delay={265}>
          <WorkersBoard
            workers={workers}
            summary={t('mobile.adminHome.mgmt.workersSummary', {
              working: workers.workingToday,
              assigned: workers.assigned,
              unassigned: workers.unassigned,
              conflicts: workers.conflicts,
            })}
            labels={{
              working: t('mobile.adminHome.mgmt.workersWorking'),
              assigned: t('mobile.adminHome.mgmt.workersAssigned'),
              unassigned: t('mobile.adminHome.mgmt.workersUnassigned'),
              conflicts: t('mobile.adminHome.mgmt.workersConflicts'),
            }}
          />
        </SectionShell>
      ) : null}

      {show('late') && lateHasSignal && data.late?.overdue ? (
        <SectionShell titleKey="mobile.adminHome.mgmt.late" delay={270}>
          <LateBoard
            tile={{
              tile: data.late.overdue,
              label: t(tileLabelKey(data.late.overdue.key)),
            }}
            atRiskNote={
              data.late.atRiskLimited ? t('mobile.adminHome.mgmt.atRiskLimited') : undefined
            }
          />
        </SectionShell>
      ) : null}

      {show('money') && finance ? (
        <SectionShell titleKey="mobile.adminHome.mgmt.money" delay={280}>
          <MoneyBoard
            finance={finance}
            dueLabel={t('mobile.adminHome.mgmt.moneyDue')}
            overdueLabel={t('mobile.adminHome.mgmt.moneyOverdue')}
            creditLabel={t('mobile.adminHome.mgmt.moneyCredit')}
            invoicesLabel={t(tileLabelKey(finance.openInvoices.key))}
          />
        </SectionShell>
      ) : null}

      {show('manufacturing') && manufacturing ? (
        <SectionShell titleKey="mobile.adminHome.mgmt.manufacturing" delay={300}>
          <ManufacturingBoard
            manufacturing={manufacturing}
            finalOrdersLabel={t('mobile.adminHome.mgmt.mfgFinalOrders', {
              count: manufacturing.finalCostOrders,
              total: formatCurrency(manufacturing.finalCostTotal),
            })}
            incompleteLabel={
              manufacturing.incompleteCosting > 0
                ? t('mobile.adminHome.mgmt.mfgIncomplete', {
                    count: manufacturing.incompleteCosting,
                  })
                : undefined
            }
            grossDiffLabel={t('mobile.adminHome.mgmt.mfgGrossDiff')}
          />
        </SectionShell>
      ) : null}

      {show('activity') ? (
      <SectionShell titleKey="mobile.adminHome.mgmt.activity" delay={320}>
        {data.activity.length === 0 ? (
          <HealthyNote message={t('mobile.adminHome.mgmt.activityEmpty')} />
        ) : (
          <ActivityBoard events={data.activity.slice(0, 8)} />
        )}
      </SectionShell>
      ) : null}

      <AnimatedPressable
        variant="card"
        accessibilityRole="button"
        accessibilityLabel={t('mobile.adminHome.mgmt.reportsLink')}
        onPress={() => {
          void haptics.selection();
          router.push('/(app)/(admin)/reports' as Href);
        }}
        style={{
          marginBottom: theme.spacing.lg,
          borderRadius: theme.radius.xl,
          borderWidth: 1,
          borderColor: colors.borderStrong,
          backgroundColor: colors.surface,
          padding: theme.spacing.lg,
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          gap: theme.spacing.md,
          ...theme.elevation.raised,
        }}
      >
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 14,
            backgroundColor: colors.brandSoft,
            borderWidth: 1,
            borderColor: colors.brand,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="stats-chart-outline" size={22} color={colors.brand} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="label" weight="semibold">
            {t('mobile.adminHome.mgmt.reportsLink')}
          </AppText>
          <AppText variant="caption" color="secondary">
            {t('mobile.adminHome.mgmt.reportsHint')}
          </AppText>
        </View>
        <Ionicons
          name={isRTL ? 'chevron-back' : 'chevron-forward'}
          size={18}
          color={colors.textMuted}
        />
      </AnimatedPressable>
        </>
      )}
    </View>
  );
}
