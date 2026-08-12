import { useEffect, useMemo } from 'react';
import { View, useWindowDimensions } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  FadeInDown,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
} from 'react-native-reanimated';
import { can, type Permission } from '@maher/permissions';
import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics, useReducedMotion } from '@/motion';
import { useTheme } from '@/theme';

type PlaceTileDef = {
  key: string;
  icon: keyof typeof Ionicons.glyphMap;
  labelKey: string;
  hintKey: string;
  href: Href;
  permission: Permission;
};

const PLACES: PlaceTileDef[] = [
  {
    key: 'invoices',
    icon: 'receipt-outline',
    labelKey: 'mobile.invoices.title',
    hintKey: 'mobile.dealerAccount.placeInvoicesHint',
    href: '/(app)/(customer)/invoices' as Href,
    permission: 'invoice.read',
  },
  {
    key: 'statement',
    icon: 'wallet-outline',
    labelKey: 'mobile.account.statementTitle',
    hintKey: 'mobile.dealerAccount.placeStatementHint',
    href: '/(app)/(customer)/account/statement' as Href,
    permission: 'statement.read',
  },
  {
    key: 'returns',
    icon: 'return-down-back-outline',
    labelKey: 'mobile.returns.title',
    hintKey: 'mobile.dealerAccount.placeReturnsHint',
    href: '/(app)/(customer)/returns' as Href,
    permission: 'sales-order.read',
  },
  {
    key: 'notifications',
    icon: 'notifications-outline',
    labelKey: 'mobile.dealerAccount.notificationSettings',
    hintKey: 'mobile.dealerAccount.placeNotificationsHint',
    href: '/(app)/notifications' as Href,
    permission: 'notification.read',
  },
];

/** 2-column place cards — finance & inbox shortcuts (AI featured separately). */
export function DealerPlacesDock() {
  const { t, locale, isRTL } = useLocale();
  const { colors, theme } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const reduce = useReducedMotion();
  const { width } = useWindowDimensions();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const pad = theme.spacing.lg;
  const gap = theme.spacing.sm;
  const halfW = (width - pad * 2 - gap) / 2;

  const places = useMemo(
    () => PLACES.filter((p) => can(user, p.permission)),
    [user],
  );

  const Shell = reduce ? View : Animated.View;
  const shellProps = reduce
    ? {}
    : { entering: FadeInDown.delay(160).duration(380).damping(22) };

  if (places.length === 0) return null;

  return (
    <Shell {...shellProps} style={{ gap: theme.spacing.md }}>
      <View style={{ gap: 2, alignItems: isRTL ? 'flex-end' : 'flex-start' }}>
        <AppText
          variant="caption"
          weight={locale === 'ar' ? 'regular' : 'medium'}
          style={{
            letterSpacing: locale === 'ar' ? 0 : 1.2,
            textTransform: locale === 'ar' ? 'none' : 'uppercase',
            color: colors.brand,
          }}
        >
          {t('mobile.dealerAccount.placesEyebrow')}
        </AppText>
        <AppText variant="heading" weight={titleWeight}>
          {t('mobile.dealerAccount.placesTitle')}
        </AppText>
        <AppText variant="caption" color="muted" weight="regular">
          {t('mobile.dealerAccount.placesHint')}
        </AppText>
      </View>

      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          flexWrap: 'wrap',
          gap,
        }}
      >
        {places.map((place, index) => (
          <PlaceTile
            key={place.key}
            place={place}
            index={index}
            width={halfW}
            onPress={() => {
              void haptics.confirmLight();
              router.push(place.href);
            }}
          />
        ))}
      </View>
    </Shell>
  );
}

function PlaceTile({
  place,
  index,
  width,
  onPress,
}: {
  place: PlaceTileDef;
  index: number;
  width: number;
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
    <Animated.View style={[{ width }, style]}>
      <AnimatedPressable
        variant="card"
        accessibilityRole="button"
        accessibilityLabel={t(place.labelKey)}
        onPress={onPress}
        style={{
          minHeight: 112,
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
        <View style={{ gap: 2, alignItems: isRTL ? 'flex-end' : 'flex-start' }}>
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
