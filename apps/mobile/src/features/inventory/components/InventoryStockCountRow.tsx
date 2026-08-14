import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
  onPost?: () => void;
  posting?: boolean;
  /** Skip stagger enter (section tab swaps). */
  animateEnter?: boolean;
};

function MetaChip({
  icon,
  label,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
}) {
  const { colors, theme } = useTheme();
  const { isRTL } = useLocale();

  return (
    <View
      style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: theme.spacing.sm,
        paddingVertical: 5,
        borderRadius: theme.radius.md,
        backgroundColor: colors.surfaceSecondary,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <Ionicons name={icon} size={12} color={colors.textMuted} />
      <AppText variant="caption" color="secondary" numberOfLines={1}>
        {label}
      </AppText>
    </View>
  );
}

/** Floor stock-count board — warehouse well, progress, post band. */
export function InventoryStockCountRow({
  count,
  index,
  onPress,
  onPost,
  posting,
  animateEnter = true,
}: Props) {
  const { t, isRTL, formatDateTime, locale } = useLocale();
  const { colors, theme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const posted = count.status === 'POSTED';
  const accent = posted ? colors.success : colors.brand;
  const total = Math.max(count.lineCount, 0);
  const counted = Math.min(Math.max(count.countedLineCount, 0), total || count.countedLineCount);
  const progress = total > 0 ? Math.min(1, counted / total) : posted ? 1 : 0;
  const warehouseLabel = `${count.warehouseCode} · ${count.warehouseName}`;
  const statusLabel =
    count.status === 'POSTED' ? t('mobile.inventory.countStatus.POSTED') : undefined;

  const body = (
    <View style={{ gap: theme.spacing.sm }}>
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: theme.spacing.sm,
        }}
      >
        <AppText variant="body" weight={titleWeight} style={{ flex: 1 }} numberOfLines={1}>
          {count.number}
        </AppText>
        <StatusBadge status={count.status} label={statusLabel} dot />
      </View>

      <View
        style={{
          gap: 4,
          paddingHorizontal: theme.spacing.sm,
          paddingVertical: theme.spacing.sm,
          borderRadius: theme.radius.lg,
          backgroundColor: colors.surfaceSecondary,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <AppText
          variant="caption"
          color="muted"
          weight={locale === 'ar' ? 'regular' : 'medium'}
          style={{ textAlign: isRTL ? 'right' : 'left' }}
        >
          {t('mobile.inventory.warehouse')}
        </AppText>
        <AppText
          variant="caption"
          weight={locale === 'ar' ? 'medium' : 'semibold'}
          numberOfLines={1}
          style={{ textAlign: isRTL ? 'right' : 'left' }}
        >
          {count.warehouseCode}
        </AppText>
        <AppText
          variant="caption"
          color="secondary"
          numberOfLines={1}
          style={{ textAlign: isRTL ? 'right' : 'left' }}
        >
          {count.warehouseName}
        </AppText>
      </View>

      <View style={{ gap: 6 }}>
        <View
          style={{
            height: 6,
            flexDirection: isRTL ? 'row-reverse' : 'row',
            borderRadius: theme.radius.full,
            backgroundColor: colors.surfaceSecondary,
            borderWidth: 1,
            borderColor: colors.border,
            overflow: 'hidden',
          }}
        >
          <View
            style={{
              width: `${Math.round(progress * 100)}%`,
              height: '100%',
              backgroundColor: posted ? colors.success : colors.brand,
              opacity: 0.85,
            }}
          />
        </View>
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: theme.spacing.sm,
          }}
        >
          <MetaChip
            icon="checkbox-outline"
            label={t('mobile.inventory.countProgress', {
              counted,
              total,
            })}
          />
          <MetaChip icon="time-outline" label={formatDateTime(count.createdAt)} />
        </View>
      </View>
    </View>
  );

  return (
    <ListItemEnter index={index} enabled={animateEnter}>
      <View
        style={{
          borderRadius: theme.radius.xl,
          ...theme.elevation.card,
        }}
      >
        <View
          style={{
            borderWidth: 1,
            borderColor: colors.borderStrong,
            borderRadius: theme.radius.xl,
            backgroundColor: colors.surface,
            overflow: 'hidden',
          }}
        >
          <View
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              ...(isRTL ? { right: 0 } : { left: 0 }),
              width: 3,
              backgroundColor: accent,
              opacity: 0.85,
              zIndex: 1,
            }}
          />
          {onPress ? (
            <AnimatedPressable
              variant="card"
              accessibilityRole="button"
              accessibilityLabel={`${count.number}. ${warehouseLabel}`}
              onPress={() => {
                void haptics.selection();
                onPress();
              }}
              style={{
                padding: theme.spacing.md,
                paddingLeft: isRTL ? theme.spacing.md : theme.spacing.md + 4,
                paddingRight: isRTL ? theme.spacing.md + 4 : theme.spacing.md,
              }}
            >
              {body}
            </AnimatedPressable>
          ) : (
            <View
              style={{
                padding: theme.spacing.md,
                paddingLeft: isRTL ? theme.spacing.md : theme.spacing.md + 4,
                paddingRight: isRTL ? theme.spacing.md + 4 : theme.spacing.md,
              }}
            >
              {body}
            </View>
          )}

          {onPost ? (
            <View
              style={{
                marginHorizontal: theme.spacing.md,
                paddingBottom: theme.spacing.md,
                paddingTop: theme.spacing.sm,
                borderTopWidth: StyleSheet.hairlineWidth,
                borderTopColor: colors.border,
              }}
            >
              <AnimatedPressable
                variant="button"
                accessibilityRole="button"
                onPress={() => {
                  void haptics.confirmLight();
                  onPost();
                }}
                disabled={posting}
                style={{
                  minHeight: 40,
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  paddingHorizontal: theme.spacing.md,
                  borderRadius: theme.radius.xl,
                  backgroundColor: colors.brandSoft,
                  borderWidth: 1,
                  borderColor: colors.brand,
                  opacity: posting ? 0.7 : 1,
                }}
              >
                <Ionicons name="checkmark-circle" size={16} color={colors.brand} />
                <AppText variant="caption" weight="semibold" color="brand">
                  {posting ? t('mobile.inventory.postingCount') : t('mobile.inventory.postCount')}
                </AppText>
              </AnimatedPressable>
            </View>
          ) : null}
        </View>
      </View>
    </ListItemEnter>
  );
}
