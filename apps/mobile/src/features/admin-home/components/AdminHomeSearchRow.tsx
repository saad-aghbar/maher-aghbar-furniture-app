import { Pressable, TextInput, View } from 'react-native';
import { useEffect, useRef } from 'react';
import { Ionicons } from '@expo/vector-icons';
import Animated from 'react-native-reanimated';
import { AppText } from '@/components/AppText';
import { SearchBarShell } from '@/components/forms/SearchBarShell';
import { SearchActionRow } from '@/components/layout/SearchActionRow';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics, softFadeDown, useReducedMotion } from '@/motion';
import { useTheme } from '@/theme';

type Props = {
  searching: boolean;
  value: string;
  onChangeText: (text: string) => void;
  onActivate: () => void;
  onCancel: () => void;
  onOpenFilter: () => void;
  enterDelay?: number;
};

/**
 * Apple-style home search row — expands in place; Cancel replaces filter while active.
 */
export function AdminHomeSearchRow({
  searching,
  value,
  onChangeText,
  onActivate,
  onCancel,
  onOpenFilter,
  enterDelay = 80,
}: Props) {
  const { t, isRTL } = useLocale();
  const { colors, theme } = useTheme();
  const reduce = useReducedMotion();
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (searching) {
      const id = requestAnimationFrame(() => inputRef.current?.focus());
      return () => cancelAnimationFrame(id);
    }
    return undefined;
  }, [searching]);

  const Wrapper = reduce ? View : Animated.View;
  const wrapperProps = reduce ? {} : { entering: softFadeDown(enterDelay) };

  return (
    <Wrapper
      {...wrapperProps}
      style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        gap: theme.spacing.sm,
        marginBottom: theme.spacing.lg,
        alignItems: 'center',
      }}
    >
      {searching ? (
        <SearchBarShell style={{ flex: 1 }}>
          <TextInput
            ref={inputRef}
            value={value}
            onChangeText={onChangeText}
            placeholder={t('mobile.adminHome.searchPlaceholder')}
            placeholderTextColor={colors.textMuted}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            accessibilityLabel={t('mobile.adminHome.searchPlaceholder')}
            style={{
              flex: 1,
              fontSize: 16,
              color: colors.textPrimary,
              paddingVertical: theme.spacing.sm,
              textAlign: isRTL ? 'right' : 'left',
            }}
          />
        </SearchBarShell>
      ) : (
        <Pressable
          accessibilityRole="search"
          accessibilityLabel={t('mobile.adminHome.searchPlaceholder')}
          onPress={() => {
            void haptics.selection();
            onActivate();
          }}
          style={{ flex: 1 }}
        >
          <SearchBarShell>
            <AppText variant="body" color="muted" style={{ flex: 1 }} numberOfLines={1}>
              {t('mobile.adminHome.searchPlaceholder')}
            </AppText>
          </SearchBarShell>
        </Pressable>
      )}

      {searching ? (
        <AnimatedPressable
          variant="button"
          accessibilityRole="button"
          accessibilityLabel={t('mobile.adminHome.searchCancel')}
          onPress={() => {
            void haptics.selection();
            onCancel();
          }}
          style={{
            minHeight: theme.sizes.touch.min,
            paddingHorizontal: theme.spacing.md,
            borderRadius: theme.radius.full,
            borderWidth: 1,
            borderColor: colors.borderStrong,
            backgroundColor: colors.surface,
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            ...theme.elevation.raised,
          }}
        >
          <Ionicons name="close" size={16} color={colors.brand} />
          <AppText variant="label" weight="semibold" style={{ color: colors.brand }}>
            {t('mobile.adminHome.searchCancel')}
          </AppText>
        </AnimatedPressable>
      ) : (
        <AnimatedPressable
          variant="button"
          accessibilityRole="button"
          accessibilityLabel={t('mobile.adminHome.filterA11y')}
          onPress={() => {
            void haptics.selection();
            onOpenFilter();
          }}
          style={{
            width: theme.sizes.touch.min,
            height: theme.sizes.touch.min,
            borderRadius: theme.sizes.touch.min / 2,
            backgroundColor: colors.brand,
            alignItems: 'center',
            justifyContent: 'center',
            ...theme.elevation.raised,
          }}
        >
          <Ionicons name="options-outline" size={20} color={colors.onBrand} />
        </AnimatedPressable>
      )}
    </Wrapper>
  );
}
