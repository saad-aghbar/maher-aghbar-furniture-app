import { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { AppText } from '@/components/AppText';
import { DealerGlassCard } from '@/features/dealer-ui/DealerGlassCard';
import { useLocale } from '@/i18n';
import { haptics, springs, useReducedMotion } from '@/motion';
import { useTheme } from '@/theme';

type Props = {
  greeting: string;
  companyName?: string;
  /** Product image URIs (5–10 random from catalog). */
  imageUris: readonly string[];
  onOpenCatalog: () => void;
  catalogA11yLabel: string;
  /** When false, pause ambient motion (scrolled away). */
  active?: boolean;
};

const STAGE_H = 260;
const EASE = Easing.bezier(0.16, 1, 0.3, 1);
const DOT = 6;
const PILL_W = 18;

function ShowcasePageDot({
  index,
  pageSv,
  pulseSv,
  color,
  onPress,
  reduceMotion,
}: {
  index: number;
  pageSv: Animated.SharedValue<number>;
  pulseSv: Animated.SharedValue<number>;
  color: string;
  onPress: () => void;
  reduceMotion: boolean;
}) {
  const style = useAnimatedStyle(() => {
    const dist = Math.abs(pageSv.value - index);
    const active = interpolate(dist, [0, 0.85], [1, 0], Extrapolation.CLAMP);
    const pulse = reduceMotion ? 0 : pulseSv.value * active;
    return {
      width: interpolate(active, [0, 1], [DOT, PILL_W]),
      height: DOT,
      borderRadius: DOT / 2,
      opacity: interpolate(active, [0, 1], [0.32, 1]),
      backgroundColor: color,
      transform: [
        { scale: interpolate(active, [0, 1], [0.88, 1]) * (1 + pulse * 0.12) },
      ],
    };
  });

  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={`Photo ${index + 1}`}
      style={{ paddingVertical: 8, paddingHorizontal: 3 }}
    >
      <Animated.View style={style} />
    </Pressable>
  );
}

/**
 * Dealer home showcase — greeting above; glass card cycles live product photos.
 * Animated page pills match photo count; tap card opens catalog.
 */
export function DealerHero({
  greeting,
  companyName,
  imageUris,
  onOpenCatalog,
  catalogA11yLabel,
  active = true,
}: Props) {
  const { isRTL, locale } = useLocale();
  const { colors, theme } = useTheme();
  const reduceMotion = useReducedMotion();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const uris = imageUris.filter(Boolean);
  const [page, setPage] = useState(0);
  const [prevPage, setPrevPage] = useState(0);

  const ken = useSharedValue(0);
  const cross = useSharedValue(1);
  const pageSv = useSharedValue(0);
  const pulse = useSharedValue(0);

  useEffect(() => {
    setPage(0);
    setPrevPage(0);
    cross.value = 1;
    pageSv.value = 0;
  }, [cross, pageSv, uris.join('|')]);

  useEffect(() => {
    if (reduceMotion) {
      pageSv.value = page;
      return;
    }
    pageSv.value = withSpring(page, springs.snappy);
  }, [page, pageSv, reduceMotion]);

  useEffect(() => {
    if (!active || reduceMotion) {
      ken.value = 0;
      pulse.value = 0;
      return;
    }
    ken.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 14000, easing: EASE }),
        withTiming(0, { duration: 14000, easing: EASE }),
      ),
      -1,
      false,
    );
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 900, easing: EASE }),
        withTiming(0, { duration: 900, easing: EASE }),
      ),
      -1,
      false,
    );
  }, [active, ken, pulse, reduceMotion]);

  useEffect(() => {
    if (reduceMotion || !active || uris.length <= 1) return;
    const id = setInterval(() => {
      setPage((p) => {
        setPrevPage(p);
        cross.value = 0;
        cross.value = withTiming(1, { duration: 650, easing: EASE });
        return (p + 1) % uris.length;
      });
    }, 4200);
    return () => clearInterval(id);
  }, [active, cross, reduceMotion, uris.length]);

  const goToPage = (next: number) => {
    if (next === page || next < 0 || next >= uris.length) return;
    void haptics.selection();
    setPrevPage(page);
    setPage(next);
    if (!reduceMotion) {
      cross.value = 0;
      cross.value = withTiming(1, { duration: 520, easing: EASE });
    } else {
      cross.value = 1;
    }
  };

  const bgAStyle = useAnimatedStyle(() => ({
    opacity: interpolate(cross.value, [0, 1], [1, 0], Extrapolation.CLAMP),
    transform: [
      { scale: interpolate(ken.value, [0, 1], [1.03, 1.08], Extrapolation.CLAMP) },
      {
        translateX: interpolate(ken.value, [0, 1], [-6, 8], Extrapolation.CLAMP),
      },
    ],
  }));

  const bgBStyle = useAnimatedStyle(() => ({
    opacity: cross.value,
    transform: [
      { scale: interpolate(ken.value, [0, 1], [1.06, 1.03], Extrapolation.CLAMP) },
      {
        translateX: interpolate(ken.value, [0, 1], [8, -4], Extrapolation.CLAMP),
      },
    ],
  }));

  const current = uris[page];
  const previous = uris[prevPage] ?? current;
  const pillColor = '#FFFFFF';

  return (
    <View style={{ gap: theme.spacing.md }}>
      <View style={{ gap: 2 }}>
        <AppText
          variant="title"
          weight={titleWeight}
          style={{
            color: colors.textPrimary,
            textAlign: isRTL ? 'right' : 'left',
            fontSize: 22,
            lineHeight: 28,
          }}
        >
          {greeting}
        </AppText>
        {companyName ? (
          <AppText
            variant="body"
            color="secondary"
            style={{ textAlign: isRTL ? 'right' : 'left' }}
          >
            {companyName}
          </AppText>
        ) : null}
      </View>

      <DealerGlassCard
        intensity="solid"
        contentStyle={{ padding: 0 }}
        style={{ minHeight: STAGE_H }}
      >
        <View style={{ height: STAGE_H, overflow: 'hidden', backgroundColor: colors.brandSoft }}>
          <Pressable
            onPress={() => {
              void haptics.selection();
              onOpenCatalog();
            }}
            accessibilityRole="button"
            accessibilityLabel={catalogA11yLabel}
            style={StyleSheet.absoluteFill}
          >
            {previous ? (
              <Animated.View style={[StyleSheet.absoluteFill, bgAStyle]}>
                <Image
                  source={{ uri: previous }}
                  resizeMode="cover"
                  style={{ width: '100%', height: '100%' }}
                  accessibilityIgnoresInvertColors
                />
              </Animated.View>
            ) : null}
            {current ? (
              <Animated.View style={[StyleSheet.absoluteFill, bgBStyle]}>
                <Image
                  source={{ uri: current }}
                  resizeMode="cover"
                  style={{ width: '100%', height: '100%' }}
                  accessibilityIgnoresInvertColors
                />
              </Animated.View>
            ) : (
              <View
                style={[
                  StyleSheet.absoluteFill,
                  { alignItems: 'center', justifyContent: 'center', padding: theme.spacing.lg },
                ]}
              >
                <AppText variant="body" color="secondary" style={{ textAlign: 'center' }}>
                  {catalogA11yLabel}
                </AppText>
              </View>
            )}

          </Pressable>

          {uris.length > 1 ? (
            <View
              pointerEvents="box-none"
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: 6,
                alignItems: 'center',
                zIndex: 4,
              }}
            >
              <View
                style={{
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 2,
                }}
              >
                {uris.map((_, i) => (
                  <ShowcasePageDot
                    key={`dot-${i}`}
                    index={i}
                    pageSv={pageSv}
                    pulseSv={pulse}
                    color={pillColor}
                    reduceMotion={reduceMotion}
                    onPress={() => goToPage(i)}
                  />
                ))}
              </View>
            </View>
          ) : null}
        </View>
      </DealerGlassCard>
    </View>
  );
}
