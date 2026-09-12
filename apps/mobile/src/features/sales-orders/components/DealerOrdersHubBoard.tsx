import { View } from 'react-native';
import { AppText } from '@/components/AppText';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';
import type { DealerOrderStampCounts, DealerOrderTileKey } from '../selectDealerOrders';

type Props = {
  counts: DealerOrderStampCounts;
  selectedTile: DealerOrderTileKey | null;
  onSelectTile: (key: DealerOrderTileKey | null) => void;
};

const ROWS: DealerOrderTileKey[][] = [
  ['active', 'production'],
  ['ready', 'attention'],
];

const LABEL_KEY: Record<DealerOrderTileKey, string> = {
  active: 'mobile.orders.stampActive',
  production: 'mobile.orders.stampOnLine',
  ready: 'mobile.orders.stampReady',
  attention: 'mobile.orders.stampNeedsLook',
};

/** 2×2 commercial stamps — Active / On line / Out / Review. */
export function DealerOrdersHubBoard({ counts, selectedTile, onSelectTile }: Props) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

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
        <AppText
          variant="caption"
          weight="semibold"
          style={{ color: colors.brand }}
          numberOfLines={1}
        >
          {t('mobile.orders.deskEyebrow')}
        </AppText>
      </View>
      <View
        style={{
          padding: theme.spacing.lg,
          gap: theme.spacing.md,
          ...(isRTL
            ? { paddingRight: theme.spacing.lg + 4 }
            : { paddingLeft: theme.spacing.lg + 4 }),
        }}
      >
        {ROWS.map((row) => (
          <View
            key={row.join('-')}
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              gap: theme.spacing.md,
            }}
          >
            {row.map((key) => {
              const value = counts[key];
              const selected = selectedTile === key;
              const warning = key === 'attention' && value > 0;
              return (
                <AnimatedPressable
                  key={key}
                  variant="button"
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`${t(LABEL_KEY[key])}, ${value}`}
                  onPress={() => {
                    void haptics.selection();
                    onSelectTile(selected ? null : key);
                  }}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    gap: 6,
                    padding: theme.spacing.md,
                    borderRadius: theme.radius.lg,
                    backgroundColor: selected
                      ? colors.brandSoft
                      : warning
                        ? colors.warningSoft
                        : colors.surfaceSecondary,
                    borderWidth: 1,
                    borderColor: selected
                      ? colors.brand
                      : warning
                        ? `${colors.warning}55`
                        : colors.border,
                    overflow: 'hidden',
                  }}
                >
                  {selected ? (
                    <View
                      pointerEvents="none"
                      style={{
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        height: 3,
                        backgroundColor: colors.brand,
                      }}
                    />
                  ) : null}
                  <AppText
                    variant="caption"
                    color="muted"
                    numberOfLines={2}
                    style={{
                      textTransform: locale === 'ar' ? 'none' : 'uppercase',
                      letterSpacing: locale === 'ar' ? 0 : 0.55,
                      fontSize: 11,
                      textAlign: 'center',
                    }}
                  >
                    {t(LABEL_KEY[key])}
                  </AppText>
                  <AppText
                    weight={titleWeight}
                    dir="ltr"
                    numberOfLines={1}
                    style={{
                      textAlign: 'center',
                      fontVariant: ['tabular-nums'],
                      fontSize: 28,
                      lineHeight: locale === 'ar' ? 40 : 32,
                      color: warning ? colors.warning : colors.textPrimary,
                    }}
                  >
                    {String(value)}
                  </AppText>
                </AnimatedPressable>
              );
            })}
          </View>
        ))}
        <AppText
          variant="caption"
          color="muted"
          style={{ textAlign: isRTL ? 'right' : 'left' }}
        >
          {t('mobile.orders.deskHint')}
        </AppText>
      </View>
    </View>
  );
}
