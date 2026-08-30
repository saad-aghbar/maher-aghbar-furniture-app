import { type ReactNode } from 'react';
import { StatusBar, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '@/components/AppText';
import { BrandMark } from '@/components/BrandMark';
import { HomeWatermark } from '@/components/chrome/HomeWatermark';
import { ExpandableLocaleSwitcher } from '@/components/ExpandableLocaleSwitcher';
import { ThemeSwitcher } from '@/components/ThemeSwitcher';
import { KeyboardAwareScreen } from '@/components/layout/KeyboardAwareScreen';
import { useTheme } from '@/theme';
import { brandColors } from '@/theme/brand';

type Props = {
  title: string;
  description?: string;
  children?: ReactNode;
};

/**
 * Shared auth satellite canvas — login-family ivory, watermark, circular chrome.
 * Used by MFA / unlock / offline / session-expired / disabled.
 */
export function AuthGateScreen({ title, description, children }: Props) {
  const { theme, colorScheme } = useTheme();
  const insets = useSafeAreaInsets();
  const dark = colorScheme === 'dark';
  const canvas = dark ? brandColors.backgroundDark : brandColors.background;

  return (
    <View style={{ flex: 1, backgroundColor: canvas }}>
      <StatusBar barStyle={dark ? 'light-content' : 'dark-content'} />
      <HomeWatermark />
      <View
        pointerEvents="box-none"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 20,
          paddingTop: insets.top + theme.spacing.sm,
          paddingHorizontal: theme.spacing.lg,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <ExpandableLocaleSwitcher expandToward="start" />
        <ThemeSwitcher />
      </View>
      <KeyboardAwareScreen
        style={{ backgroundColor: 'transparent' }}
        contentContainerStyle={{
          justifyContent: 'center',
          gap: theme.spacing.xl,
          flexGrow: 1,
        }}
      >
        <View style={{ alignItems: 'center', gap: theme.spacing.md }}>
          <BrandMark size="lg" />
          <AppText variant="heading" weight="semibold" align="center">
            {title}
          </AppText>
          {description ? (
            <AppText variant="bodySecondary" color="secondary" align="center">
              {description}
            </AppText>
          ) : null}
        </View>
        {children}
      </KeyboardAwareScreen>
    </View>
  );
}
