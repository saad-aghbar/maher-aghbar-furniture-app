import { useEffect } from 'react';
import { View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  Easing,
  FadeInLeft,
  FadeInRight,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { AppText } from '@/components/AppText';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics, useReducedMotion } from '@/motion';
import { useTheme } from '@/theme';

type Dest = {
  key: string;
  labelKey: string;
  hintKey: string;
  icon: keyof typeof Ionicons.glyphMap;
  href: Href;
  inset: 'start' | 'end';
};

const DESTS: Dest[] = [
  {
    key: 'orders',
    labelKey: 'mobile.adminHome.actionOrders',
    hintKey: 'mobile.adminHome.homeDestOrders',
    icon: 'file-tray-full-outline',
    href: '/(app)/(admin)/(tabs)/orders',
    inset: 'start',
  },
  {
    key: 'production',
    labelKey: 'mobile.adminHome.actionProduction',
    hintKey: 'mobile.adminHome.homeDestProduction',
    icon: 'hammer-outline',
    href: '/(app)/(admin)/(tabs)/production',
    inset: 'end',
  },
  {
    key: 'inventory',
    labelKey: 'mobile.adminHome.actionInventory',
    hintKey: 'mobile.adminHome.homeDestInventory',
    icon: 'layers-outline',
    href: '/(app)/(admin)/(tabs)/inventory',
    inset: 'start',
  },
  {
    key: 'invoices',
    labelKey: 'mobile.adminHome.actionInvoices',
    hintKey: 'mobile.adminHome.homeDestInvoices',
    icon: 'wallet-outline',
    href: '/(app)/(admin)/invoices',
    inset: 'end',
  },
];

/**
 * Destination zigzag — living place-language + atelier ribbon choreography.
 */
export function AdminHomeDestinations() {
  const { t, isRTL } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const router = useRouter();
  const reduce = useReducedMotion();
  const ink = colorScheme === 'dark' ? colors.surfaceSecondary : '#2F2924';

  return (
    <View style={{ marginBottom: theme.spacing.xl, gap: theme.spacing.md }}>
      <View style={{ gap: 4 }}>
        <AppText
          variant="caption"
          weight="semibold"
          style={{ letterSpacing: 1.6, textTransform: 'uppercase', color: colors.brand }}
        >
          {t('mobile.adminHome.homeDestEyebrow')}
        </AppText>
        <AppText variant="title" weight="semibold">
          {t('mobile.adminHome.homeDestTitle')}
        </AppText>
        <AppText variant="caption" color="secondary">
          {t('mobile.adminHome.homeDestHint')}
        </AppText>
      </View>

      {DESTS.map((dest, index) => {
        const fromEnd = dest.inset === 'end';
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
          : { entering: Enter.delay(160 + index * 100).springify().damping(14) };

        const dark = index % 2 === 0;
        const bg = dark ? ink : colors.surface;
        const fg = dark ? '#F5F1EA' : colors.textPrimary;
        const muted = dark ? 'rgba(245,241,234,0.65)' : colors.textSecondary;
        const iconTint = dark ? '#D4C4A8' : colors.brand;

        return (
          <Shell
            key={dest.key}
            {...shellProps}
            style={{
              marginStart: fromEnd ? theme.spacing.xl : 0,
              marginEnd: fromEnd ? 0 : theme.spacing.xl,
            }}
          >
            <DestRibbon
              dest={dest}
              index={index}
              reduce={reduce}
              bg={bg}
              fg={fg}
              muted={muted}
              iconTint={iconTint}
              dark={dark}
              onPress={() => {
                void haptics.confirmLight();
                router.push(dest.href);
              }}
            />
          </Shell>
        );
      })}
    </View>
  );
}

function DestRibbon({
  dest,
  index,
  reduce,
  bg,
  fg,
  muted,
  iconTint,
  dark,
  onPress,
}: {
  dest: Dest;
  index: number;
  reduce: boolean;
  bg: string;
  fg: string;
  muted: string;
  iconTint: string;
  dark: boolean;
  onPress: () => void;
}) {
  const { t, isRTL } = useLocale();
  const { colors, theme } = useTheme();
  const iconTilt = useSharedValue(reduce ? 1 : 0);
  const sheen = useSharedValue(0);

  useEffect(() => {
    if (reduce) {
      iconTilt.value = 1;
      return;
    }
    iconTilt.value = withDelay(
      280 + index * 100,
      withTiming(1, { duration: 650, easing: Easing.out(Easing.cubic) }),
    );
    if (index === 0) {
      sheen.value = withDelay(
        500,
        withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }),
      );
    }
  }, [iconTilt, index, reduce, sheen]);

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${interpolate(iconTilt.value, [0, 1], [-14, 0])}deg` }],
  }));

  const sheenStyle = useAnimatedStyle(() => ({
    opacity: interpolate(sheen.value, [0, 0.4, 1], [0, 0.18, 0]),
    transform: [
      {
        translateX: interpolate(sheen.value, [0, 1], isRTL ? [120, -160] : [-120, 160]),
      },
    ],
  }));

  return (
    <AnimatedPressable
      variant="card"
      accessibilityRole="button"
      accessibilityLabel={t(dest.labelKey)}
      onPress={onPress}
      style={{
        minHeight: 96,
        borderRadius: theme.radius.xl,
        backgroundColor: bg,
        borderWidth: dark ? 0 : 1,
        borderColor: colors.border,
        padding: theme.spacing.lg,
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        gap: theme.spacing.md,
        overflow: 'hidden',
        ...theme.elevation.raised,
      }}
    >
      {!reduce && index === 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: 'absolute',
              top: -20,
              bottom: -20,
              width: 48,
              backgroundColor: '#F5F1EA',
              transform: [{ rotate: '18deg' }],
            },
            sheenStyle,
          ]}
        />
      ) : null}
      <Animated.View
        style={[
          {
            width: 48,
            height: 48,
            borderRadius: 16,
            backgroundColor: dark ? 'rgba(255,255,255,0.08)' : colors.brandSoft,
            alignItems: 'center',
            justifyContent: 'center',
          },
          iconStyle,
        ]}
      >
        <Ionicons name={dest.icon} size={22} color={iconTint} />
      </Animated.View>
      <View style={{ flex: 1, gap: 2 }}>
        <AppText variant="heading" weight="semibold" style={{ color: fg }}>
          {t(dest.labelKey)}
        </AppText>
        <AppText variant="caption" style={{ color: muted }} numberOfLines={2}>
          {t(dest.hintKey)}
        </AppText>
      </View>
      <Ionicons name={isRTL ? 'arrow-back' : 'arrow-forward'} size={18} color={muted} />
    </AnimatedPressable>
  );
}
