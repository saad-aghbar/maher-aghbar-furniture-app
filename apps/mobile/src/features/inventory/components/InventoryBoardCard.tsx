import type { ReactNode } from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { useLocale } from '@/i18n';
import { rowDirection } from '@/i18n/rtl';
import { useTheme } from '@/theme';

type InventoryBoardCardProps = {
  children: ReactNode;
  accent?: string;
  style?: object;
  padded?: boolean;
};

/** Elevated inventory board — production floor language. */
export function InventoryBoardCard({
  children,
  accent,
  style,
  padded = true,
}: InventoryBoardCardProps) {
  const { isRTL } = useLocale();
  const { colors, theme } = useTheme();

  return (
    <View
      style={[
        {
          borderRadius: theme.radius.xl,
          borderWidth: 1,
          borderColor: colors.borderStrong,
          backgroundColor: colors.surface,
          overflow: 'hidden',
          ...theme.elevation.card,
        },
        style,
      ]}
    >
      {accent ? (
        <View
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            ...(isRTL ? { right: 0 } : { left: 0 }),
            width: 3,
            backgroundColor: accent,
            opacity: 0.55,
          }}
        />
      ) : null}
      <View
        style={{
          padding: padded ? theme.spacing.md : 0,
          gap: padded ? theme.spacing.sm : 0,
          ...(isRTL
            ? { paddingRight: accent && padded ? theme.spacing.md + 4 : undefined }
            : { paddingLeft: accent && padded ? theme.spacing.md + 4 : undefined }),
        }}
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
          backgroundColor: colors.surfaceSecondary,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <Ionicons name={icon} size={16} color={accent ?? colors.brand} />
      </View>
      <AppText
        variant="caption"
        color="muted"
        style={{
          flex: 1,
          textTransform: locale === 'ar' ? 'none' : 'uppercase',
          letterSpacing: locale === 'ar' ? 0 : 0.6,
          fontSize: 11,
          lineHeight: 14,
          textAlign: isRTL ? 'right' : 'left',
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

/** On-hand / reserved / free strip — finished goods and reserved stock. */
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
        borderRadius: theme.radius.md,
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
      <AppText variant="heading" weight="semibold" dir="ltr" align="center" color={tone}>
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
