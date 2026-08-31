import { useEffect, useMemo } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  FadeInDown,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
} from 'react-native-reanimated';
import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import {
  filterAdminOverflowModules,
  packOverflowPlaceRows,
  type AdminOverflowModule,
} from '@/features/admin-home/adminOverflowModules';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics, useReducedMotion } from '@/motion';
import { useTheme } from '@/theme';

/** 2-column place cards — overflow modules only (AI is featured separately). */
export function MorePlacesDock() {
  const { t, locale, isRTL } = useLocale();
  const { colors, theme } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const reduce = useReducedMotion();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const gap = theme.spacing.sm;

  const places = useMemo(() => {
    const seen = new Set<string>();
    return filterAdminOverflowModules(user, 'more').filter((m) => {
      if (m.key === 'ai-chat' || seen.has(m.key)) return false;
      seen.add(m.key);
      return true;
    });
  }, [user]);

  const rows = useMemo(() => packOverflowPlaceRows(places), [places]);

  const Shell = reduce ? View : Animated.View;
  const shellProps = reduce
    ? {}
    : { entering: FadeInDown.delay(40).duration(380).damping(22) };

  if (places.length === 0) return null;

  return (
    <Shell {...shellProps} style={{ gap: theme.spacing.md }}>
      <View style={{ gap: 2 }}>
        <AppText
          variant="caption"
          weight={locale === 'ar' ? 'regular' : 'medium'}
          style={{ color: colors.brand }}
        >
          {t('mobile.more.floor.dockEyebrow')}
        </AppText>
        <AppText variant="heading" weight={titleWeight}>
          {t('mobile.more.floor.dockTitle')}
        </AppText>
        <AppText variant="caption" color="muted" weight="regular">
          {t('mobile.more.floor.dockHint')}
        </AppText>
      </View>

      <View style={{ gap }}>
        {rows.map((row, rowIndex) => (
          <View
            key={row.map((p) => p.key).join('-')}
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'stretch',
              gap,
            }}
          >
            {row.map((place, colIndex) => (
              <PlaceTile
                key={place.key}
                place={place}
                index={rowIndex * 2 + colIndex}
                onPress={() => {
                  void haptics.confirmLight();
                  router.push(place.href);
                }}
              />
            ))}
          </View>
        ))}
      </View>
    </Shell>
  );
}

function PlaceTile({
  place,
  index,
  onPress,
}: {
  place: AdminOverflowModule;
  index: number;
  onPress: () => void;
}) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme } = useTheme();
  const reduce = useReducedMotion();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const enter = useSharedValue(reduce ? 1 : 0);

  useEffect(() => {
    if (reduce) {
      enter.value = 1;
      return;
    }
    enter.value = withDelay(
      40 + index * 50,
      withSpring(1, { damping: 20, stiffness: 160 }),
    );
  }, [enter, index, reduce]);

  const style = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [
      { translateY: interpolate(enter.value, [0, 1], [10, 0]) },
      { scale: interpolate(enter.value, [0, 1], [0.96, 1]) },
    ],
  }));

  return (
    <Animated.View style={[{ flex: 1, minWidth: 0 }, style]}>
      <AnimatedPressable
        variant="card"
        accessibilityRole="button"
        accessibilityLabel={t(place.labelKey)}
        onPress={onPress}
        style={{
          flex: 1,
          borderRadius: theme.radius.xl,
          borderWidth: 1,
          borderColor: colors.borderStrong,
          backgroundColor: colors.surface,
          padding: theme.spacing.md,
          gap: theme.spacing.sm,
          overflow: 'hidden',
          ...theme.elevation.card,
        }}
      >
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              backgroundColor: colors.surfaceSecondary,
              borderWidth: 1,
              borderColor: colors.border,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name={place.icon} size={20} color={colors.brand} />
          </View>
          <Ionicons
            name={isRTL ? 'arrow-back' : 'arrow-forward'}
            size={16}
            color={colors.textMuted}
          />
        </View>
        <View
          style={{
            gap: 2,
            alignSelf: 'stretch',
            alignItems: isRTL ? 'flex-end' : 'flex-start',
          }}
        >
          <AppText variant="label" weight={titleWeight} numberOfLines={1}>
            {t(place.labelKey)}
          </AppText>
          <AppText
            variant="caption"
            color="muted"
            weight="regular"
            numberOfLines={2}
            style={{ fontSize: 11, lineHeight: 14 }}
          >
            {t(place.hintKey)}
          </AppText>
        </View>
      </AnimatedPressable>
    </Animated.View>
  );
}
