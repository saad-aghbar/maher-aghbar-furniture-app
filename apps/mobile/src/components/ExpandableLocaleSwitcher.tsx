import { useState } from 'react';
import { Pressable, View } from 'react-native';
import Animated, {
  FadeIn,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { locales } from '@maher/i18n';
import type { Locale } from '@maher/types';
import { AppText } from '@/components/AppText';
import { useLocale } from '@/i18n';
import { haptics, springs, useReducedMotion } from '@/motion';
import { useTheme } from '@/theme';

const CIRCLE = 40;
const SEG_W = 38;
const PAD = 4;
const EXPANDED_W = PAD * 2 + SEG_W * 3;

type Props = {
  expandToward?: 'start' | 'end';
};

/**
 * Circle with active locale (ar/en/he). Press expands into an elongated pill
 * with all three language shortcuts.
 */
export function ExpandableLocaleSwitcher({ expandToward = 'end' }: Props) {
  const { locale, setLocale, t, isRTL } = useLocale();
  const { colors, theme } = useTheme();
  const reduce = useReducedMotion();
  const openSv = useSharedValue(0);
  const [expanded, setExpanded] = useState(false);

  const setOpen = (next: boolean) => {
    setExpanded(next);
    if (reduce) {
      openSv.value = next ? 1 : 0;
    } else {
      openSv.value = next ? withSpring(1, springs.snappy) : withTiming(0, { duration: 200 });
    }
  };

  const toggle = () => {
    void haptics.selection();
    setOpen(!expanded);
  };

  const pick = (code: Locale) => {
    void haptics.confirmLight();
    void setLocale(code);
    setOpen(false);
  };

  const shellStyle = useAnimatedStyle(() => ({
    width: interpolate(openSv.value, [0, 1], [CIRCLE, EXPANDED_W]),
    borderRadius: CIRCLE / 2,
  }));

  const collapsedLabelStyle = useAnimatedStyle(() => ({
    opacity: interpolate(openSv.value, [0, 0.4], [1, 0]),
  }));

  const expandedRowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(openSv.value, [0.35, 1], [0, 1]),
  }));

  const alignSelf =
    expandToward === 'end'
      ? isRTL
        ? ('flex-start' as const)
        : ('flex-end' as const)
      : isRTL
        ? ('flex-end' as const)
        : ('flex-start' as const);

  return (
    <Animated.View entering={FadeIn.duration(280)} style={{ alignSelf, zIndex: 40 }}>
      <Animated.View
        style={[
          {
            height: CIRCLE,
            overflow: 'hidden',
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
            justifyContent: 'center',
            ...theme.elevation.raised,
          },
          shellStyle,
        ]}
      >
        {!expanded ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('mobile.switchLanguage')}
            accessibilityState={{ expanded: false }}
            onPress={toggle}
            style={{
              width: CIRCLE,
              height: CIRCLE,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Animated.View style={collapsedLabelStyle}>
              <AppText
                variant="caption"
                weight="semibold"
                style={{ color: colors.brand, textTransform: 'uppercase' }}
              >
                {locale}
              </AppText>
            </Animated.View>
          </Pressable>
        ) : (
          <Animated.View
            style={[
              {
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: PAD,
                height: CIRCLE,
              },
              expandedRowStyle,
            ]}
          >
            {locales.map((code) => {
              const active = code === locale;
              return (
                <Pressable
                  key={code}
                  accessibilityRole="button"
                  accessibilityLabel={t(`mobile.languageName.${code}`)}
                  accessibilityState={{ selected: active }}
                  onPress={() => pick(code as Locale)}
                  style={{
                    width: SEG_W,
                    height: CIRCLE - PAD * 2,
                    borderRadius: (CIRCLE - PAD * 2) / 2,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: active ? colors.brandSoft : 'transparent',
                  }}
                >
                  <AppText
                    variant="caption"
                    weight={active ? 'semibold' : 'medium'}
                    style={{
                      color: active ? colors.brand : colors.textSecondary,
                      textTransform: 'uppercase',
                    }}
                  >
                    {code}
                  </AppText>
                </Pressable>
              );
            })}
          </Animated.View>
        )}
      </Animated.View>
      {/* Tap outside to collapse while expanded — full-screen transparent catcher behind */}
      {expanded ? (
        <Pressable
          accessibilityLabel={t('common.close')}
          onPress={() => setOpen(false)}
          style={{
            position: 'absolute',
            width: 4000,
            height: 4000,
            top: -2000,
            left: -2000,
            zIndex: -1,
          }}
        />
      ) : null}
    </Animated.View>
  );
}
