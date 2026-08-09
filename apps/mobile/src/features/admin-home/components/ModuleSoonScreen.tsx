import { View } from 'react-native';
import type { Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { AppText } from '@/components/AppText';
import { LargeTitleHeader } from '@/components/layout/LargeTitleHeader';
import { ScrollableScreen } from '@/components/layout/ScrollableScreen';
import { useLocale } from '@/i18n';
import { useReducedMotion } from '@/motion';
import { useSmartBack } from '@/navigation/useSmartBack';
import { useTheme } from '@/theme';

type Props = {
  titleKey: string;
  bodyKey: string;
  icon?: keyof typeof Ionicons.glyphMap;
  /** Escape hatch when opened outside tabs. */
  backFallback?: Href;
};

/** Branded placeholder for modules still landing on mobile. */
export function ModuleSoonScreen({
  titleKey,
  bodyKey,
  icon = 'construct-outline',
  backFallback = '/(app)/(admin)/(tabs)' as Href,
}: Props) {
  const { t } = useLocale();
  const { colors, theme } = useTheme();
  const reduce = useReducedMotion();
  const onBack = useSmartBack(backFallback);
  const Shell = reduce ? View : Animated.View;
  const shellProps = reduce ? {} : { entering: FadeInDown.duration(400).damping(22) };

  return (
    <ScrollableScreen>
      <LargeTitleHeader title={t(titleKey)} onBack={onBack} />
      <Shell
        {...shellProps}
        style={{
          marginTop: theme.spacing.xl,
          borderRadius: theme.radius.xl,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
          padding: theme.spacing.xl,
          alignItems: 'center',
          gap: theme.spacing.md,
          ...theme.elevation.raised,
        }}
      >
        <View
          style={{
            width: 64,
            height: 64,
            borderRadius: 20,
            backgroundColor: colors.brandSoft,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name={icon} size={28} color={colors.brand} />
        </View>
        <AppText variant="title" weight="semibold" align="center">
          {t(titleKey)}
        </AppText>
        <AppText variant="body" color="secondary" align="center">
          {t(bodyKey)}
        </AppText>
      </Shell>
    </ScrollableScreen>
  );
}
