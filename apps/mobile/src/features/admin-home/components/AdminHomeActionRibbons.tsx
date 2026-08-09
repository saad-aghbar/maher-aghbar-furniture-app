import { View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInLeft, FadeInRight } from 'react-native-reanimated';
import { AppText } from '@/components/AppText';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics, useReducedMotion } from '@/motion';
import { useTheme } from '@/theme';

type Ribbon = {
  key: string;
  labelKey: string;
  hintKey: string;
  icon: keyof typeof Ionicons.glyphMap;
  href: Href;
  inset: 'start' | 'end';
};

const RIBBONS: Ribbon[] = [
  {
    key: 'orders',
    labelKey: 'mobile.adminHome.actionOrders',
    hintKey: 'mobile.adminHome.ribbonOrdersHint',
    icon: 'file-tray-full-outline',
    href: '/(app)/(admin)/(tabs)/orders',
    inset: 'start',
  },
  {
    key: 'production',
    labelKey: 'mobile.adminHome.actionProduction',
    hintKey: 'mobile.adminHome.ribbonProductionHint',
    icon: 'hammer-outline',
    href: '/(app)/(admin)/(tabs)/production',
    inset: 'end',
  },
  {
    key: 'inventory',
    labelKey: 'mobile.adminHome.actionInventory',
    hintKey: 'mobile.adminHome.ribbonInventoryHint',
    icon: 'layers-outline',
    href: '/(app)/(admin)/(tabs)/inventory',
    inset: 'start',
  },
  {
    key: 'invoices',
    labelKey: 'mobile.adminHome.actionInvoices',
    hintKey: 'mobile.adminHome.ribbonInvoicesHint',
    icon: 'wallet-outline',
    href: '/(app)/(admin)/invoices',
    inset: 'end',
  },
];

/** Zigzag benches — entrance motion only (no perpetual loops). */
export function AdminHomeActionRibbons() {
  const { t, isRTL } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const router = useRouter();
  const reduce = useReducedMotion();

  return (
    <View style={{ marginBottom: theme.spacing.xl, gap: theme.spacing.md }}>
      <AppText
        variant="caption"
        weight="semibold"
        style={{ letterSpacing: 1.6, textTransform: 'uppercase', color: colors.brand }}
      >
        {t('mobile.adminHome.modulesTitle')}
      </AppText>

      {RIBBONS.map((ribbon, index) => {
        const fromEnd = ribbon.inset === 'end';
        const Enter = fromEnd
          ? isRTL
            ? FadeInLeft
            : FadeInRight
          : isRTL
            ? FadeInRight
            : FadeInLeft;
        const Shell = reduce ? View : Animated.View;
        const shellProps = reduce
          ? {}
          : { entering: Enter.delay(140 + index * 90).springify().damping(15) };

        const darkRibbon = index % 2 === 0;
        const bg = darkRibbon
          ? colorScheme === 'dark'
            ? colors.surfaceSecondary
            : '#2F2924'
          : colors.surface;
        const fg = darkRibbon
          ? colorScheme === 'dark'
            ? colors.textPrimary
            : '#F5F1EA'
          : colors.textPrimary;
        const muted = darkRibbon
          ? colorScheme === 'dark'
            ? colors.textMuted
            : 'rgba(245,241,234,0.65)'
          : colors.textSecondary;
        const iconTint = darkRibbon
          ? colorScheme === 'dark'
            ? colors.brand
            : '#D4C4A8'
          : colors.brand;

        return (
          <Shell
            key={ribbon.key}
            {...shellProps}
            style={{
              marginStart: fromEnd ? (isRTL ? 0 : theme.spacing.xl) : isRTL ? theme.spacing.xl : 0,
              marginEnd: fromEnd ? (isRTL ? theme.spacing.xl : 0) : isRTL ? 0 : theme.spacing.xl,
            }}
          >
            <AnimatedPressable
              variant="card"
              accessibilityRole="button"
              accessibilityLabel={t(ribbon.labelKey)}
              onPress={() => {
                void haptics.confirmLight();
                router.push(ribbon.href);
              }}
              style={{
                minHeight: 92,
                borderRadius: theme.radius.lg,
                backgroundColor: bg,
                paddingVertical: theme.spacing.md,
                paddingHorizontal: theme.spacing.lg,
                flexDirection: isRTL ? 'row-reverse' : 'row',
                alignItems: 'center',
                gap: theme.spacing.md,
                borderWidth: darkRibbon ? 0 : 1,
                borderColor: colors.border,
                ...theme.elevation.raised,
              }}
            >
              <View
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: 15,
                  backgroundColor: darkRibbon ? 'rgba(255,255,255,0.08)' : colors.brandSoft,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name={ribbon.icon} size={22} color={iconTint} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <AppText variant="heading" weight="semibold" style={{ color: fg }}>
                  {t(ribbon.labelKey)}
                </AppText>
                <AppText variant="caption" style={{ color: muted }} numberOfLines={1}>
                  {t(ribbon.hintKey)}
                </AppText>
              </View>
              <Ionicons
                name={isRTL ? 'chevron-back' : 'chevron-forward'}
                size={18}
                color={muted}
              />
            </AnimatedPressable>
          </Shell>
        );
      })}
    </View>
  );
}
