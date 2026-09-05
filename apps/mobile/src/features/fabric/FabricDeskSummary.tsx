import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';
import { resolveFabricTone } from './fabricToneVisuals';
import {
  FABRIC_DESK_BUCKETS,
  fabricDeskBucketLabelKey,
  type FabricDeskBucket,
  type FabricDeskBucketCount,
} from './selectFabricTracker';

const BUCKET_ICON: Record<FabricDeskBucket, keyof typeof Ionicons.glyphMap> = {
  needs_ordering: 'cart-outline',
  waiting_supplier: 'hourglass-outline',
  ready_for_pickup: 'cube-outline',
  in_holding: 'file-tray-outline',
  attention: 'alert-circle-outline',
};

const ROWS: FabricDeskBucket[][] = [
  ['needs_ordering', 'waiting_supplier', 'ready_for_pickup'],
  ['in_holding', 'attention'],
];

type Props = {
  counts: FabricDeskBucketCount[];
  active: FabricDeskBucket | null;
  onSelect: (bucket: FabricDeskBucket | null) => void;
};

/**
 * Compact fabric desk summary — two-row period cells, not a sideways pill rail.
 * Tap a cell to keep ORDER grouping and show only matching fabrics.
 */
export function FabricDeskSummary({ counts, active, onSelect }: Props) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const byBucket = new Map(counts.map((c) => [c.bucket, c]));

  return (
    <View
      style={{
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
          width: 3,
          backgroundColor: colors.brand,
          opacity: 0.55,
          ...(isRTL ? { right: 0 } : { left: 0 }),
        }}
      />
      <View
        style={{
          paddingHorizontal: theme.spacing.md,
          paddingVertical: theme.spacing.sm + 2,
          ...(isRTL
            ? { paddingRight: theme.spacing.md + 4 }
            : { paddingLeft: theme.spacing.md + 4 }),
          backgroundColor: colors.surfaceSecondary,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <AppText
          variant="caption"
          weight={titleWeight}
          style={{
            color: colors.brand,
            letterSpacing: locale === 'ar' ? 0 : 0.5,
            textTransform: locale === 'ar' ? 'none' : 'uppercase',
            textAlign: isRTL ? 'right' : 'left',
          }}
        >
          {t('mobile.inventory.fabricDeskSummary')}
        </AppText>
      </View>
      <View
        style={{
          gap: theme.spacing.sm,
          padding: theme.spacing.sm + 2,
          ...(isRTL
            ? { paddingRight: theme.spacing.sm + 6 }
            : { paddingLeft: theme.spacing.sm + 6 }),
        }}
      >
        {ROWS.map((row) => (
          <View
            key={row.join('-')}
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              gap: theme.spacing.sm,
            }}
          >
            {row.map((bucket) => {
              const selected = active === bucket;
              const count = byBucket.get(bucket)?.count ?? 0;
              const tone = resolveFabricTone(
                byBucket.get(bucket)?.tone ?? 'neutral',
                colors,
              );
              const label = t(fabricDeskBucketLabelKey(bucket));
              return (
                <AnimatedPressable
                  key={bucket}
                  variant="button"
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`${label} ${count}`}
                  onPress={() => {
                    void haptics.selection();
                    onSelect(selected ? null : bucket);
                  }}
                  style={{
                    flex: 1,
                    minHeight: 56,
                    borderRadius: theme.radius.lg,
                    backgroundColor: selected ? colors.brandSoft : colors.surfaceSecondary,
                    borderWidth: 1,
                    borderColor: selected ? colors.brand : colors.border,
                    paddingHorizontal: theme.spacing.sm,
                    paddingVertical: theme.spacing.sm,
                    justifyContent: 'center',
                    gap: 4,
                    overflow: 'hidden',
                  }}
                >
                  {selected ? (
                    <View
                      pointerEvents="none"
                      style={{
                        position: 'absolute',
                        left: 0,
                        right: 0,
                        bottom: 0,
                        height: 3,
                        backgroundColor: colors.brand,
                      }}
                    />
                  ) : null}
                  <View
                    style={{
                      flexDirection: isRTL ? 'row-reverse' : 'row',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <Ionicons
                      name={BUCKET_ICON[bucket]}
                      size={14}
                      color={selected ? colors.brand : tone.chipInk}
                    />
                    <AppText
                      variant="caption"
                      weight={titleWeight}
                      dir="ltr"
                      style={{ color: selected ? colors.brand : colors.textPrimary }}
                    >
                      {String(count)}
                    </AppText>
                  </View>
                  <AppText
                    variant="caption"
                    numberOfLines={2}
                    style={{
                      fontSize: 10,
                      color: selected ? colors.brand : colors.textMuted,
                      textAlign: isRTL ? 'right' : 'left',
                    }}
                  >
                    {label}
                  </AppText>
                </AnimatedPressable>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}

export { FABRIC_DESK_BUCKETS };
