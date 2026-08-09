import { View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { AppText } from '@/components/AppText';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics, useReducedMotion } from '@/motion';
import { useTheme } from '@/theme';

type Tile = {
  key: string;
  labelKey: string;
  icon: keyof typeof Ionicons.glyphMap;
  href: Href;
};

const TILES: Tile[] = [
  {
    key: 'orders',
    labelKey: 'mobile.adminHome.actionOrders',
    icon: 'file-tray-full-outline',
    href: '/(app)/(admin)/(tabs)/orders',
  },
  {
    key: 'production',
    labelKey: 'mobile.adminHome.actionProduction',
    icon: 'hammer-outline',
    href: '/(app)/(admin)/(tabs)/production',
  },
  {
    key: 'inventory',
    labelKey: 'mobile.adminHome.actionInventory',
    icon: 'layers-outline',
    href: '/(app)/(admin)/(tabs)/inventory',
  },
  {
    key: 'invoices',
    labelKey: 'mobile.adminHome.actionInvoices',
    icon: 'wallet-outline',
    href: '/(app)/(admin)/invoices',
  },
];

export function AdminHomeModuleGrid() {
  const { t, isRTL } = useLocale();
  const { colors, theme } = useTheme();
  const router = useRouter();
  const reduce = useReducedMotion();

  const Wrapper = reduce ? View : Animated.View;
  const wrapperProps = reduce
    ? {}
    : { entering: FadeInDown.delay(180).springify().damping(17) };

  return (
    <Wrapper {...wrapperProps} style={{ marginBottom: theme.spacing.xl, gap: theme.spacing.sm }}>
      <AppText variant="title" weight="semibold">
        {t('mobile.adminHome.modulesTitle')}
      </AppText>
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          flexWrap: 'wrap',
          gap: theme.spacing.sm,
        }}
      >
        {TILES.map((tile) => (
          <AnimatedPressable
            key={tile.key}
            variant="card"
            accessibilityRole="button"
            accessibilityLabel={t(tile.labelKey)}
            onPress={() => {
              void haptics.confirmLight();
              router.push(tile.href);
            }}
            style={{
              width: '48%',
              flexGrow: 1,
              minWidth: '46%',
              minHeight: 108,
              borderRadius: theme.radius.lg,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
              padding: theme.spacing.md,
              gap: theme.spacing.md,
              justifyContent: 'space-between',
              ...theme.elevation.card,
            }}
          >
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                backgroundColor: colors.brandSoft,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name={tile.icon} size={22} color={colors.brand} />
            </View>
            <AppText variant="label" weight="semibold">
              {t(tile.labelKey)}
            </AppText>
          </AnimatedPressable>
        ))}
      </View>
    </Wrapper>
  );
}
