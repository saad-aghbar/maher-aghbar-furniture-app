import { useEffect, useState } from 'react';
import { LayoutChangeEvent, Platform, Pressable, StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { locales } from '@maher/i18n';
import type { Locale } from '@maher/types';
import { AppText } from '@/components/AppText';
import { useLocale } from '@/i18n';
import { haptics, springs, useReducedMotion } from '@/motion';
import { useTheme } from '@/theme';
import type { LoginColors } from '../theme/loginColors';

type Props = {
  colors: LoginColors;
};

type SegmentFrame = { x: number; y: number; width: number; height: number };

const PILL_PAD = 3;
const SEGMENT_MIN_W = 40;
const SEGMENT_H = 32;

export function LoginLanguageSwitcher({ colors }: Props) {
  const { locale, setLocale, t } = useLocale();
  const { theme } = useTheme();
  const reduce = useReducedMotion();
  const [frames, setFrames] = useState<Partial<Record<Locale, SegmentFrame>>>({});

  const bubbleX = useSharedValue(0);
  const bubbleY = useSharedValue(PILL_PAD);
  const bubbleW = useSharedValue(SEGMENT_MIN_W);
  const bubbleH = useSharedValue(SEGMENT_H);
  const ready = useSharedValue(0);

  const activeFrame = frames[locale];

  useEffect(() => {
    if (!activeFrame) return;
    if (reduce || ready.value === 0) {
      bubbleX.value = activeFrame.x;
      bubbleY.value = activeFrame.y;
      bubbleW.value = activeFrame.width;
      bubbleH.value = activeFrame.height;
      ready.value = 1;
      return;
    }
    bubbleX.value = withSpring(activeFrame.x, springs.snappy);
    bubbleY.value = withSpring(activeFrame.y, springs.snappy);
    bubbleW.value = withSpring(activeFrame.width, springs.snappy);
    bubbleH.value = withSpring(activeFrame.height, springs.snappy);
  }, [activeFrame, bubbleH, bubbleW, bubbleX, bubbleY, ready, reduce]);

  const bubbleStyle = useAnimatedStyle(() => ({
    opacity: ready.value,
    transform: [{ translateX: bubbleX.value }, { translateY: bubbleY.value }],
    width: bubbleW.value,
    height: bubbleH.value,
  }));

  const onSegmentLayout = (code: Locale, event: LayoutChangeEvent) => {
    const { x, y, width, height } = event.nativeEvent.layout;
    setFrames((prev) => {
      const existing = prev[code];
      if (
        existing &&
        existing.x === x &&
        existing.y === y &&
        existing.width === width &&
        existing.height === height
      ) {
        return prev;
      }
      return { ...prev, [code]: { x, y, width, height } };
    });
  };

  return (
    <Animated.View entering={FadeIn.duration(280)}>
      <View
        style={{
          borderRadius: theme.radius.full,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.chromeBorder,
          overflow: 'hidden',
          // Soft specular rim
          shadowColor: colors.specular,
          shadowOpacity: 0.35,
          shadowRadius: 6,
          shadowOffset: { width: 0, height: 0 },
        }}
        accessibilityRole="tablist"
        accessibilityLabel={t('mobile.switchLanguage')}
      >
        <BlurView
          intensity={Math.min(colors.blurIntensity, 40)}
          tint={colors.blurTint}
          style={StyleSheet.absoluteFill}
        />
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor:
              Platform.OS === 'android' ? colors.surfaceSolid : colors.chromeBg,
            padding: PILL_PAD,
          }}
        >
          <Animated.View
            pointerEvents="none"
            style={[
              {
                position: 'absolute',
                left: 0,
                top: 0,
                borderRadius: theme.radius.full,
                backgroundColor: colors.brandGoldSoft,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: colors.brandGold,
                opacity: 0.95,
              },
              bubbleStyle,
            ]}
          />
          {locales.map((code) => {
            const active = locale === code;
            return (
              <Pressable
                key={code}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                accessibilityLabel={t(`mobile.languageName.${code}`)}
                hitSlop={4}
                onLayout={(e) => onSegmentLayout(code as Locale, e)}
                onPress={() => {
                  if (code === locale) return;
                  void haptics.selection();
                  void setLocale(code as Locale);
                }}
                style={{
                  width: SEGMENT_MIN_W,
                  minHeight: SEGMENT_H,
                  paddingHorizontal: theme.spacing.xs,
                  borderRadius: theme.radius.full,
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 1,
                }}
              >
                <AppText
                  variant="caption"
                  weight={active ? 'semibold' : 'medium'}
                  style={{
                    color: active ? colors.brandGold : colors.textSecondary,
                    textTransform: 'uppercase',
                    textAlign: 'center',
                    lineHeight: 16,
                  }}
                >
                  {code}
                </AppText>
              </Pressable>
            );
          })}
        </View>
      </View>
    </Animated.View>
  );
}
