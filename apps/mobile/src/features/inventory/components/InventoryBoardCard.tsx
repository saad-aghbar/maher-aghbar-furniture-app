import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { rowDirection } from '@/i18n/rtl';
import { useTheme } from '@/theme';

type InventoryBoardCardProps = {
  children: ReactNode;
  title?: string;
  titleWeight?: 'medium' | 'semibold';
  trailing?: ReactNode;
  accent?: string;
  hideAccent?: boolean;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  padded?: boolean;
};

/** Parchment inventory board — rail, optional header band, same lift as production. */
export function InventoryBoardCard({
  children,
  title,
  titleWeight,
  trailing,
  accent,
  hideAccent = false,
  style,
  contentStyle,
  padded = true,
}: InventoryBoardCardProps) {
  const { isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const rail = accent ?? colors.brand;
  const railOpacity = accent && accent !== colors.brand ? 0.9 : 0.55;
  const weight = titleWeight ?? (locale === 'ar' ? 'medium' : 'semibold');
  const showRail = !hideAccent;

  return (
    <View
      style={[
        {
          borderRadius: theme.radius.xl,
          borderWidth: 1,
          borderColor: colors.borderStrong,
          backgroundColor: colors.surface,
          overflow: 'hidden',
          ...orderBoardShadow(colorScheme),
        },
        style,
      ]}
    >
      {showRail ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            ...(isRTL ? { right: 0 } : { left: 0 }),
            width: 3,
            backgroundColor: rail,
            opacity: railOpacity,
          }}
        />
      ) : null}
      {title || trailing ? (
        <View
          style={{
            paddingVertical: theme.spacing.md,
            paddingHorizontal: theme.spacing.lg,
            ...(isRTL
              ? { paddingRight: theme.spacing.lg + (showRail ? 4 : 0) }
              : { paddingLeft: theme.spacing.lg + (showRail ? 4 : 0) }),
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: theme.spacing.sm,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
            backgroundColor: colors.surfaceSecondary,
          }}
        >
          {title ? (
            <AppText
              variant="label"
              weight={weight}
              numberOfLines={1}
              style={{ flex: 1, textAlign: isRTL ? 'right' : 'left', fontSize: 15 }}
            >
              {title}
            </AppText>
          ) : (
            <View style={{ flex: 1 }} />
          )}
          {trailing}
        </View>
      ) : null}
      <View
        style={[
          {
            padding: padded ? theme.spacing.lg : 0,
            gap: padded ? theme.spacing.md : 0,
            ...(isRTL
              ? { paddingRight: showRail && padded ? theme.spacing.lg + 4 : undefined }
              : { paddingLeft: showRail && padded ? theme.spacing.lg + 4 : undefined }),
          },
          contentStyle,
        ]}
      >
        {children}
      </View>
    </View>
  );
}

type InventorySectionHeaderProps = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  accent?: string;
  trailing?: ReactNode;
};

export function InventorySectionHeader({
  icon,
  label,
  accent,
  trailing,
}: InventorySectionHeaderProps) {
  const { isRTL, locale } = useLocale();
  const { colors, theme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  return (
    <View
      style={{
        flexDirection: rowDirection(isRTL),
        alignItems: 'center',
        gap: theme.spacing.sm,
      }}
    >
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 16,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.brandSoft,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <Ionicons name={icon} size={16} color={accent ?? colors.brand} />
      </View>
      <AppText
        variant="caption"
        weight={titleWeight}
        style={{
          flex: 1,
          textTransform: locale === 'ar' ? 'none' : 'uppercase',
          letterSpacing: locale === 'ar' ? 0 : 0.5,
          fontSize: 11,
          lineHeight: 14,
          textAlign: isRTL ? 'right' : 'left',
          color: colors.brand,
        }}
      >
        {label}
      </AppText>
      {trailing}
    </View>
  );
}

type InventoryQtyStripProps = {
  onHand: number;
  reserved: number;
  available: number;
  emphasizeAvailable?: boolean;
  warning?: boolean;
};

/** On-hand / reserved / free strip — inset ledger. */
export function InventoryQtyStrip({
  onHand,
  reserved,
  available,
  emphasizeAvailable,
  warning,
}: InventoryQtyStripProps) {
  const { t, isRTL } = useLocale();
  const { colors, theme } = useTheme();

  return (
    <View
      style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'stretch',
        borderRadius: theme.radius.lg,
        backgroundColor: colors.surfaceSecondary,
        borderWidth: 1,
        borderColor: colors.border,
        paddingVertical: theme.spacing.sm,
        paddingHorizontal: theme.spacing.xs,
      }}
    >
      <QtyCell label={t('inventory.onHand')} value={onHand} />
      <View
        style={{
          width: 1,
          alignSelf: 'stretch',
          backgroundColor: colors.border,
          marginVertical: 4,
        }}
      />
      <QtyCell label={t('inventory.reserved')} value={reserved} />
      <View
        style={{
          width: 1,
          alignSelf: 'stretch',
          backgroundColor: colors.border,
          marginVertical: 4,
        }}
      />
      <QtyCell
        label={t('inventory.available')}
        value={available}
        emphasize={emphasizeAvailable && available > 0 && !warning}
        warning={warning && available > 0}
      />
    </View>
  );
}

function QtyCell({
  label,
  value,
  emphasize,
  warning,
}: {
  label: string;
  value: number;
  emphasize?: boolean;
  warning?: boolean;
}) {
  const { theme } = useTheme();
  const { locale } = useLocale();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const tone = warning ? 'warning' : emphasize ? 'brand' : value === 0 ? 'muted' : 'primary';

  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        gap: 2,
        paddingVertical: theme.spacing.xs,
        paddingHorizontal: theme.spacing.xs,
      }}
    >
      <AppText variant="heading" weight={titleWeight} dir="ltr" align="center" color={tone}>
        {value}
      </AppText>
      <AppText
        variant="caption"
        color={tone === 'primary' ? 'muted' : tone}
        align="center"
        numberOfLines={2}
      >
        {label}
      </AppText>
    </View>
  );
}
