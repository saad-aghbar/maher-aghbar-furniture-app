import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { Divider } from '@/components/layout/Divider';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';

export type DealerSummaryTabKey =
  | 'orders'
  | 'production'
  | 'completed'
  | 'soa'
  | 'payments'
  | 'invoices'
  | 'priceList';

type TabItem = {
  key: DealerSummaryTabKey;
  label: string;
  count?: number;
};

const ORDER_KEYS: DealerSummaryTabKey[] = ['orders', 'production', 'completed'];
const OTHER_KEYS: DealerSummaryTabKey[] = ['soa', 'payments', 'invoices', 'priceList'];

const TAB_ICONS: Record<DealerSummaryTabKey, keyof typeof Ionicons.glyphMap> = {
  orders: 'cube-outline',
  production: 'construct-outline',
  completed: 'checkmark-done-outline',
  soa: 'document-text-outline',
  payments: 'cash-outline',
  invoices: 'receipt-outline',
  priceList: 'pricetag-outline',
};

type Props = {
  tabs: TabItem[];
  value: DealerSummaryTabKey;
  onChange: (key: DealerSummaryTabKey) => void;
};

/**
 * Dealer summary switcher — order buckets on one row, money/docs on the next.
 */
export function DealerSummaryRail({ tabs, value, onChange }: Props) {
  const { isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  const byKey = new Map(tabs.map((t) => [t.key, t]));
  const orderTabs = ORDER_KEYS.map((k) => byKey.get(k)).filter(Boolean) as TabItem[];
  const otherTabs = OTHER_KEYS.map((k) => byKey.get(k)).filter(Boolean) as TabItem[];

  const select = (key: DealerSummaryTabKey) => {
    void haptics.selection();
    onChange(key);
  };

  return (
    <View
      style={{
        borderRadius: theme.radius.xl,
        borderWidth: 1,
        borderColor: colors.borderStrong,
        backgroundColor: colors.surfaceSecondary,
        overflow: 'hidden',
        ...orderBoardShadow(colorScheme),
      }}
    >
      {/* Order buckets */}
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          gap: theme.spacing.sm,
          padding: theme.spacing.sm + 2,
          paddingBottom: theme.spacing.sm,
        }}
      >
        {orderTabs.map((item) => {
          const active = value === item.key;
          return (
            <AnimatedPressable
              key={item.key}
              variant="button"
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${item.label}, ${item.count ?? 0}`}
              onPress={() => select(item.key)}
              style={{
                flex: 1,
                minWidth: 0,
                borderRadius: theme.radius.lg,
                borderWidth: 1,
                borderColor: active ? colors.brand : colors.borderStrong,
                backgroundColor: active ? colors.brandSoft : colors.surface,
                paddingVertical: theme.spacing.sm + 2,
                paddingHorizontal: theme.spacing.sm,
                overflow: 'hidden',
                ...orderBoardShadow(colorScheme),
              }}
            >
              {active ? (
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
                  gap: 4,
                  alignItems: isRTL ? 'flex-end' : 'flex-start',
                }}
              >
                <View
                  style={{
                    flexDirection: isRTL ? 'row-reverse' : 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    alignSelf: 'stretch',
                    gap: theme.spacing.xs,
                  }}
                >
                  <View
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: theme.radius.sm,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: active ? colors.surface : colors.brandSoft,
                      borderWidth: 1,
                      borderColor: active ? colors.brand : colors.border,
                    }}
                  >
                    <Ionicons
                      name={TAB_ICONS[item.key]}
                      size={13}
                      color={active ? colors.brand : colors.textSecondary}
                    />
                  </View>

                  <AppText
                    weight="semibold"
                    dir="ltr"
                    numberOfLines={1}
                    style={{
                      fontSize: 18,
                      lineHeight: 22,
                      letterSpacing: -0.4,
                      color: active ? colors.brand : colors.textPrimary,
                    }}
                  >
                    {String(item.count ?? 0)}
                  </AppText>
                </View>

                <AppText
                  variant="caption"
                  weight={titleWeight}
                  numberOfLines={2}
                  style={{
                    textAlign: isRTL ? 'right' : 'left',
                    fontSize: 10,
                    lineHeight: 12,
                    letterSpacing: locale === 'ar' ? 0 : 0.4,
                    textTransform: locale === 'ar' ? 'none' : 'uppercase',
                    color: active ? colors.brand : colors.textSecondary,
                  }}
                >
                  {item.label}
                </AppText>
              </View>
            </AnimatedPressable>
          );
        })}
      </View>

      <Divider compact />

      {/* Statement / money / prices */}
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          gap: theme.spacing.sm,
          padding: theme.spacing.md,
          paddingTop: theme.spacing.sm,
        }}
      >
        {otherTabs.map((item) => {
          const active = value === item.key;
          return (
            <AnimatedPressable
              key={item.key}
              variant="button"
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={item.label}
              onPress={() => select(item.key)}
              style={{
                flex: 1,
                minWidth: 0,
                minHeight: 76,
                borderRadius: theme.radius.lg,
                borderWidth: 1,
                borderColor: active ? colors.brand : colors.borderStrong,
                backgroundColor: active ? colors.brandSoft : colors.surface,
                paddingVertical: theme.spacing.sm + 2,
                paddingHorizontal: theme.spacing.xs + 2,
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                overflow: 'hidden',
                ...orderBoardShadow(colorScheme),
              }}
            >
              {active ? (
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
                  width: 28,
                  height: 28,
                  borderRadius: theme.radius.sm,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: active ? colors.surface : colors.brandSoft,
                  borderWidth: 1,
                  borderColor: active ? colors.brand : colors.border,
                }}
              >
                <Ionicons
                  name={TAB_ICONS[item.key]}
                  size={14}
                  color={active ? colors.brand : colors.textSecondary}
                />
              </View>

              <AppText
                variant="caption"
                weight={titleWeight}
                numberOfLines={2}
                style={{
                  textAlign: 'center',
                  fontSize: 9,
                  lineHeight: 12,
                  letterSpacing: locale === 'ar' ? 0 : 0.35,
                  textTransform: locale === 'ar' ? 'none' : 'uppercase',
                  color: active ? colors.brand : colors.textSecondary,
                }}
              >
                {item.label}
              </AppText>
            </AnimatedPressable>
          );
        })}
      </View>
    </View>
  );
}
