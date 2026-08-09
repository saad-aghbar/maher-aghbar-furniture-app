import { View } from 'react-native';
import { AppText } from '@/components/AppText';
import { StatusBadge } from '@/components/badges/StatusBadge';
import { useLocale } from '@/i18n';
import { AnimatedPressable, ListItemEnter, haptics } from '@/motion';
import { useTheme } from '@/theme';
import type { StockCountCardModel } from '../selectInventoryOps';

type Props = {
  count: StockCountCardModel;
  index: number;
  onPress?: () => void;
  /** Skip stagger enter (section tab swaps). */
  animateEnter?: boolean;
};

/** Floor stock-count board. */
export function InventoryStockCountRow({
  count,
  index,
  onPress,
  animateEnter = true,
}: Props) {
  const { t, isRTL, formatDateTime, locale } = useLocale();
  const { colors, theme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  const statusLabel =
    count.status === 'POSTED'
      ? t('mobile.inventory.countStatus.POSTED')
      : undefined;

  const posted = count.status === 'POSTED';

  return (
    <ListItemEnter index={index} enabled={animateEnter}>
      <AnimatedPressable
        variant="card"
        accessibilityRole="button"
        accessibilityLabel={count.number}
        onPress={() => {
          void haptics.selection();
          onPress?.();
        }}
        style={{
          minHeight: theme.sizes.touch.min * 1.55,
          borderWidth: 1,
          borderColor: colors.borderStrong,
          borderRadius: theme.radius.xl,
          padding: theme.spacing.md,
          paddingLeft: isRTL ? theme.spacing.md : theme.spacing.md + 4,
          paddingRight: isRTL ? theme.spacing.md + 4 : theme.spacing.md,
          backgroundColor: colors.surface,
          gap: theme.spacing.sm,
          overflow: 'hidden',
          ...theme.elevation.card,
        }}
      >
        <View
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            ...(isRTL ? { right: 0 } : { left: 0 }),
            width: 3,
            backgroundColor: posted ? colors.success : colors.brand,
            opacity: 0.55,
          }}
        />
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: theme.spacing.sm,
          }}
        >
          <AppText variant="body" weight={titleWeight} style={{ flex: 1 }}>
            {count.number}
          </AppText>
          <StatusBadge status={count.status} label={statusLabel} dot />
        </View>

        <AppText variant="caption" color="secondary">
          {t('mobile.inventory.countWarehouse', {
            warehouse: `${count.warehouseCode} · ${count.warehouseName}`,
          })}
        </AppText>

        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            justifyContent: 'space-between',
            gap: theme.spacing.sm,
            flexWrap: 'wrap',
          }}
        >
          <AppText variant="caption" weight="medium">
            {t('mobile.inventory.countProgress', {
              counted: count.countedLineCount,
              total: count.lineCount,
            })}
          </AppText>
          <AppText variant="caption" color="muted">
            {formatDateTime(count.createdAt)}
          </AppText>
        </View>
      </AnimatedPressable>
    </ListItemEnter>
  );
}
