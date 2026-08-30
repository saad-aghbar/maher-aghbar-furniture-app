import { Platform, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import {
  CHAT_COMPOSER_HEIGHT,
  CHAT_COMPOSER_TAB_GAP,
  SURFACE_TAB_BAR_HEIGHT,
} from '@/navigation/tabBarClearance';
import { resolveAppFontStyle, useTheme } from '@/theme';
import { AppTextInput } from '@/components/forms/AppTextInput';

type Props = {
  value: string;
  onChangeText: (v: string) => void;
  onSend: () => void;
  disabled?: boolean;
};

/**
 * Floating glass composer — same width / side inset as PersistentSurfaceTabBar.
 * Absolutely positioned so no opaque shell strip sits behind it.
 */
export function ChatComposer({ value, onChangeText, onSend, disabled }: Props) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const insets = useSafeAreaInsets();
  const canSend = value.trim().length > 0 && !disabled;
  const dark = colorScheme === 'dark';

  // Match PersistentSurfaceTabBar: left/right md, sits just above the pill.
  const bottom =
    Math.max(insets.bottom, theme.spacing.sm) +
    SURFACE_TAB_BAR_HEIGHT +
    CHAT_COMPOSER_TAB_GAP;

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        left: theme.spacing.md,
        right: theme.spacing.md,
        bottom,
        zIndex: 40,
      }}
    >
      <View
        style={{
          minHeight: CHAT_COMPOSER_HEIGHT,
          borderRadius: CHAT_COMPOSER_HEIGHT / 2,
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: dark ? 'rgba(255,255,255,0.14)' : 'rgba(63,52,44,0.12)',
          ...theme.elevation.raised,
        }}
      >
        {Platform.OS === 'ios' ? (
          <BlurView
            intensity={dark ? 28 : 40}
            tint={dark ? 'dark' : 'light'}
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              bottom: 0,
              left: 0,
            }}
          />
        ) : null}
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            backgroundColor: dark ? 'rgba(42,36,37,0.48)' : 'rgba(255,255,255,0.38)',
          }}
        />

        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            minHeight: CHAT_COMPOSER_HEIGHT,
            paddingLeft: isRTL ? 4 : theme.spacing.md,
            paddingRight: isRTL ? theme.spacing.md : 4,
            gap: 4,
          }}
        >
          <AppTextInput
            value={value}
            onChangeText={onChangeText}
            placeholder={t('mobile.aiChat.placeholder')}
            placeholderTextColor={colors.textMuted}
            multiline
            editable={!disabled}
            style={{
              flex: 1,
              minHeight: 36,
              maxHeight: 72,
              paddingVertical: Platform.OS === 'ios' ? 8 : 6,
              paddingHorizontal: 2,
              fontSize: 14,
              lineHeight: 18,
              color: colors.textPrimary,
              textAlign: isRTL ? 'right' : 'left',
              writingDirection: isRTL ? 'rtl' : 'ltr',
              backgroundColor: 'transparent',
              ...resolveAppFontStyle(locale, { variant: 'body' }),
            }}
          />
          <AnimatedPressable
            variant="button"
            accessibilityRole="button"
            accessibilityLabel={t('mobile.aiChat.send')}
            disabled={!canSend}
            onPress={() => {
              if (!canSend) return;
              void haptics.confirmLight();
              onSend();
            }}
            style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors.brand,
              opacity: disabled ? 0.45 : 1,
            }}
          >
            <Ionicons
              name={isRTL ? 'arrow-back' : 'arrow-up'}
              size={16}
              color={colors.onBrand}
            />
          </AnimatedPressable>
        </View>
      </View>
    </View>
  );
}
