import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
  onComplete?: () => void;
  completing?: boolean;
  /** Skip stagger enter (section tab swaps). */
  animateEnter?: boolean;
};

function transferAccent(
  status: string,
  colors: { info: string; success: string; textMuted: string; warning: string },
): string {
  const key = status.toUpperCase();
  if (key === 'COMPLETED') return colors.success;
  if (key === 'CANCELLED') return colors.textMuted;
  if (key === 'IN_TRANSIT') return colors.warning;
  return colors.info;
}

function WarehouseWell({
  code,
  name,
  label,
}: {
  code: string;
  name: string;
  label: string;
}) {
  const { colors, theme } = useTheme();
  const { isRTL, locale } = useLocale();

  return (
    <View
      style={{
        flex: 1,
        minWidth: 0,
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
        {label}
      </AppText>
      <AppText
        variant="caption"
        weight={locale === 'ar' ? 'medium' : 'semibold'}
        numberOfLines={1}
        style={{ textAlign: isRTL ? 'right' : 'left' }}
      >
        {code}
      </AppText>
      <AppText
        variant="caption"
        color="secondary"
        numberOfLines={1}
        style={{ textAlign: isRTL ? 'right' : 'left' }}
      >
        {name}
      </AppText>
    </View>
  );
}

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

/** Floor transfer board — from/to wells, meta chips, complete band. */
export function InventoryTransferRow({
  transfer,
  index,
  onPress,
  onComplete,
  completing,
  animateEnter = true,
}: Props) {
  const { t, isRTL, formatDateTime, locale } = useLocale();
  const { colors, theme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const accent = transferAccent(transfer.status, colors);
  const chevron = isRTL ? 'arrow-back' : 'arrow-forward';
  const routeLabel = t('mobile.inventory.transferRoute', {
    from: `${transfer.fromCode} · ${transfer.fromName}`,
    to: `${transfer.toCode} · ${transfer.toName}`,
  });

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
          {transfer.number}
        </AppText>
        <StatusBadge status={transfer.status} dot />
      </View>

      <View
        accessibilityLabel={routeLabel}
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          gap: theme.spacing.sm,
        }}
      >
        <WarehouseWell
          label={t('mobile.inventory.fromWarehouse')}
          code={transfer.fromCode}
          name={transfer.fromName}
        />
        <View
          style={{
            width: 28,
            height: 28,
            borderRadius: 14,
            backgroundColor: colors.brandSoft,
            borderWidth: 1,
            borderColor: colors.brand,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name={chevron} size={14} color={colors.brand} />
        </View>
        <WarehouseWell
          label={t('mobile.inventory.toWarehouse')}
          code={transfer.toCode}
          name={transfer.toName}
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
          icon="layers-outline"
          label={t('mobile.inventory.lineCount', { count: transfer.lineCount })}
        />
        <MetaChip icon="time-outline" label={formatDateTime(transfer.createdAt)} />
      </View>

      {transfer.notes ? (
        <AppText variant="caption" color="secondary" numberOfLines={2}>
          {transfer.notes}
        </AppText>
      ) : null}
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
              accessibilityLabel={`${transfer.number}. ${routeLabel}`}
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

          {onComplete ? (
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
                  onComplete();
                }}
                disabled={completing}
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
                  opacity: completing ? 0.7 : 1,
                }}
              >
                <Ionicons name="checkmark-circle" size={16} color={colors.brand} />
                <AppText variant="caption" weight="semibold" color="brand">
                  {completing
                    ? t('mobile.inventory.completingTransfer')
                    : t('mobile.inventory.completeTransfer')}
                </AppText>
              </AnimatedPressable>
            </View>
          ) : null}
        </View>
      </View>
    </ListItemEnter>
  );
}
