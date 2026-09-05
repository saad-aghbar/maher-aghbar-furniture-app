import { Image, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';
import { resolveFabricStatusLabel } from './fabricCopy';
import { resolveFabricTone } from './fabricToneVisuals';
import {
  fabricStatusKind,
  fabricToneForKind,
  formatFabricQty,
  type FabricStatusSurface,
  type FabricTrackerRow,
} from './selectFabricTracker';

type Props = {
  row: FabricTrackerRow;
  /** Show the sales order number — only when the row is not already under an order. */
  showOrder?: boolean;
  /** Inset child of an order board — no nested card chrome. */
  embedded?: boolean;
  /** Hint that the whole row opens more. */
  disclose?: boolean;
  /** Purchasing shows the supplier on the child row. */
  showSupplier?: boolean;
  surface?: FabricStatusSurface;
};

/**
 * One order-linked fabric line — swatch, fabric + placement, quantity,
 * holding location, human status. The parent owns the press target.
 */
export function FabricRowBody({
  row,
  showOrder = false,
  embedded = false,
  disclose = false,
  showSupplier = false,
  surface = 'ops',
}: Props) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const kind = fabricStatusKind(row);
  const tone = resolveFabricTone(fabricToneForKind(kind), colors);
  const statusLabel = resolveFabricStatusLabel(t, row, surface);
  const qty = formatFabricQty(row, { requiredOnly: surface === 'worker' });
  const chevron = isRTL ? 'chevron-back' : 'chevron-forward';

  return (
    <View
      style={
        embedded
          ? {
              paddingVertical: theme.spacing.sm,
              gap: theme.spacing.xs,
            }
          : {
              borderRadius: theme.radius.lg,
              backgroundColor: colors.surfaceSecondary,
              overflow: 'hidden',
            }
      }
    >
      {!embedded ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            width: 3,
            backgroundColor: tone.rail,
            ...(isRTL ? { right: 0 } : { left: 0 }),
          }}
        />
      ) : null}
      <View
        style={{
          padding: embedded ? 0 : theme.spacing.md,
          ...(embedded
            ? {}
            : isRTL
              ? { paddingRight: theme.spacing.md + 4 }
              : { paddingLeft: theme.spacing.md + 4 }),
          gap: theme.spacing.sm,
        }}
      >
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            gap: theme.spacing.sm,
          }}
        >
          <FabricSwatch imageUrl={row.imageUrl} />
          <View style={{ flex: 1, gap: 2 }}>
            <AppText
              weight={titleWeight}
              numberOfLines={2}
              style={{ textAlign: isRTL ? 'right' : 'left' }}
            >
              {row.label}
            </AppText>
            {row.role ? (
              <AppText
                variant="caption"
                color="secondary"
                numberOfLines={1}
                style={{ textAlign: isRTL ? 'right' : 'left' }}
              >
                {row.role}
              </AppText>
            ) : null}
          </View>
          <AppText variant="caption" weight={titleWeight} style={{ color: tone.chipInk }}>
            {statusLabel}
          </AppText>
          {disclose ? (
            <Ionicons name={chevron} size={16} color={colors.textMuted} />
          ) : null}
        </View>

        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: theme.spacing.sm,
          }}
        >
          {showOrder && row.orderNumber ? (
            <AppText variant="caption" weight={titleWeight} dir="ltr">
              {row.orderNumber}
            </AppText>
          ) : null}
          <AppText variant="caption" color="muted" dir="ltr">
            {qty}
          </AppText>
          {row.locationLabel ? (
            <AppText variant="caption" color="muted">
              {row.locationLabel}
            </AppText>
          ) : null}
          {showSupplier && row.supplierName ? (
            <AppText variant="caption" color="muted" numberOfLines={1}>
              {row.supplierName}
            </AppText>
          ) : null}
        </View>

        {row.overridden ? (
          <AppText variant="caption" style={{ color: colors.warning }}>
            {t('mobile.purchasing.fabricOverriddenNote')}
          </AppText>
        ) : null}
      </View>
    </View>
  );
}

export function FabricSwatch({ imageUrl, size = 40 }: { imageUrl: string | null; size?: number }) {
  const { colors, theme } = useTheme();
  if (imageUrl) {
    return (
      <Image
        source={{ uri: imageUrl }}
        style={{
          width: size,
          height: size,
          borderRadius: theme.radius.md,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
        }}
      />
    );
  }
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: theme.radius.md,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.brandSoft,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Ionicons name="color-palette-outline" size={Math.round(size * 0.45)} color={colors.brand} />
    </View>
  );
}
