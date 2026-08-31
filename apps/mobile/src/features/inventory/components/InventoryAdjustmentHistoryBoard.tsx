import { ActivityIndicator, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { StatusBadge } from '@/components/badges/StatusBadge';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';
import type { InventoryTransactionRow } from '../selectInventory';
import { InventoryBoardCard } from './InventoryBoardCard';

const PREVIEW_COUNT = 3;

type Props = {
  rows: InventoryTransactionRow[];
  loading?: boolean;
  loadingMore?: boolean;
  hasMore?: boolean;
  expanded: boolean;
  onToggle: () => void;
};

function txIcon(type: string): keyof typeof Ionicons.glyphMap {
  switch (type) {
    case 'PURCHASE_RECEIPT':
    case 'FINISHED_GOODS_RECEIPT':
      return 'download-outline';
    case 'PRODUCTION_ISSUE':
    case 'DELIVERY_ISSUE':
      return 'arrow-up-outline';
    case 'PRODUCTION_RETURN':
    case 'CUSTOMER_RETURN':
      return 'return-down-back-outline';
    case 'WAREHOUSE_TRANSFER':
      return 'swap-horizontal-outline';
    case 'SCRAP':
    case 'DAMAGE':
      return 'warning-outline';
    case 'INVENTORY_ADJUSTMENT':
      return 'options-outline';
    default:
      return 'cube-outline';
  }
}

/**
 * One history board — inset rows, footer expands to the full ledger.
 */
export function InventoryAdjustmentHistoryBoard({
  rows,
  loading,
  loadingMore,
  hasMore,
  expanded,
  onToggle,
}: Props) {
  const { t, locale, formatDateTime, isRTL } = useLocale();
  const { colors, theme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const canExpand = rows.length > PREVIEW_COUNT || Boolean(hasMore);
  const visible = expanded ? rows : rows.slice(0, PREVIEW_COUNT);

  return (
    <InventoryBoardCard
      title={t('mobile.inventory.adjustmentHistory')}
      padded={false}
      trailing={
        rows.length > 0 ? (
          <AppText variant="caption" color="muted" dir="ltr">
            {String(rows.length)}
            {hasMore ? '+' : ''}
          </AppText>
        ) : null
      }
    >
      {loading && rows.length === 0 ? (
        <View style={{ padding: theme.spacing.lg }}>
          <AppText variant="caption" color="secondary">
            {t('mobile.inventory.loadingHistory')}
          </AppText>
        </View>
      ) : rows.length === 0 ? (
        <View style={{ padding: theme.spacing.lg, gap: theme.spacing.xs }}>
          <AppText variant="body" weight={titleWeight}>
            {t('mobile.inventory.emptyHistoryTitle')}
          </AppText>
          <AppText variant="caption" color="muted">
            {t('mobile.inventory.emptyHistoryBody')}
          </AppText>
        </View>
      ) : (
        <View>
          {visible.map((item, index) => (
            <HistoryRow
              key={item.id}
              item={item}
              first={index === 0}
              formatDateTime={formatDateTime}
            />
          ))}
          {expanded && loadingMore ? (
            <View
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: theme.spacing.sm,
                paddingVertical: theme.spacing.md,
              }}
            >
              <ActivityIndicator size="small" color={colors.brand} />
              <AppText variant="caption" color="muted">
                {t('mobile.inventory.loadingMore')}
              </AppText>
            </View>
          ) : null}
          {canExpand ? (
            <AnimatedPressable
              variant="button"
              accessibilityRole="button"
              accessibilityLabel={
                expanded
                  ? t('mobile.inventory.historyShowLess')
                  : t('mobile.inventory.historyShowAllA11y')
              }
              onPress={() => {
                void haptics.selection();
                onToggle();
              }}
              style={{
                minHeight: 48,
                flexDirection: isRTL ? 'row-reverse' : 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                paddingHorizontal: theme.spacing.lg,
                borderTopWidth: 1,
                borderTopColor: colors.border,
                backgroundColor: colors.surfaceSecondary,
              }}
            >
              <Ionicons
                name={expanded ? 'chevron-up' : 'chevron-down'}
                size={16}
                color={colors.brand}
              />
              <AppText
                variant="caption"
                weight={titleWeight}
                color="brand"
              >
                {expanded
                  ? t('mobile.inventory.historyShowLess')
                  : t('mobile.inventory.historyShowAll', {
                      count: hasMore ? `${rows.length}+` : String(rows.length),
                    })}
              </AppText>
            </AnimatedPressable>
          ) : null}
        </View>
      )}
    </InventoryBoardCard>
  );
}

function HistoryRow({
  item,
  first,
  formatDateTime,
}: {
  item: InventoryTransactionRow;
  first: boolean;
  formatDateTime: (value: string) => string;
}) {
  const { t, locale, isRTL } = useLocale();
  const { colors, theme } = useTheme();
  const typeKey = `mobile.inventory.txType.${item.type}`;
  const typeLabel = t(typeKey);
  const resolvedType =
    typeLabel === typeKey ? t('mobile.inventory.txType.OTHER') : typeLabel;
  const qtyPositive = item.quantityLabel.trim().startsWith('+');
  const qtyNegative = item.quantityLabel.trim().startsWith('-');
  const accent = qtyNegative
    ? colors.warning
    : qtyPositive
      ? colors.success
      : colors.brand;
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  return (
    <View
      style={{
        gap: theme.spacing.sm,
        paddingVertical: theme.spacing.md,
        paddingHorizontal: theme.spacing.lg,
        ...(isRTL
          ? { paddingRight: theme.spacing.lg + 4 }
          : { paddingLeft: theme.spacing.lg + 4 }),
        borderTopWidth: first ? 0 : 1,
        borderTopColor: colors.border,
      }}
    >
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: theme.spacing.sm,
        }}
      >
        <StatusBadge
          status={qtyNegative ? 'OVERDUE' : qtyPositive ? 'READY' : 'ACTIVE'}
          label={resolvedType}
          dot
        />
        <AppText
          variant="caption"
          weight={titleWeight}
          color={qtyNegative ? 'warning' : qtyPositive ? 'success' : 'brand'}
          dir="ltr"
        >
          {item.quantityLabel}
        </AppText>
      </View>
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          gap: theme.spacing.sm,
          borderRadius: theme.radius.lg,
          backgroundColor: colors.surfaceSecondary,
          borderWidth: 1,
          borderColor: colors.border,
          padding: theme.spacing.sm,
        }}
      >
        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: 16,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: qtyNegative
              ? colors.warningSoft
              : qtyPositive
                ? colors.successSoft
                : colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Ionicons name={txIcon(item.type)} size={15} color={accent} />
        </View>
        <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
          <AppText variant="caption" color="muted" numberOfLines={1}>
            {item.warehouseName} · {formatDateTime(item.createdAt)}
          </AppText>
          {item.notes ? (
            <AppText variant="caption" color="secondary" numberOfLines={2}>
              {item.notes}
            </AppText>
          ) : null}
          {item.showCost && item.costLabel ? (
            <AppText variant="caption" color="secondary" dir="ltr">
              {t('mobile.inventory.cost', { value: item.costLabel })}
            </AppText>
          ) : null}
        </View>
      </View>
    </View>
  );
}
