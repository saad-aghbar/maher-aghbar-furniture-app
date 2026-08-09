import { useCallback, useMemo, useState } from 'react';
import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  Extrapolation,
  FadeInDown,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useRouter, type Href } from 'expo-router';
import { AppText } from '@/components/AppText';
import { useLocale } from '@/i18n';
import { AnimatedPressable, CountUp, haptics, useReducedMotion } from '@/motion';
import { springs } from '@/motion/presets';
import { useTheme } from '@/theme';

type Props = {
  receivables: number;
  openInvoices: number;
  enterDelay?: number;
};

const SLIDE_H = 52;
const THUMB = 44;

export function AdminHomeHeroCard({ receivables, openInvoices, enterDelay = 80 }: Props) {
  const { t, formatCurrency, isRTL } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const router = useRouter();
  const reduce = useReducedMotion();
  const [hidden, setHidden] = useState(false);
  const [trackW, setTrackW] = useState(0);

  const maxSlide = Math.max(trackW - THUMB - 8, 0);
  const slideX = useSharedValue(0);
  const hideProgress = useSharedValue(0);

  const darkHero = colorScheme === 'dark' ? '#1A1614' : '#2A2420';
  const onHero = '#F5F1EA';
  const mutedOnHero = 'rgba(245, 241, 234, 0.72)';

  const moneyFormat = useMemo(
    () => (n: number) => formatCurrency(n),
    [formatCurrency],
  );

  const goOrders = useCallback(() => {
    void haptics.confirmMedium();
    router.push('/(app)/(admin)/(tabs)/orders' as Href);
  }, [router]);

  const goProduction = useCallback(() => {
    void haptics.confirmLight();
    router.push('/(app)/(admin)/(tabs)/production' as Href);
  }, [router]);

  const goInvoices = useCallback(() => {
    void haptics.selection();
    router.push('/(app)/(admin)/invoices' as Href);
  }, [router]);

  const completeSlide = useCallback(() => {
    goOrders();
    slideX.value = withSpring(0, springs.snappy);
  }, [goOrders, slideX]);

  const pan = Gesture.Pan()
    .enabled(!reduce && maxSlide > 0)
    .onUpdate((e) => {
      const raw = isRTL ? -e.translationX : e.translationX;
      slideX.value = Math.min(maxSlide, Math.max(0, raw));
    })
    .onEnd(() => {
      if (slideX.value > maxSlide * 0.72) {
        slideX.value = withSpring(maxSlide, springs.snappy, (finished) => {
          if (finished) runOnJS(completeSlide)();
        });
      } else {
        slideX.value = withSpring(0, springs.gentle);
      }
    });

  const thumbStyle = useAnimatedStyle(() => {
    const x = isRTL ? -slideX.value : slideX.value;
    return {
      transform: [{ translateX: x }],
    };
  });

  const fillStyle = useAnimatedStyle(() => ({
    width: slideX.value + THUMB,
    opacity: interpolate(slideX.value, [0, maxSlide || 1], [0.15, 0.45], Extrapolation.CLAMP),
  }));

  const amountStyle = useAnimatedStyle(() => ({
    opacity: interpolate(hideProgress.value, [0, 1], [1, 0]),
    transform: [{ scale: interpolate(hideProgress.value, [0, 1], [1, 0.92]) }],
  }));

  const dotsStyle = useAnimatedStyle(() => ({
    opacity: hideProgress.value,
    position: 'absolute' as const,
  }));

  const toggleHide = () => {
    void haptics.selection();
    const next = !hidden;
    setHidden(next);
    hideProgress.value = withTiming(next ? 1 : 0, { duration: reduce ? 0 : 280 });
  };

  const Wrapper = reduce ? View : Animated.View;
  const wrapperProps = reduce
    ? {}
    : { entering: FadeInDown.delay(enterDelay).springify().damping(18) };

  return (
    <Wrapper {...wrapperProps} style={{ marginBottom: theme.spacing.lg }}>
      <View
        style={{
          backgroundColor: darkHero,
          borderRadius: theme.radius.xl,
          padding: theme.spacing.lg,
          gap: theme.spacing.md,
          overflow: 'hidden',
          ...theme.elevation.raised,
        }}
      >
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: theme.spacing.md,
          }}
        >
          <View style={{ flex: 1, gap: theme.spacing.xs }}>
            <AppText variant="caption" style={{ color: mutedOnHero }}>
              {t('mobile.adminHome.heroTitle')}
            </AppText>
            <View style={{ minHeight: 40, justifyContent: 'center' }}>
              <Animated.View style={amountStyle}>
                <CountUp
                  value={receivables}
                  format={moneyFormat}
                  variant="largeTitle"
                  color={onHero}
                  accessibilityLabel={t('mobile.adminHome.metrics.outstandingReceivables')}
                />
              </Animated.View>
              <Animated.View style={dotsStyle} pointerEvents="none">
                <AppText variant="largeTitle" weight="semibold" style={{ color: onHero }}>
                  ••••••
                </AppText>
              </Animated.View>
            </View>
          </View>
          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              gap: theme.spacing.sm,
              alignItems: 'center',
            }}
          >
            <AnimatedPressable
              variant="button"
              accessibilityRole="button"
              accessibilityLabel={
                hidden ? t('mobile.adminHome.showBalance') : t('mobile.adminHome.hideBalance')
              }
              onPress={toggleHide}
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'rgba(255,255,255,0.12)',
              }}
            >
              <Ionicons name={hidden ? 'eye-off' : 'eye'} size={18} color={onHero} />
            </AnimatedPressable>
            <AnimatedPressable
              variant="button"
              accessibilityRole="button"
              accessibilityLabel={t('mobile.adminHome.invoicesCta', { count: openInvoices })}
              onPress={goInvoices}
              style={{
                paddingHorizontal: theme.spacing.md,
                paddingVertical: theme.spacing.sm,
                borderRadius: theme.radius.full,
                backgroundColor: onHero,
              }}
            >
              <AppText variant="caption" weight="semibold" style={{ color: darkHero }}>
                {t('mobile.adminHome.invoicesCtaShort')}
              </AppText>
            </AnimatedPressable>
          </View>
        </View>

        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            gap: theme.spacing.sm,
          }}
        >
          <AnimatedPressable
            variant="button"
            accessibilityRole="button"
            accessibilityLabel={t('mobile.adminHome.actionOrders')}
            onPress={goOrders}
            style={{
              flex: 1,
              minHeight: 56,
              borderRadius: theme.radius.lg,
              backgroundColor: onHero,
              paddingHorizontal: theme.spacing.md,
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'center',
              gap: theme.spacing.sm,
            }}
          >
            <Ionicons name="cube-outline" size={22} color={darkHero} />
            <AppText variant="label" weight="semibold" style={{ color: darkHero, flex: 1 }}>
              {t('mobile.adminHome.actionOrders')}
            </AppText>
          </AnimatedPressable>
          <AnimatedPressable
            variant="button"
            accessibilityRole="button"
            accessibilityLabel={t('mobile.adminHome.actionProduction')}
            onPress={goProduction}
            style={{
              flex: 1,
              minHeight: 56,
              borderRadius: theme.radius.lg,
              backgroundColor: onHero,
              paddingHorizontal: theme.spacing.md,
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'center',
              gap: theme.spacing.sm,
            }}
          >
            <Ionicons name="construct-outline" size={22} color={darkHero} />
            <AppText variant="label" weight="semibold" style={{ color: darkHero, flex: 1 }}>
              {t('mobile.adminHome.actionProduction')}
            </AppText>
          </AnimatedPressable>
        </View>

        {/* Slide-to-open orders (Pinterest-inspired) */}
        <View
          onLayout={(e) => setTrackW(e.nativeEvent.layout.width)}
          style={{
            height: SLIDE_H,
            borderRadius: SLIDE_H / 2,
            backgroundColor: 'rgba(255,255,255,0.1)',
            justifyContent: 'center',
            overflow: 'hidden',
            paddingHorizontal: 4,
          }}
        >
          <Animated.View
            style={[
              {
                position: 'absolute',
                top: 4,
                bottom: 4,
                ...(isRTL ? { right: 4 } : { left: 4 }),
                borderRadius: (SLIDE_H - 8) / 2,
                backgroundColor: colors.brand,
              },
              fillStyle,
            ]}
          />
          <AppText
            variant="caption"
            weight="medium"
            align="center"
            style={{ color: mutedOnHero }}
          >
            {reduce
              ? t('mobile.adminHome.slideTapHint')
              : t('mobile.adminHome.slideHint')}
          </AppText>
          <GestureDetector gesture={pan}>
            <Animated.View
              style={[
                {
                  position: 'absolute',
                  top: (SLIDE_H - THUMB) / 2,
                  ...(isRTL ? { right: 4 } : { left: 4 }),
                  width: THUMB,
                  height: THUMB,
                  borderRadius: THUMB / 2,
                  backgroundColor: onHero,
                  alignItems: 'center',
                  justifyContent: 'center',
                  ...theme.elevation.raised,
                },
                thumbStyle,
              ]}
            >
              <AnimatedPressable
                variant="button"
                accessibilityRole="button"
                accessibilityLabel={t('mobile.adminHome.actionOrders')}
                onPress={reduce ? goOrders : undefined}
                disabled={!reduce}
                style={{
                  width: THUMB,
                  height: THUMB,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons
                  name={isRTL ? 'chevron-back' : 'chevron-forward'}
                  size={22}
                  color={darkHero}
                />
              </AnimatedPressable>
            </Animated.View>
          </GestureDetector>
        </View>
      </View>
    </Wrapper>
  );
}
