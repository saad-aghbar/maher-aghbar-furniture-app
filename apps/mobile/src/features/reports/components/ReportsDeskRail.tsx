import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { AppText } from '@/components/AppText';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';
import type { CostDesk } from '../costFilters';
import { reportsDeskHref } from '../reportsDeskHrefs';

const ROWS: CostDesk[][] = [
  ['money', 'orders', 'products'],
  ['inventory', 'returns', 'coverage'],
];

const DESK_KEY: Record<CostDesk, string> = {
  money: 'mobile.reports.tabs.money',
  orders: 'mobile.reports.tabs.orders',
  products: 'mobile.reports.tabs.products',
  inventory: 'mobile.reports.tabs.inventory',
  returns: 'mobile.reports.tabs.returns',
  coverage: 'mobile.reports.tabs.coverage',
};

const DESK_ICON: Record<CostDesk, keyof typeof Ionicons.glyphMap> = {
  money: 'wallet-outline',
  orders: 'layers-outline',
  products: 'cube-outline',
  inventory: 'file-tray-outline',
  returns: 'return-down-back-outline',
  coverage: 'shield-checkmark-outline',
};

type Props = {
  active: CostDesk;
};

/**
 * Cost & Performance desks — two-row 3+3 cells. Active = brandSoft + 3px bottom bar.
 */
export function ReportsDeskRail({ active }: Props) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const router = useRouter();
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
          paddingVertical: theme.spacing.sm,
          paddingHorizontal: theme.spacing.md,
          gap: theme.spacing.sm,
          ...(isRTL ? { paddingRight: theme.spacing.md + 4 } : { paddingLeft: theme.spacing.md + 4 }),
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
            {row.map((desk) => {
              const selected = desk === active;
              const label = t(DESK_KEY[desk]);
              return (
                <AnimatedPressable
                  key={desk}
                  variant="button"
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={label}
                  testID={`cost-desk-${desk}`}
                  onPress={() => {
                    if (desk === active) return;
                    void haptics.selection();
                    router.push(reportsDeskHref(desk));
                  }}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    minHeight: 48,
                    borderRadius: theme.radius.lg,
                    borderWidth: 1,
                    borderColor: selected ? colors.brand : colors.borderStrong,
                    backgroundColor: selected ? colors.brandSoft : colors.surfaceSecondary,
                    paddingVertical: theme.spacing.sm,
                    paddingHorizontal: 4,
                    overflow: 'hidden',
                    alignItems: 'center',
                    gap: 4,
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
                      width: 26,
                      height: 26,
                      borderRadius: 13,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: colors.surface,
                      borderWidth: 1,
                      borderColor: selected ? colors.brand : colors.border,
                    }}
                  >
                    <Ionicons
                      name={DESK_ICON[desk]}
                      size={13}
                      color={selected ? colors.brand : colors.textSecondary}
                    />
                  </View>
                  <AppText
                    variant="caption"
                    weight={titleWeight}
                    numberOfLines={1}
                    align="center"
                    style={{
                      fontSize: 10,
                      lineHeight: 12,
                      letterSpacing: locale === 'ar' ? 0 : 0.4,
                      textTransform: locale === 'ar' ? 'none' : 'uppercase',
                      color: selected ? colors.brand : colors.textSecondary,
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
