import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '@/components/AppText';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { DEALER_TAB_BAR_CLEARANCE } from '@/navigation/tabBarClearance';
import { dealerTokens, useTheme } from '@/theme';
import {
  NEW_ORDER_DOCK_BODY_HEIGHT,
  NEW_ORDER_DOCK_SCROLL_EXTRA,
  type NewOrderDockMode,
  newOrderDockPrimaryKey,
  newOrderDockShowsSaveDraft,
} from '../newOrderDockMode';

export { NEW_ORDER_DOCK_BODY_HEIGHT, NEW_ORDER_DOCK_SCROLL_EXTRA };

/** Scroll padding so wizard content clears dock + floating tab/FAB. */
export function newOrderDockScrollPad(spacingMd: number): number {
  return (
    DEALER_TAB_BAR_CLEARANCE +
    NEW_ORDER_DOCK_BODY_HEIGHT +
    NEW_ORDER_DOCK_SCROLL_EXTRA +
    spacingMd
  );
}

type NewOrderFloatingDockProps = {
  mode: NewOrderDockMode;
  disabled?: boolean;
  primaryLoading?: boolean;
  draftLoading?: boolean;
  onBack: () => void;
  onPrimary: () => void;
  onSaveDraft?: () => void;
};

export function NewOrderFloatingDock({
  mode,
  disabled,
  primaryLoading,
  draftLoading,
  onBack,
  onPrimary,
  onSaveDraft,
}: NewOrderFloatingDockProps) {
  const { t, isRTL } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const insets = useSafeAreaInsets();
  const dark = colorScheme === 'dark';
  const dealer = dealerTokens(colors);

  if (mode === 'hidden') return null;

  const primaryKey = newOrderDockPrimaryKey(mode);
  const primaryLabel = primaryKey ? t(primaryKey) : '';
  const showSave = newOrderDockShowsSaveDraft(mode) && onSaveDraft;
  const footerClearance = DEALER_TAB_BAR_CLEARANCE + theme.spacing.sm;
  // When keyboard / safe area already tall, still clear the pill.
  const bottomPad = Math.max(footerClearance, insets.bottom + theme.spacing.md);

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        paddingHorizontal: theme.spacing.lg,
        paddingBottom: bottomPad,
        backgroundColor: 'transparent',
      }}
    >
      <View
        style={{
          borderRadius: theme.radius.xl + 4,
          backgroundColor: dark ? dealer.wizardDock : 'rgba(255,255,255,0.72)',
          ...theme.elevation.raised,
          shadowOpacity: dark ? 0.5 : 0.18,
          shadowRadius: 20,
          shadowOffset: { width: 0, height: 10 },
          elevation: Platform.OS === 'android' ? 12 : 8,
        }}
      >
        <View
          style={{
            borderRadius: theme.radius.xl + 4,
            overflow: 'hidden',
            borderWidth: StyleSheet.hairlineWidth * 2,
            borderColor: dark ? 'rgba(255,255,255,0.14)' : 'rgba(63,52,44,0.1)',
          }}
        >
          {Platform.OS === 'ios' ? (
            <BlurView
              intensity={dark ? 36 : 52}
              tint={dark ? 'dark' : 'light'}
              style={StyleSheet.absoluteFill}
            />
          ) : null}
          <View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              {
                backgroundColor: dark
                  ? 'rgba(42,36,37,0.55)'
                  : Platform.OS === 'android'
                    ? 'rgba(255,255,255,0.94)'
                    : 'rgba(255,255,255,0.45)',
              },
            ]}
          />
          <View
            style={{
              padding: theme.spacing.md,
              minHeight: NEW_ORDER_DOCK_BODY_HEIGHT,
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'center',
              gap: theme.spacing.sm,
            }}
          >
            <Pressable
              onPress={onBack}
              disabled={disabled}
              accessibilityRole="button"
              accessibilityLabel={t('mobile.newOrder.back')}
              style={{
                minHeight: theme.sizes.touch.min,
                paddingHorizontal: theme.spacing.md,
                borderRadius: theme.radius.lg,
                borderWidth: StyleSheet.hairlineWidth * 2,
                borderColor: dark ? 'rgba(255,255,255,0.16)' : 'rgba(63,52,44,0.12)',
                backgroundColor: dark
                  ? 'rgba(255,255,255,0.08)'
                  : 'rgba(255,255,255,0.65)',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: disabled ? 0.5 : 1,
              }}
            >
              <AppText variant="label" weight="semibold" color="brand">
                {t('mobile.newOrder.back')}
              </AppText>
            </Pressable>

            {showSave ? (
              <Pressable
                onPress={onSaveDraft}
                disabled={disabled || draftLoading}
                accessibilityRole="button"
                accessibilityLabel={t('mobile.newOrder.saveDraft')}
                style={{
                  minHeight: theme.sizes.touch.min,
                  paddingHorizontal: theme.spacing.sm,
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: disabled || draftLoading ? 0.5 : 1,
                }}
              >
                {draftLoading ? (
                  <ActivityIndicator color={colors.brand} />
                ) : (
                  <AppText variant="caption" weight="semibold" color="secondary">
                    {t('mobile.newOrder.saveDraft')}
                  </AppText>
                )}
              </Pressable>
            ) : null}

            <AnimatedPressable
              variant="button"
              disabled={disabled || primaryLoading}
              onPress={() => {
                void haptics.confirmMedium();
                onPrimary();
              }}
              accessibilityRole="button"
              accessibilityLabel={primaryLabel}
              style={{
                flex: 1,
                minHeight: theme.sizes.touch.min,
                borderRadius: theme.radius.lg,
                backgroundColor: dealer.fab,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: disabled || primaryLoading ? 0.55 : 1,
              }}
            >
              {primaryLoading ? (
                <ActivityIndicator color={dealer.onFab} />
              ) : (
                <AppText
                  variant="label"
                  weight="semibold"
                  style={{ color: dealer.onFab }}
                >
                  {primaryLabel}
                </AppText>
              )}
            </AnimatedPressable>
          </View>
        </View>
      </View>
    </View>
  );
}
