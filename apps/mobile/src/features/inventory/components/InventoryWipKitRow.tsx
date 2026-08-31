import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { StatusBadge } from '@/components/badges/StatusBadge';
import { useLocale } from '@/i18n';
import { AnimatedPressable, ListItemEnter, haptics } from '@/motion';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useTheme } from '@/theme';
import type { WipKitCard } from '@/api/modules/inventory';

type Props = {
  kit: WipKitCard;
  index: number;
  animateEnter?: boolean;
  onPress?: () => void;
};

function localizedProduct(kit: WipKitCard, locale: string): string {
  const p = kit.productionOrder.product;
  if (!p) return kit.productionOrder.productDescription;
  if (locale === 'ar') return p.nameAr || p.nameEn;
  if (locale === 'he') return p.nameHe || p.nameEn;
  return p.nameEn || p.nameAr;
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
        maxWidth: '100%',
        paddingHorizontal: theme.spacing.sm,
        paddingVertical: 4,
        borderRadius: theme.radius.md,
        backgroundColor: colors.surfaceSecondary,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <Ionicons name={icon} size={12} color={colors.textMuted} />
      <AppText variant="caption" color="secondary" numberOfLines={1} style={{ flexShrink: 1 }}>
        {label}
      </AppText>
    </View>
  );
}

/**
 * Floor card for one order×stage WIP kit — same visual language as lot rows.
 */
export function InventoryWipKitRow({ kit, index, animateEnter = true, onPress }: Props) {
  const { t, locale, isRTL } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const name = localizedProduct(kit, locale);
  const stage = kit.stageInstance.stageDefinition;
  const stageName =
    locale === 'ar'
      ? stage.nameAr || stage.nameEn
      : locale === 'he' && stage.nameHe
        ? stage.nameHe
        : stage.nameEn;
  const bin = kit.location?.name?.trim() || kit.location?.code || null;
  const chevron = isRTL ? 'chevron-back' : 'chevron-forward';
  const accent =
    kit.status === 'CLAIMED'
      ? colors.warning
      : kit.status === 'READY'
        ? colors.success
        : colors.textMuted;

  return (
    <ListItemEnter index={index} enabled={animateEnter}>
      <AnimatedPressable
        variant="card"
        accessibilityRole="button"
        accessibilityLabel={`${kit.productionOrder.number} ${name}`}
        onPress={() => {
          void haptics.selection();
          onPress?.();
        }}
        style={{
          minHeight: theme.sizes.touch.min * 1.4,
          borderWidth: 1,
          borderColor: colors.borderStrong,
          borderRadius: theme.radius.xl,
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
            backgroundColor: accent,
            opacity: kit.status === 'READY' || kit.status === 'CLAIMED' ? 0.9 : 0.45,
          }}
        />

        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: theme.spacing.sm,
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
          <StatusBadge status={kit.status} dot />
          <AppText variant="caption" color="brand" weight={titleWeight}>
            {t('mobile.inventory.wipTapForQr')}
          </AppText>
        </View>

        <View
          style={{
            padding: theme.spacing.lg,
            gap: theme.spacing.sm,
            ...(isRTL
              ? { paddingRight: theme.spacing.lg + 4 }
              : { paddingLeft: theme.spacing.lg + 4 }),
          }}
        >
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'flex-start',
            gap: theme.spacing.sm,
          }}
        >
          <View style={{ flex: 1, gap: 4 }}>
            <AppText variant="body" weight={titleWeight} style={{ flex: 1 }} numberOfLines={2}>
              {name}
            </AppText>
            <AppText variant="caption" color="muted" numberOfLines={1} dir="ltr">
              {kit.qrCode}
            </AppText>
          </View>
          <Ionicons name={chevron} size={16} color={colors.textMuted} style={{ marginTop: 4 }} />
        </View>

        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            flexWrap: 'wrap',
            gap: theme.spacing.xs,
            alignItems: 'center',
          }}
        >
          <MetaChip icon="document-text-outline" label={kit.productionOrder.number} />
          <MetaChip icon="construct-outline" label={stageName} />
          {bin ? <MetaChip icon="location-outline" label={bin} /> : null}
          <MetaChip
            icon="layers-outline"
            label={`${kit.pieces.length}/${kit.expectedPieceCount}`}
          />
        </View>
        </View>
      </AnimatedPressable>
    </ListItemEnter>
  );
}
