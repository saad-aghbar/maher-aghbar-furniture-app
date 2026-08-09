import { View } from 'react-native';
import { AppText } from '@/components/AppText';
import { StatusBadge } from '@/components/badges/StatusBadge';
import { useLocale } from '@/i18n';
import { AnimatedPressable, ListItemEnter, haptics } from '@/motion';
import { useTheme } from '@/theme';
import type { TransferCardModel } from '../selectInventoryOps';

type Props = {
  transfer: TransferCardModel;
  index: number;
  onPress?: () => void;
  /** Skip stagger enter (section tab swaps). */
  animateEnter?: boolean;
};

/** Floor transfer board. */
export function InventoryTransferRow({
  transfer,
  index,
  onPress,
  animateEnter = true,
}: Props) {
  const { t, isRTL, formatDateTime, locale } = useLocale();
  const { colors, theme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  return (
    <ListItemEnter index={index} enabled={animateEnter}>
      <AnimatedPressable
        variant="card"
        accessibilityRole="button"
        accessibilityLabel={transfer.number}
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
            backgroundColor: colors.info,
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
            {transfer.number}
          </AppText>
          <StatusBadge status={transfer.status} dot />
        </View>

        <AppText variant="caption" color="secondary">
          {t('mobile.inventory.transferRoute', {
            from: `${transfer.fromCode} · ${transfer.fromName}`,
            to: `${transfer.toCode} · ${transfer.toName}`,
          })}
        </AppText>

        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            justifyContent: 'space-between',
            gap: theme.spacing.sm,
          }}
        >
          <AppText variant="caption" weight="medium">
            {t('mobile.inventory.lineCount', { count: transfer.lineCount })}
          </AppText>
          <AppText variant="caption" color="muted">
            {formatDateTime(transfer.createdAt)}
          </AppText>
        </View>

        {transfer.notes ? (
          <AppText variant="caption" color="secondary" numberOfLines={2}>
            {transfer.notes}
          </AppText>
        ) : null}
      </AnimatedPressable>
    </ListItemEnter>
  );
}
