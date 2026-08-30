import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import type { WipKitCard } from '@/api/modules/inventory';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';
import { InventorySemiOrderCard } from './InventorySemiOrderCard';

type Props = {
  title: string;
  kits: WipKitCard[];
  first?: boolean;
  onPressKit: (kit: WipKitCard) => void;
};

/**
 * One elevated stage board — header + kit escorts share a single shell
 * so Assembly and its kits read as one piece, not floating scraps.
 */
export function InventorySemiStageGroup({
  title,
  kits,
  first,
  onPressKit,
}: Props) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  return (
    <View
      style={{
        marginTop: first ? theme.spacing.xs : theme.spacing.lg,
        marginBottom: theme.spacing.md,
        borderRadius: theme.radius.xl,
        borderWidth: 1,
        borderColor: colors.borderStrong,
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
          backgroundColor: colors.brand,
          opacity: 0.9,
        }}
      />

      {/* Stage header band */}
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: theme.spacing.sm,
          minHeight: theme.sizes.touch.min,
          paddingVertical: theme.spacing.sm + 4,
          paddingHorizontal: theme.spacing.md,
          ...(isRTL
            ? { paddingRight: theme.spacing.md + 4 }
            : { paddingLeft: theme.spacing.md + 4 }),
          backgroundColor: colors.brandSoft,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            gap: theme.spacing.sm,
            flex: 1,
            minWidth: 0,
          }}
        >
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors.surface,
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: colors.borderStrong,
              ...theme.elevation.rest,
            }}
          >
            <Ionicons name="construct-outline" size={17} color={colors.brand} />
          </View>
          <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
            <AppText
              variant="caption"
              color="muted"
              numberOfLines={1}
              style={{
                textTransform: locale === 'ar' ? 'none' : 'uppercase',
                letterSpacing: locale === 'ar' ? 0 : 0.55,
                fontSize: 10,
                lineHeight: 13,
                textAlign: isRTL ? 'right' : 'left',
              }}
            >
              {t('mobile.inventory.semiStageButtonEyebrow')}
            </AppText>
            <AppText
              variant="label"
              weight={titleWeight}
              numberOfLines={1}
              style={{
                color: colors.brand,
                textAlign: isRTL ? 'right' : 'left',
              }}
            >
              {title}
            </AppText>
          </View>
        </View>

        <View
          style={{
            minWidth: 36,
            height: 30,
            paddingHorizontal: 10,
            borderRadius: 15,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.brand,
            alignItems: 'center',
            justifyContent: 'center',
            ...theme.elevation.rest,
          }}
        >
          <AppText
            variant="caption"
            weight="semibold"
            dir="ltr"
            style={{ color: colors.brand, fontVariant: ['tabular-nums'] }}
          >
            {t('mobile.inventory.semiOrderKitCount', {
              count: String(kits.length),
            })}
          </AppText>
        </View>
      </View>

      {/* Nested kit escorts */}
      <View
        style={{
          backgroundColor: colors.surfaceSecondary,
          padding: theme.spacing.sm,
          gap: theme.spacing.sm,
        }}
      >
        {kits.map((kit, index) => (
          <InventorySemiOrderCard
            key={kit.id}
            kit={kit}
            index={index}
            animateEnter={false}
            showOrderNumber={false}
            compact
            embedded
            onPress={() => onPressKit(kit)}
          />
        ))}
      </View>
    </View>
  );
}
