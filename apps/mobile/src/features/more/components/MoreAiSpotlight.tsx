import { useEffect, useMemo } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Defs, Line, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';
import Animated, {
  Easing,
  FadeInDown,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { can } from '@maher/permissions';
import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics, useReducedMotion } from '@/motion';
import { useTheme } from '@/theme';

type OrbSpec = {
  size: number;
  top: number;
  left: number;
  color: string;
  opacity: number;
  durationMs: number;
  delayMs: number;
  travelX: number;
  travelY: number;
};

function FloatingOrb({
  size,
  top,
  left,
  color,
  opacity,
  durationMs,
  delayMs,
  travelX,
  travelY,
  reduce,
}: OrbSpec & { reduce: boolean }) {
  const progress = useSharedValue(reduce ? 0.5 : 0);

  useEffect(() => {
    if (reduce) {
      progress.value = 0.5;
      return;
    }
    progress.value = 0;
    progress.value = withDelay(
      delayMs,
      withRepeat(
        withTiming(1, { duration: durationMs, easing: Easing.inOut(Easing.sin) }),
        -1,
        true,
      ),
    );
  }, [delayMs, durationMs, progress, reduce]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity * interpolate(progress.value, [0, 0.5, 1], [0.55, 1, 0.65]),
    transform: [
      { translateX: interpolate(progress.value, [0, 1], [-travelX, travelX]) },
      { translateY: interpolate(progress.value, [0, 1], [-travelY, travelY]) },
      { scale: interpolate(progress.value, [0, 0.5, 1], [0.85, 1.08, 0.92]) },
    ],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          top,
          left,
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
        },
        style,
      ]}
    />
  );
}

function FadedGrid({ width, height }: { width: number; height: number }) {
  const step = 18;
  const lines = useMemo(() => {
    const v: number[] = [];
    const h: number[] = [];
    for (let x = step; x < width; x += step) v.push(x);
    for (let y = step; y < height; y += step) h.push(y);
    return { v, h };
  }, [height, width]);

  return (
    <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <LinearGradient id="aiGridFade" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.16" />
          <Stop offset="0.45" stopColor="#D4C4A8" stopOpacity="0.1" />
          <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0.04" />
        </LinearGradient>
      </Defs>
      {lines.v.map((x) => (
        <Line
          key={`v-${x}`}
          x1={x}
          y1={0}
          x2={x}
          y2={height}
          stroke="url(#aiGridFade)"
          strokeWidth={StyleSheet.hairlineWidth}
        />
      ))}
      {lines.h.map((y) => (
        <Line
          key={`h-${y}`}
          x1={0}
          y1={y}
          x2={width}
          y2={y}
          stroke="url(#aiGridFade)"
          strokeWidth={StyleSheet.hairlineWidth}
        />
      ))}
    </Svg>
  );
}

function GradientWash({ width, height }: { width: number; height: number }) {
  return (
    <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <LinearGradient id="aiBase" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#2A2425" />
          <Stop offset="0.45" stopColor="#1E1A1B" />
          <Stop offset="1" stopColor="#322C2D" />
        </LinearGradient>
        <RadialGradient id="aiBrandBlob" cx="18%" cy="28%" r="55%">
          <Stop offset="0" stopColor="#8F7A58" stopOpacity="0.45" />
          <Stop offset="1" stopColor="#8F7A58" stopOpacity="0" />
        </RadialGradient>
        <RadialGradient id="aiAccentBlob" cx="88%" cy="78%" r="50%">
          <Stop offset="0" stopColor="#C4A574" stopOpacity="0.38" />
          <Stop offset="1" stopColor="#C4A574" stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Rect x={0} y={0} width={width} height={height} fill="url(#aiBase)" />
      <Rect x={0} y={0} width={width} height={height} fill="url(#aiBrandBlob)" />
      <Rect x={0} y={0} width={width} height={height} fill="url(#aiAccentBlob)" />
    </Svg>
  );
}

/** Featured AI assistant banner — gradient grid + drifting orbs. */
export function MoreAiSpotlight() {
  const { user } = useAuth();
  const { t, locale, isRTL } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const router = useRouter();
  const reduce = useReducedMotion();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const allowed = can(user, 'ai-chat.read');
  const ink = colorScheme === 'dark' ? colors.surfaceSecondary : '#1E1A1B';
  const { width: winW } = useWindowDimensions();
  const cardW = Math.max(280, winW - theme.spacing.lg * 2);
  const cardH = 120;

  const breathe = useSharedValue(reduce ? 1 : 0);

  useEffect(() => {
    if (reduce || !allowed) {
      breathe.value = 1;
      return;
    }
    breathe.value = withRepeat(
      withTiming(1, { duration: 4200, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, [allowed, breathe, reduce]);

  const glowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(breathe.value, [0, 1], [0.16, 0.34]),
  }));

  const orbs = useMemo<OrbSpec[]>(
    () => [
      {
        size: 10,
        top: 18,
        left: cardW * 0.72,
        color: 'rgba(255,255,255,0.55)',
        opacity: 0.7,
        durationMs: 5200,
        delayMs: 0,
        travelX: 14,
        travelY: 10,
      },
      {
        size: 7,
        top: 52,
        left: cardW * 0.82,
        color: colors.brand,
        opacity: 0.85,
        durationMs: 6800,
        delayMs: 400,
        travelX: 18,
        travelY: 14,
      },
      {
        size: 12,
        top: 28,
        left: cardW * 0.58,
        color: 'rgba(212,196,168,0.65)',
        opacity: 0.55,
        durationMs: 7600,
        delayMs: 200,
        travelX: 10,
        travelY: 16,
      },
      {
        size: 6,
        top: 78,
        left: cardW * 0.68,
        color: 'rgba(245,241,234,0.5)',
        opacity: 0.65,
        durationMs: 5400,
        delayMs: 800,
        travelX: 12,
        travelY: 8,
      },
      {
        size: 8,
        top: 16,
        left: cardW * 0.42,
        color: 'rgba(196,165,116,0.7)',
        opacity: 0.5,
        durationMs: 9000,
        delayMs: 120,
        travelX: 16,
        travelY: 12,
      },
      {
        size: 5,
        top: 88,
        left: cardW * 0.88,
        color: 'rgba(255,255,255,0.45)',
        opacity: 0.6,
        durationMs: 6100,
        delayMs: 560,
        travelX: 8,
        travelY: 14,
      },
      {
        size: 9,
        top: 64,
        left: cardW * 0.5,
        color: colors.brand,
        opacity: 0.4,
        durationMs: 8200,
        delayMs: 300,
        travelX: 20,
        travelY: 6,
      },
      {
        size: 4,
        top: 40,
        left: cardW * 0.9,
        color: 'rgba(212,196,168,0.8)',
        opacity: 0.75,
        durationMs: 4800,
        delayMs: 1000,
        travelX: 6,
        travelY: 18,
      },
    ],
    [cardW, colors.brand],
  );

  if (!allowed) return null;

  const Shell = reduce ? View : Animated.View;
  const shellProps = reduce
    ? {}
    : { entering: FadeInDown.delay(120).duration(400).damping(22) };

  const gold = '#D4C4A8';
  const parchment = '#F5F1EA';

  return (
    <Shell {...shellProps} style={{ gap: theme.spacing.sm }}>
      <AppText
        variant="caption"
        weight={locale === 'ar' ? 'regular' : 'medium'}
        style={{
          letterSpacing: locale === 'ar' ? 0 : 1.2,
          textTransform: locale === 'ar' ? 'none' : 'uppercase',
          color: colors.brand,
        }}
      >
        {t('mobile.more.floor.aiEyebrow')}
      </AppText>

      <AnimatedPressable
        variant="card"
        accessibilityRole="button"
        accessibilityLabel={t('mobile.more.floor.aiTitle')}
        onPress={() => {
          void haptics.confirmMedium();
          // Full system chatbot lands later — intake remains the interim destination.
          router.push('/(app)/(admin)/ai-chat' as Href);
        }}
        style={{
          borderRadius: theme.radius.xl,
          backgroundColor: ink,
          paddingVertical: theme.spacing.md + 4,
          paddingHorizontal: theme.spacing.lg,
          overflow: 'hidden',
          minHeight: cardH,
          borderWidth: 1,
          borderColor: 'rgba(63,52,44,0.4)',
          ...theme.elevation.raised,
        }}
      >
        <View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]}
        >
          <GradientWash width={cardW + 8} height={cardH + 28} />
          <FadedGrid width={cardW + 8} height={cardH + 28} />

          {!reduce ? (
            <Animated.View
              style={[
                {
                  position: 'absolute',
                  width: cardW * 0.5,
                  height: cardW * 0.36,
                  borderRadius: cardW,
                  backgroundColor: colors.brand,
                  top: -cardW * 0.18,
                  ...(isRTL ? { left: -cardW * 0.1 } : { right: -cardW * 0.1 }),
                },
                glowStyle,
              ]}
            />
          ) : null}

          {orbs.map((orb, i) => (
            <FloatingOrb key={i} {...orb} reduce={Boolean(reduce)} />
          ))}
        </View>

        <View
          style={{
            zIndex: 1,
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            gap: theme.spacing.sm,
          }}
        >
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 11,
              backgroundColor: 'rgba(255,255,255,0.12)',
              borderWidth: 1,
              borderColor: 'rgba(212,196,168,0.35)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="chatbubbles-outline" size={20} color={gold} />
          </View>

          <View
            style={{
              flex: 1,
              gap: 2,
              alignItems: isRTL ? 'flex-end' : 'flex-start',
            }}
          >
            <AppText
              variant="label"
              weight={titleWeight}
              style={{ color: parchment }}
              numberOfLines={1}
            >
              {t('mobile.more.floor.aiTitle')}
            </AppText>
            <AppText
              variant="caption"
              weight="regular"
              style={{ color: 'rgba(245,241,234,0.72)', fontSize: 11, lineHeight: 14 }}
              numberOfLines={2}
            >
              {t('mobile.more.floor.aiBody')}
            </AppText>
          </View>

          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'center',
              gap: theme.spacing.xs,
              paddingHorizontal: theme.spacing.sm,
              paddingVertical: theme.spacing.xs + 2,
              borderRadius: theme.radius.full,
              backgroundColor: parchment,
            }}
          >
            <AppText variant="caption" weight={titleWeight} style={{ color: ink }}>
              {t('mobile.more.floor.aiCta')}
            </AppText>
            <Ionicons
              name={isRTL ? 'arrow-back' : 'arrow-forward'}
              size={13}
              color={ink}
            />
          </View>
        </View>
      </AnimatedPressable>
    </Shell>
  );
}
